import User    from '../models/User.js';
import Message from '../models/Message.js';
import Room    from '../models/Room.js';
import { registerDMHandlers, cleanupDMUser } from './directMessageSocket.js';
import {
  registerAudioCallHandlers,
  cleanupAudioCallUser,
} from './audioCallSocket.js';

// ─── In-memory state ──────────────────────────────────────────────────────────

const userSockets        = new Map(); // userId → socketId
const activeRooms        = new Map(); // roomId → Map(userId → { username, avatar, socketId })
const pendingDisconnects = new Map(); // userId → { timerId, username }
// ── RAISE HAND: roomId → Map(userId → { username, raisedAt })
const roomHandsRaised    = new Map();

// ── MUTE STATE (Zoom-style):
//    roomId → { hostId: string, mutedByHost: Set<userId>, allowUnmute: boolean }
const roomMuteState      = new Map();

const GRACE_MS = 8000;

// ─── Mute state helpers ───────────────────────────────────────────────────────

const getMuteState = (roomId) => {
  if (!roomMuteState.has(roomId)) {
    roomMuteState.set(roomId, { hostId: null, mutedByHost: new Set(), allowUnmute: true });
  }
  return roomMuteState.get(roomId);
};

const verifyIsHost = async (roomId, userId) => {
  const ms = roomMuteState.get(roomId);
  if (ms?.hostId) return ms.hostId === userId;
  try {
    const room = await Room.findOne({ roomId }).select('host').lean();
    return room?.host?.toString() === userId;
  } catch (_) { return false; }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const evictUserFromAllRooms = (io, userId, username) => {
  for (const [roomId, members] of activeRooms.entries()) {
    if (members.has(userId)) {
      members.delete(userId);

      const roomHands = roomHandsRaised.get(roomId);
      if (roomHands && roomHands.has(userId)) {
        roomHands.delete(userId);
        io.to(roomId).emit('hand-lowered', { userId });
      }

      const ms = roomMuteState.get(roomId);
      if (ms) ms.mutedByHost.delete(userId);

      io.to(roomId).emit('user-left', { userId });
      console.log(`👋 [evict] ${username} removed from room ${roomId}`);

      if (members.size === 0) {
        activeRooms.delete(roomId);
        roomHandsRaised.delete(roomId);
        roomMuteState.delete(roomId);
        Room.findOneAndUpdate({ roomId }, { isActive: false, endedAt: new Date() })
          .catch((err) => console.error('DB room-end error:', err));
      }
    }
  }
};

const cancelGrace = (userId) => {
  const pending = pendingDisconnects.get(userId);
  if (pending) {
    clearTimeout(pending.timerId);
    pendingDisconnects.delete(userId);
  }
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handleSocketConnection = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    registerDMHandlers(io, socket);
    registerAudioCallHandlers(io, socket);

    // ── user-online ────────────────────────────────────────────────────────
    socket.on('user-online', async (userId) => {
      try {
        // ─────────────────────────────────────────────────────────────────
        // FIX: Do ALL critical synchronous work BEFORE the first await.
        //
        // Previously wasInGrace / userSockets / socket.reconnectedRooms were
        // set AFTER `await User.findById()`.  That created a race where a
        // fast client could emit `join-room` while the DB call was still
        // pending, making wasReconnectNotification=false in join-room and
        // causing the server to fire BOTH user-joined AND user-reconnected
        // to the peer.  The peer then called handlePeerDisconnect() inside
        // user-reconnected, tearing down the connection established by the
        // first offer — leaving the refreshed user invisible to the peer.
        // ─────────────────────────────────────────────────────────────────

        const wasInGrace = pendingDisconnects.has(userId);

        // Update socket lookup immediately so WebRTC relay works right away.
        userSockets.set(userId, socket.id);
        socket.userId = userId;

        if (wasInGrace) {
          // Cancel the eviction timer NOW — before the DB call — so there is
          // zero window where the grace timer can fire and evict the user
          // while we are awaiting the DB.
          cancelGrace(userId);

          // Mark this socket as a reconnect.  join-room checks this flag so
          // it can suppress user-joined and avoid the double-offer race.
          socket.isReconnecting = true;

          // Pre-populate reconnectedRooms synchronously so join-room can
          // find the flag even if it arrives during the DB await below.
          socket.reconnectedRooms = new Set();
          for (const [roomId, members] of activeRooms.entries()) {
            if (members.has(userId)) {
              socket.join(roomId);
              socket.reconnectedRooms.add(roomId);
              // Immediately update the stored socketId so WebRTC relay
              // targets the correct socket for any in-flight signalling.
              const info = members.get(userId);
              members.set(userId, { ...info, socketId: socket.id });
            }
          }

          console.log(`♻️  Reconnect flag set for ${userId} — rooms: [${[...socket.reconnectedRooms].join(', ')}]`);
        }

        // ── Async DB work ──────────────────────────────────────────────────
        const user = await User.findById(userId);
        if (!user) return;

        socket.username = user.username;

        user.status   = 'online';
        user.socketId = socket.id;
        user.lastSeen = new Date();
        await user.save();

        socket.join(`user:${userId}`);

        if (wasInGrace) {
          console.log(`♻️  User ${user.username} reconnected within grace period`);

          // Take a fresh snapshot of member lists now that socket.join() ran.
          const rejoinSnapshots = [];
          for (const roomId of socket.reconnectedRooms) {
            const members = activeRooms.get(roomId);
            if (!members) continue;
            rejoinSnapshots.push({
              roomId,
              memberList: Array.from(members.entries()).map(
                ([uid, d]) => ({ userId: uid, ...d })
              ),
            });
          }

          // Delay 500ms — gives the reconnecting client time to finish its
          // React re-render and re-register socket event handlers before we
          // fire user-reconnected and room-rejoin-ack.
          setTimeout(() => {
            for (const { roomId, memberList } of rejoinSnapshots) {
              socket.to(roomId).emit('user-reconnected', {
                userId,
                username:     user.username,
                avatar:       user.avatar,
                isRejoin:     true,
                participants: memberList,
              });

              socket.emit('room-rejoin-ack', { roomId, members: memberList });
              console.log(`📡 Sent rejoin-ack for room ${roomId} (${memberList.length} members)`);

              // Restore raise-hand state
              const roomHands = roomHandsRaised.get(roomId);
              if (roomHands && roomHands.size > 0) {
                const snapshot = Array.from(roomHands.entries()).map(
                  ([uid, info]) => ({ userId: uid, username: info.username, raisedAt: info.raisedAt })
                );
                socket.emit('hands-state-sync', { hands: snapshot });
              }

              // Restore mute state
              const ms = roomMuteState.get(roomId);
              if (ms && (ms.hostId || ms.mutedByHost.size > 0)) {
                socket.emit('mute-state-sync', {
                  hostId:      ms.hostId,
                  mutedIds:    Array.from(ms.mutedByHost),
                  allowUnmute: ms.allowUnmute,
                });
              }
            }
          }, 500);

          socket.emit('online-users-list', { users: Array.from(userSockets.keys()) });

          // Clear reconnect flags after 3 s — long enough to cover any
          // delayed join-room that arrives after the 500 ms rejoin window.
          setTimeout(() => {
            socket.isReconnecting = false;
            if (socket.reconnectedRooms) socket.reconnectedRooms.clear();
            console.log(`🧹 Cleared reconnect flags for ${user.username}`);
          }, 3000);

        } else {
          socket.emit('online-users-list', { users: Array.from(userSockets.keys()) });
          socket.broadcast.emit('user-online',        { userId, username: user.username });
          socket.broadcast.emit('user-status-change', { userId, status: 'online', lastSeen: user.lastSeen });
          socket.broadcast.emit('presence-update-direct', { userId, status: 'online', lastSeen: user.lastSeen });
          console.log(`👤 User ${user.username} came online (fresh)`);
        }

      } catch (err) {
        console.error('user-online error:', err);
      }
    });

    socket.on('call-user', async ({ callerId, receiverId, roomId, callerName, callerAvatar }) => {
      try {
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('incoming-call', { callerId, callerName, callerAvatar, roomId, type: 'video' });
        } else {
          socket.emit('call-failed', { message: 'User is offline' });
        }
      } catch (err) { console.error('call-user error:', err); }
    });

    socket.on('accept-call', ({ callerId, roomId, userId }) => {
      const callerSocketId = userSockets.get(callerId);
      if (callerSocketId) io.to(callerSocketId).emit('call-accepted', { userId, roomId });
    });

    socket.on('reject-call', ({ callerId, userId }) => {
      const callerSocketId = userSockets.get(callerId);
      if (callerSocketId) io.to(callerSocketId).emit('call-rejected', { userId, message: 'Call was rejected' });
    });

    socket.on('cancel-call', ({ receiverId, callerId }) => {
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call-cancelled', {
          callerId: callerId || socket.userId,
        });
        console.log(`📵 Call cancelled by ${callerId} to ${receiverId}`);
      }
    });

    // ── join-room ──────────────────────────────────────────────────────────
    socket.on('join-room', async ({ roomId, userId, username, avatar }) => {
      try {
        if (!socket.userId) socket.userId = userId;
        userSockets.set(userId, socket.id);

        socket.join(roomId);

        if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Map());
        const members = activeRooms.get(roomId);

        const isRejoin = members.has(userId);
        members.set(userId, { username, avatar, socketId: socket.id });

        let room = await Room.findOne({ roomId });
        if (!room) {
          room = await Room.create({
            roomId,
            host:         userId,
            participants: [{ user: userId }],
            startedAt:    new Date(),
          });
        } else if (!room.participants.some((p) => p.user.toString() === userId)) {
          room.participants.push({ user: userId });
          await room.save();
        }

        // MUTE: seed hostId from DB on first join
        const ms = getMuteState(roomId);
        if (!ms.hostId && room?.host) {
          ms.hostId = room.host.toString();
        }

        const memberList = Array.from(members.entries()).map(
          ([uid, info]) => ({ userId: uid, ...info })
        );

        // FIX: check BOTH the synchronous isReconnecting flag AND the
        // reconnectedRooms set.  The flag is set before the DB await in
        // user-online, so it is always present even when join-room races
        // the DB call.  reconnectedRooms is a belt-and-suspenders fallback
        // for the (now unlikely) case where the flag was not yet set.
        const wasReconnectNotification =
          socket.isReconnecting ||
          (socket.reconnectedRooms && socket.reconnectedRooms.has(roomId));

        if (!wasReconnectNotification) {
          socket.to(roomId).emit('user-joined', {
            userId,
            username,
            avatar,
            isRejoin,
            participants: memberList,
          });
          console.log(`👥 ${username} ${isRejoin ? 're' : ''}joined room ${roomId} (${members.size} total)`);
        } else {
          console.log(`👥 ${username} rejoined room ${roomId} — suppressed user-joined (reconnect)`);
        }

        socket.emit('room-participants', { participants: memberList, roomId });

        // Raise-hand snapshot
        const roomHands = roomHandsRaised.get(roomId);
        if (roomHands && roomHands.size > 0) {
          const snapshot = Array.from(roomHands.entries()).map(
            ([uid, info]) => ({ userId: uid, username: info.username, raisedAt: info.raisedAt })
          );
          socket.emit('hands-state-sync', { hands: snapshot });
          console.log(`✋ Sent ${snapshot.length} raised hand(s) to joiner in room ${roomId}`);
        }

        // MUTE: send full mute state to late joiner
        if (ms.hostId || ms.mutedByHost.size > 0) {
          socket.emit('mute-state-sync', {
            hostId:      ms.hostId,
            mutedIds:    Array.from(ms.mutedByHost),
            allowUnmute: ms.allowUnmute,
          });
          console.log(`🔇 Sent mute-state-sync to joiner ${username} in room ${roomId}`);
        }

        try {
          const history = await Message.find({ roomId }).sort({ createdAt: -1 }).limit(50).lean();
          socket.emit('chat-history', { messages: history.reverse() });
        } catch (err) { console.error('chat-history fetch error:', err); }

      } catch (err) {
        console.error('join-room error:', err);
      }
    });

    // ── leave-room ─────────────────────────────────────────────────────────
    socket.on('leave-room', async ({ roomId, userId }) => {
      try {
        socket.leave(roomId);
        cancelGrace(userId);

        const members = activeRooms.get(roomId);
        if (members) {
          members.delete(userId);

          const roomHands = roomHandsRaised.get(roomId);
          if (roomHands && roomHands.has(userId)) {
            roomHands.delete(userId);
            socket.to(roomId).emit('hand-lowered', { userId });
          }

          const ms = roomMuteState.get(roomId);
          if (ms) ms.mutedByHost.delete(userId);

          if (members.size === 0) {
            activeRooms.delete(roomId);
            roomHandsRaised.delete(roomId);
            roomMuteState.delete(roomId);
            await Room.findOneAndUpdate({ roomId }, { isActive: false, endedAt: new Date() });
          }
        }

        socket.to(roomId).emit('user-left', { userId });
        console.log(`🚪 ${userId} intentionally left room ${roomId}`);
      } catch (err) {
        console.error('leave-room error:', err);
      }
    });

    // ── WebRTC signalling ──────────────────────────────────────────────────
    socket.on('webrtc-offer', ({ offer, to, from }) => {
      if (!to) return;
      const fromId = from || socket.userId;
      const target = userSockets.get(to);
      if (target) {
        io.to(target).emit('webrtc-offer', { offer, from: fromId });
      } else {
        console.warn(`[Offer] Target socket not found for userId: ${to} — dropping`);
      }
    });

    socket.on('webrtc-answer', ({ answer, to, from }) => {
      if (!to) return;
      const fromId = from || socket.userId;
      const target = userSockets.get(to);
      if (target) {
        io.to(target).emit('webrtc-answer', { answer, from: fromId });
      } else {
        console.warn(`[Answer] Target socket not found for userId: ${to} — dropping`);
      }
    });

    socket.on('webrtc-ice-candidate', ({ candidate, to }) => {
      if (!to) return;
      const target = userSockets.get(to);
      if (target) {
        io.to(target).emit('webrtc-ice-candidate', { candidate, from: socket.userId });
      } else {
        console.warn(`[ICE] Target socket not found for userId: ${to} — dropping candidate`);
      }
    });

    // ── Room chat ──────────────────────────────────────────────────────────
    socket.on('chat-message', async ({ roomId, message, userId, username, timestamp }) => {
      try {
        const newMessage = await Message.create({
          roomId, sender: userId, senderUsername: username, content: message, type: 'text',
        });
        io.to(roomId).emit('chat-message', {
          _id: newMessage._id, roomId, sender: userId, senderUsername: username,
          content: message, timestamp: timestamp || newMessage.createdAt, createdAt: newMessage.createdAt,
        });
      } catch (err) { console.error('chat-message error:', err); }
    });

    socket.on('typing',      ({ roomId, username }) => socket.to(roomId).emit('user-typing',      { username }));
    socket.on('stop-typing', ({ roomId })           => socket.to(roomId).emit('user-stop-typing'));

    // ── Screen share ───────────────────────────────────────────────────────
    socket.on('user-screen-sharing', ({ roomId, userId, username }) => {
      socket.to(roomId).emit('user-screen-sharing', { userId: userId || socket.userId, username });
    });
    socket.on('user-stopped-screen-sharing', ({ roomId, userId }) => {
      socket.to(roomId).emit('user-stopped-screen-sharing', { userId: userId || socket.userId });
    });

    // ── Recording ──────────────────────────────────────────────────────────
    socket.on('start-recording', async ({ roomId }) => {
      try {
        await Room.findOneAndUpdate({ roomId }, { isRecording: true });
        io.to(roomId).emit('recording-started', { roomId });
      } catch (err) { console.error('start-recording error:', err); }
    });
    socket.on('stop-recording', async ({ roomId, recordingUrl }) => {
      try {
        await Room.findOneAndUpdate({ roomId }, { isRecording: false, recordingUrl });
        io.to(roomId).emit('recording-stopped', { roomId, recordingUrl });
      } catch (err) { console.error('stop-recording error:', err); }
    });

    // ── Emoji reactions ────────────────────────────────────────────────────
    socket.on('send-reaction', ({ roomId, userId, username, emoji }) => {
      socket.to(roomId).emit('reaction', { userId, username, emoji });
    });

    // ── Hand raise ─────────────────────────────────────────────────────────
    socket.on('raise-hand', ({ roomId, userId, username }) => {
      const uid = userId || socket.userId;
      if (!uid || !roomId) return;
      if (!roomHandsRaised.has(roomId)) roomHandsRaised.set(roomId, new Map());
      const roomHands = roomHandsRaised.get(roomId);
      if (roomHands.has(uid)) return;
      const raisedAt = Date.now();
      roomHands.set(uid, { username: username || uid, raisedAt });
      io.to(roomId).emit('hand-raised', { userId: uid, username: username || uid, raisedAt });
      console.log(`✋ ${username || uid} raised hand in room ${roomId}`);
    });

    socket.on('lower-hand', ({ roomId, userId }) => {
      const uid = userId || socket.userId;
      if (!uid || !roomId) return;
      const roomHands = roomHandsRaised.get(roomId);
      if (!roomHands || !roomHands.has(uid)) return;
      roomHands.delete(uid);
      io.to(roomId).emit('hand-lowered', { userId: uid });
      console.log(`👇 ${uid} lowered hand in room ${roomId}`);
    });

    // ── Mute controls ──────────────────────────────────────────────────────

    socket.on('mute-all', async ({ roomId, userId, allowUnmute = true }) => {
      try {
        const uid = userId || socket.userId;
        if (!uid || !roomId) return;

        const authorized = await verifyIsHost(roomId, uid);
        if (!authorized) {
          socket.emit('mute-error', { message: 'Only the host can mute all participants.' });
          console.warn(`🚫 Unauthorized mute-all by ${uid} in ${roomId}`);
          return;
        }

        const ms      = getMuteState(roomId);
        const members = activeRooms.get(roomId);
        if (!members) return;

        const mutedIds = [];
        for (const [memberId] of members.entries()) {
          if (memberId !== uid) {
            ms.mutedByHost.add(memberId);
            mutedIds.push(memberId);
          }
        }
        ms.allowUnmute = !!allowUnmute;

        io.to(roomId).emit('host-muted-all', { hostId: uid, mutedIds, allowUnmute: ms.allowUnmute });
        console.log(`🔇 Host ${uid} muted ${mutedIds.length} participants in ${roomId}`);
      } catch (err) {
        console.error('mute-all error:', err);
      }
    });

    socket.on('toggle-allow-unmute', async ({ roomId, userId, allowUnmute }) => {
      try {
        const uid = userId || socket.userId;
        const authorized = await verifyIsHost(roomId, uid);
        if (!authorized) {
          socket.emit('mute-error', { message: 'Only the host can change unmute permissions.' });
          return;
        }
        const ms       = getMuteState(roomId);
        ms.allowUnmute = !!allowUnmute;
        io.to(roomId).emit('unmute-permission-changed', { allowUnmute: ms.allowUnmute });
        console.log(`🔓 Host ${uid} set allowUnmute=${ms.allowUnmute} in ${roomId}`);
      } catch (err) {
        console.error('toggle-allow-unmute error:', err);
      }
    });

    socket.on('mute-participant', async ({ roomId, userId, targetId }) => {
      try {
        const uid    = userId || socket.userId;
        const target = targetId || userId;
        if (!uid || !roomId) return;

        const authorized = await verifyIsHost(roomId, uid);
        if (!authorized) {
          socket.emit('mute-error', { message: 'Only the host can mute participants.' });
          return;
        }

        const ms = getMuteState(roomId);
        ms.mutedByHost.add(target);

        const targetSocketId = userSockets.get(target);
        if (targetSocketId) {
          io.to(targetSocketId).emit('host-muted-you', { hostId: uid, allowUnmute: ms.allowUnmute });
        }
        console.log(`🔇 Host ${uid} muted participant ${target} in ${roomId}`);
      } catch (err) {
        console.error('mute-participant error:', err);
      }
    });

    socket.on('participant-unmuted', ({ roomId, userId }) => {
      const uid = userId || socket.userId;
      const ms  = roomMuteState.get(roomId);
      if (ms) ms.mutedByHost.delete(uid);
      socket.to(roomId).emit('participant-unmuted', { userId: uid });
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const userId = socket.userId;
      if (!userId) return;

      if (userSockets.get(userId) !== socket.id) {
        console.log(`⚠️  Stale socket disconnect ignored for ${userId}`);
        return;
      }

      let isInRoom = false;
      for (const members of activeRooms.values()) {
        if (members.has(userId)) { isInRoom = true; break; }
      }

      try {
        const user     = await User.findById(userId);
        const username = user?.username ?? userId;

        if (isInRoom) {
          console.log(`⏳ Grace started for ${username} (${GRACE_MS}ms)`);

          const timerId = setTimeout(async () => {
            pendingDisconnects.delete(userId);
            userSockets.delete(userId);

            try {
              const u = await User.findById(userId);
              if (u) { u.status = 'offline'; u.socketId = null; u.lastSeen = new Date(); await u.save(); }
            } catch (dbErr) { console.error('Grace-expiry DB error:', dbErr); }

            evictUserFromAllRooms(io, userId, username);
            cleanupDMUser(io, userId);
            cleanupAudioCallUser(io, userId);

            const offlinePayload = { userId, status: 'offline', lastSeen: new Date() };
            io.emit('user-status-change', offlinePayload);
            io.emit('user-offline', { userId });
            io.emit('presence-update-direct', offlinePayload);
            console.log(`⌛ Grace expired — ${username} evicted`);
          }, GRACE_MS);

          pendingDisconnects.set(userId, { timerId, username });

        } else {
          userSockets.delete(userId);
          if (user) { user.status = 'offline'; user.socketId = null; user.lastSeen = new Date(); await user.save(); }
          cleanupDMUser(io, userId);
          cleanupAudioCallUser(io, userId);
          const offlinePayload = { userId, status: 'offline', lastSeen: new Date() };
          io.emit('user-status-change', offlinePayload);
          io.emit('user-offline', { userId });
          io.emit('presence-update-direct', offlinePayload);
          console.log(`👋 ${username} disconnected (no active room)`);
        }

      } catch (err) {
        console.error('disconnect handler error:', err);
      }
    });
  });
};