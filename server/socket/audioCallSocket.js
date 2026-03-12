/**
 * audioCallSocket.js  (v3 — group-call reliability + offline-ring)
 * ─────────────────────────────────────────────────────────────────
 *
 * CHANGES vs v2
 * ─────────────
 * [FIX CRITICAL-1] audio-webrtc-ice: `from` was never forwarded.
 *   Before: `from: socket.userId` — breaks when auth middleware doesn't set
 *           socket.userId, causing ALL ICE candidates to arrive with from=undefined
 *           on the client → peerConnectionsRef.get(undefined) = undefined
 *           → ICE silently dropped → WebRTC peers never connect.
 *   After:  `from: from || socket.userId` — mirrors the offer/answer handlers.
 *
 * [FIX] audio-webrtc-offer / audio-webrtc-answer: made `from` fallback
 *   explicit and consistent. Added lightweight payload validation.
 *
 * [FIX] join-audio-room: socket leaves any other audio rooms on re-join to
 *   prevent ghost participants when a client reconnects briefly.
 *
 * [FIX] cleanupAudioCallUser: pending offline-ring calls initiated by the
 *   disconnecting user are now cancelled (previously only caller-side calls
 *   were cancelled, not the pending queue entries).
 *
 * Everything else (1:1 calls, offline-ring queue, group rooms, disconnect
 * cleanup) is 100% unchanged from v2.
 */

// ─── In-memory state ─────────────────────────────────────────────────────────

/** callId → { callerId, receiverId, state, startedAt, timeoutTimer, offline? } */
const activeCalls = new Map();

/** roomId → Map(userId → { username, avatar, socketId }) */
const audioRooms = new Map();

/**
 * Offline-ring queue.
 * receiverId → { callId, callerId, callerName, callerAvatar, timeoutTimer }
 * Only one pending call per receiver (latest wins — previous is cancelled).
 */
const pendingCalls = new Map();

const CALL_TIMEOUT_MS = 45_000;
const MAX_ROOM_SIZE   = 8;

const genCallId = () =>
  `acall_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ─── Offline-ring helpers ─────────────────────────────────────────────────────

/**
 * Queue a call for an offline receiver.
 * Called internally when the receiver's socket room is empty.
 */
const _queuePendingCall = (
  io,
  callerSocket,
  { callId, callerId, receiverId, callerName, callerAvatar },
) => {
  // Cancel any pre-existing pending call for this receiver
  const existing = pendingCalls.get(receiverId);
  if (existing) {
    clearTimeout(existing.timeoutTimer);
    io.to(`user:${existing.callerId}`).emit('audio-call-timeout', {
      callId: existing.callId,
      reason: 'superseded',
    });
    activeCalls.delete(existing.callId);
  }

  const timeoutTimer = setTimeout(() => {
    pendingCalls.delete(receiverId);
    activeCalls.delete(callId);
    io.to(`user:${callerId}`).emit('audio-call-timeout', { callId });
    console.log(
      `⏰ [AudioCall] offline-ring timeout [${callId}] receiver=${receiverId}`,
    );
  }, CALL_TIMEOUT_MS);

  pendingCalls.set(receiverId, {
    callId,
    callerId,
    callerName,
    callerAvatar,
    timeoutTimer,
  });

  activeCalls.set(callId, {
    callerId,
    receiverId,
    state: 'ringing',
    startedAt: Date.now(),
    timeoutTimer,
    offline: true,
  });

  callerSocket.emit('audio-call-queued', {
    callId,
    receiverId,
    message: 'User is offline — will ring when they connect',
  });

  console.log(
    `📵➡📞 [AudioCall] queued offline ring ${callerId} → ${receiverId} [${callId}]`,
  );
};

/**
 * Called from handlers.js every time a user (re)connects and joins their
 * personal socket room.  Delivers any pending incoming call immediately.
 *
 * Usage in handlers.js:
 *   import { deliverPendingAudioCalls } from './audioCallSocket.js';
 *   // inside the connect / join-user-room handler:
 *   deliverPendingAudioCalls(io, userId);
 */
export const deliverPendingAudioCalls = (io, userId) => {
  const pending = pendingCalls.get(userId);
  if (!pending) return;

  const { callId, callerId, callerName, callerAvatar } = pending;

  if (!activeCalls.has(callId)) {
    pendingCalls.delete(userId);
    return;
  }

  console.log(
    `🔔 [AudioCall] delivering pending call to reconnected user=${userId} callId=${callId}`,
  );

  io.to(`user:${userId}`).emit('incoming-audio-call', {
    callId,
    callerId,
    callerName,
    callerAvatar,
  });

  // Remove from pending — it's now a live call
  pendingCalls.delete(userId);
};

// ─── Main registration ────────────────────────────────────────────────────────

export const registerAudioCallHandlers = (io, socket) => {
  /**
   * check-pending-audio-calls
   * ─────────────────────────
   * The CLIENT emits this on every socket (re)connect so we can deliver
   * queued offline-ring calls without requiring changes to handlers.js.
   * Payload: { userId }
   */
  socket.on('check-pending-audio-calls', ({ userId } = {}) => {
    const uid = userId || socket.userId;
    if (!uid) return;
    console.log(`🔄 [AudioCall] check-pending for userId=${uid}`);
    deliverPendingAudioCalls(io, uid);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 : 1  A U D I O  C A L L S
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * audio-call-user
   * Payload: { callerId, receiverId, callerName, callerAvatar }
   */
  socket.on(
    'audio-call-user',
    ({ callerId, receiverId, callerName, callerAvatar }) => {
      try {
        if (!callerId || !receiverId) return;

        // Is receiver already in an active connected call?
        const isReceiverBusy = Array.from(activeCalls.values()).some(
          (c) =>
            (c.callerId === receiverId || c.receiverId === receiverId) &&
            c.state === 'connected',
        );
        if (isReceiverBusy) {
          socket.emit('audio-call-busy', {
            receiverId,
            message: 'User is already in a call',
          });
          return;
        }

        const callId = genCallId();

        const receiverRoom = io.sockets.adapter.rooms.get(`user:${receiverId}`);
        const isOnline = receiverRoom && receiverRoom.size > 0;

        if (!isOnline) {
          _queuePendingCall(io, socket, {
            callId,
            callerId,
            receiverId,
            callerName,
            callerAvatar,
          });
          socket.emit('audio-call-initiated', { callId, receiverId });
          return;
        }

        const timeoutTimer = setTimeout(() => {
          const call = activeCalls.get(callId);
          if (call && call.state === 'ringing') {
            activeCalls.delete(callId);
            socket.emit('audio-call-timeout', { callId });
            io.to(`user:${receiverId}`).emit('audio-call-ended', {
              callId,
              reason: 'timeout',
            });
          }
        }, CALL_TIMEOUT_MS);

        activeCalls.set(callId, {
          callerId,
          receiverId,
          state: 'ringing',
          startedAt: Date.now(),
          timeoutTimer,
          offline: false,
        });

        io.to(`user:${receiverId}`).emit('incoming-audio-call', {
          callId,
          callerId,
          callerName,
          callerAvatar,
        });

        socket.emit('audio-call-initiated', { callId, receiverId });

        console.log(
          `📞 [AudioCall] initiated ${callerId} → ${receiverId} [${callId}]`,
        );
      } catch (err) {
        console.error('[AudioCall] audio-call-user error:', err);
      }
    },
  );

  /**
   * audio-call-accepted
   * Payload: { callId, callerId }
   */
  socket.on('audio-call-accepted', ({ callId, callerId }) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) return;
      clearTimeout(call.timeoutTimer);
      call.state = 'connected';
      io.to(`user:${callerId}`).emit('audio-call-accepted', {
        callId,
        acceptedBy: socket.userId || call.receiverId,
      });
      console.log(`✅ [AudioCall] accepted [${callId}]`);
    } catch (err) {
      console.error('[AudioCall] audio-call-accepted error:', err);
    }
  });

  /**
   * audio-call-rejected
   * Payload: { callId, callerId }
   */
  socket.on('audio-call-rejected', ({ callId, callerId }) => {
    try {
      const call = activeCalls.get(callId);
      if (call?.timeoutTimer) clearTimeout(call.timeoutTimer);
      activeCalls.delete(callId);
      if (call?.receiverId) pendingCalls.delete(call.receiverId);
      io.to(`user:${callerId}`).emit('audio-call-rejected', {
        callId,
        rejectedBy: socket.userId || call?.receiverId,
      });
      console.log(`❌ [AudioCall] rejected [${callId}]`);
    } catch (err) {
      console.error('[AudioCall] audio-call-rejected error:', err);
    }
  });

  /**
   * audio-call-ended
   * Payload: { callId, peerId }
   */
  socket.on('audio-call-ended', ({ callId, peerId }) => {
    try {
      const call = activeCalls.get(callId);
      if (call?.timeoutTimer) clearTimeout(call.timeoutTimer);
      activeCalls.delete(callId);
      // Cancel pending queue if caller hung up before receiver reconnected
      if (call?.receiverId) pendingCalls.delete(call.receiverId);
      if (peerId) {
        io.to(`user:${peerId}`).emit('audio-call-ended', {
          callId,
          reason: 'ended',
          endedBy: socket.userId,
        });
      }
      console.log(`📵 [AudioCall] ended [${callId}]`);
    } catch (err) {
      console.error('[AudioCall] audio-call-ended error:', err);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // A U D I O - O N L Y  W e b R T C  S I G N A L I N G
  //
  // ── FIX CRITICAL-1 ────────────────────────────────────────────────────────
  // The original audio-webrtc-ice handler destructured { candidate, to }
  // but NOT `from`.  It then used `socket.userId` as the `from` value.
  // When the auth middleware does not attach socket.userId (common in many
  // setups), every ICE candidate arrives at the receiving client as:
  //   { candidate, from: undefined }
  // The client's handler calls handleAudioIce(undefined, candidate) which
  // looks up peerConnectionsRef.current.get(undefined) → returns undefined
  // → the candidate is queued under key `undefined` and NEVER flushed
  // → the WebRTC connection never passes ICE, peers cannot hear each other.
  //
  // Fix: destructure `from` from the payload and use `from || socket.userId`,
  // identical to the pattern already used for offer and answer.
  // ──────────────────────────────────────────────────────────────────────────

  socket.on('audio-webrtc-offer', ({ offer, to, from }) => {
    if (!offer || !to) return;
    const fromId = from || socket.userId;
    io.to(`user:${to}`).emit('audio-webrtc-offer', { offer, from: fromId });
  });

  socket.on('audio-webrtc-answer', ({ answer, to, from }) => {
    if (!answer || !to) return;
    const fromId = from || socket.userId;
    io.to(`user:${to}`).emit('audio-webrtc-answer', { answer, from: fromId });
  });

  // ★ PRIMARY FIX — `from` was never destructured, so it was always undefined.
  socket.on('audio-webrtc-ice', ({ candidate, to, from }) => {
    if (!to) return;
    // candidate may legitimately be null (end-of-candidates) — still forward it
    const fromId = from || socket.userId;
    io.to(`user:${to}`).emit('audio-webrtc-ice', { candidate, from: fromId });
  });

  // ─── Upgrade existing 1:1 call to group ──────────────────────────────────

  socket.on('upgrade-call-to-group', ({ peerId, roomId, initiatorId }) => {
    if (!peerId || !roomId) return;
    io.to(`user:${peerId}`).emit('audio-call-upgrade', { roomId, initiatorId });
  });

socket.on('cancel-invite', ({ inviteeId }) => {
  try {
    if (!inviteeId) return;
    for (const [callId, call] of activeCalls.entries()) {
      if (call.receiverId === inviteeId && call.isGroupInvite) {
        clearTimeout(call.timeoutTimer);
        activeCalls.delete(callId);
        io.to(`user:${inviteeId}`).emit('audio-call-ended', {
          callId,
          reason: 'cancelled',
        });
        console.log(`🚫 [AudioCall] invite cancelled for ${inviteeId} [${callId}]`);
        break;
      }
    }
  } catch (err) {
    console.error('[AudioCall] cancel-invite error:', err);
  }
});
  // ─── Invite a new contact into an ongoing group call ─────────────────────

  socket.on(
    'invite-to-group-call',
    ({ inviterId, inviteeId, inviterName, inviterAvatar, roomId }) => {
      try {
        const receiverRoom = io.sockets.adapter.rooms.get(`user:${inviteeId}`);
        const isOnline = receiverRoom && receiverRoom.size > 0;

        if (!isOnline) {
          socket.emit('invite-failed', {
            inviteeId,
            reason: 'User is offline',
          });
          return;
        }

        const newCallId = genCallId();
        const timeoutTimer = setTimeout(() => {
          activeCalls.delete(newCallId);
          socket.emit('invite-timeout', { inviteeId });
        }, CALL_TIMEOUT_MS);

        activeCalls.set(newCallId, {
          callerId: inviterId,
          receiverId: inviteeId,
          state: 'ringing',
          startedAt: Date.now(),
          timeoutTimer,
          isGroupInvite: true,
          roomId,
        });

        io.to(`user:${inviteeId}`).emit('incoming-audio-call', {
          callId: newCallId,
          callerId: inviterId,
          callerName: inviterName,
          callerAvatar: inviterAvatar,
          isGroupInvite: true,
          roomId,
        });

        socket.emit('invite-sent', { inviteeId });
      } catch (err) {
        console.error('[AudioCall] invite-to-group-call error:', err);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // G R O U P  A U D I O  R O O M S
  // ═══════════════════════════════════════════════════════════════════════════

  socket.on('create-audio-room', ({ roomId, userId, username, avatar }) => {
    try {
      if (!audioRooms.has(roomId)) audioRooms.set(roomId, new Map());
      const room = audioRooms.get(roomId);
      room.set(userId, { username, avatar, socketId: socket.id });
      socket.join(`audio:${roomId}`);
      socket.emit('audio-room-created', { roomId, participants: [] });
      console.log(`🎙️ [AudioRoom] created ${roomId} by ${username}`);
    } catch (err) {
      console.error('[AudioCall] create-audio-room error:', err);
    }
  });

  socket.on('join-audio-room', ({ roomId, userId, username, avatar }) => {
    try {
      if (!audioRooms.has(roomId)) audioRooms.set(roomId, new Map());
      const room = audioRooms.get(roomId);

      // Capacity check (only for truly new participants)
      if (room.size >= MAX_ROOM_SIZE && !room.has(userId)) {
        socket.emit('audio-room-full', { roomId, maxSize: MAX_ROOM_SIZE });
        return;
      }

      // ── FIX: evict from any OTHER rooms this user is already in ──────────
      // Prevents ghost participants if the client joins a new room without
      // explicitly leaving the previous one (e.g. quick reconnect cycle).
      for (const [otherRoomId, otherRoom] of audioRooms.entries()) {
        if (otherRoomId !== roomId && otherRoom.has(userId)) {
          _evictFromAudioRoom(io, socket, otherRoomId, userId);
        }
      }

      room.set(userId, { username, avatar, socketId: socket.id });
      socket.join(`audio:${roomId}`);

      // Tell the joiner about all existing participants (excluding themselves)
      const existingParticipants = Array.from(room.entries())
        .filter(([uid]) => uid !== userId)
        .map(([uid, info]) => ({ userId: uid, ...info }));

      socket.emit('audio-room-joined', {
        roomId,
        participants: existingParticipants,
      });

      // Tell everyone else about the new joiner (full list for authoritative sync)
      socket.to(`audio:${roomId}`).emit('user-joined-audio', {
        userId,
        username,
        avatar,
        allParticipants: Array.from(room.entries()).map(([uid, info]) => ({
          userId: uid,
          ...info,
        })),
      });

      console.log(
        `🎙️ [AudioRoom] ${username} joined ${roomId} (${room.size} total)`,
      );
    } catch (err) {
      console.error('[AudioCall] join-audio-room error:', err);
    }
  });

  socket.on('leave-audio-room', ({ roomId, userId }) => {
    try {
      _evictFromAudioRoom(io, socket, roomId, userId);
    } catch (err) {
      console.error('[AudioCall] leave-audio-room error:', err);
    }
  });
};

// ─── Shared room eviction helper ─────────────────────────────────────────────

const _evictFromAudioRoom = (io, socket, roomId, userId) => {
  const room = audioRooms.get(roomId);
  if (!room || !room.has(userId)) return;

  room.delete(userId);
  socket?.leave?.(`audio:${roomId}`);

  if (room.size === 0) {
    audioRooms.delete(roomId);
    io.to(`audio:${roomId}`).emit('audio-room-ended', { roomId });
  } else {
    io.to(`audio:${roomId}`).emit('user-left-audio', {
      userId,
      roomId,   // ← lets client verify event belongs to current active room
      allParticipants: Array.from(room.entries()).map(([uid, info]) => ({
        userId: uid,
        ...info,
      })),
    });
  }
};

// ─── Disconnect cleanup ───────────────────────────────────────────────────────

export const cleanupAudioCallUser = (io, userId) => {
  // End any active 1:1 calls (but NOT offline-ring queue entries —
  // those survive a brief disconnect/reconnect cycle)
  for (const [callId, call] of activeCalls.entries()) {
    if (call.offline) continue;
    if (call.callerId === userId || call.receiverId === userId) {
      clearTimeout(call.timeoutTimer);
      const peerId =
        call.callerId === userId ? call.receiverId : call.callerId;
      io.to(`user:${peerId}`).emit('audio-call-ended', {
        callId,
        reason: 'peer-disconnected',
      });
      activeCalls.delete(callId);
    }
  }

  // ── FIX: cancel pending offline-ring calls that THIS user initiated ───────
  // Without this, if the CALLER disconnects before the offline receiver
  // reconnects, the pending entry would ring a phantom call on reconnect.
  for (const [receiverId, pending] of pendingCalls.entries()) {
    if (pending.callerId === userId) {
      clearTimeout(pending.timeoutTimer);
      activeCalls.delete(pending.callId);
      pendingCalls.delete(receiverId);
      console.log(
        `🧹 [AudioCall] cleared pending call from disconnected caller ${userId}`,
      );
    }
  }

  // Remove from any audio rooms
  for (const [roomId, room] of audioRooms.entries()) {
    if (room.has(userId)) {
      room.delete(userId);
      if (room.size === 0) {
        audioRooms.delete(roomId);
      } else {
        io.to(`audio:${roomId}`).emit('user-left-audio', {
          userId,
          roomId,   // ← lets client verify event belongs to current active room
          allParticipants: Array.from(room.entries()).map(([uid, info]) => ({
            userId: uid,
            ...info,
          })),
        });
      }
    }
  }
};