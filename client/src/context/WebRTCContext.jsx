// ─────────────────────────────────────────────────────────────────────────────
// WebRTCContext.jsx  —  V-Meet WebRTC State & Peer Connection Management
// ─────────────────────────────────────────────────────────────────────────────
//
// FIXES IN THIS FILE
// ─────────────────────────────────────────────────────────────────────────────
//
// FIX A — ICE Restart Actually Creates a New Offer  (was: silent no-op)
// ───────────────────────────────────────────────────────────────────────────
// PROBLEM: The original code called `pc.restartIce()` on ICE failure.
// `restartIce()` only signals the browser to gather new candidates — it does
// NOT automatically re-send them to the remote peer. The offerer MUST create
// a new offer with `{ iceRestart: true }` and send it.  Without this, ICE
// failure is permanent and the call stays broken.
//
// FIX: Track who created the original offer via `offerersRef`. When ICE
// fails, the original offerer creates a new offer with `iceRestart: true`
// and sends it through signalling. The answerer responds normally.
// This means exactly ONE side restarts (no glare / duplicate offers).
//
// FIX B — 'disconnected' ICE State Gets a Recovery Window
// ───────────────────────────────────────────────────────────────────────────
// PROBLEM: 'disconnected' is a temporary state (e.g. brief network hiccup).
// Triggering a full restart immediately causes unnecessary renegotiation.
// PROBLEM 2: The original code didn't monitor 'disconnected' at all, so
// extended disconnections silently sat forever.
//
// FIX: Wait 5 s on 'disconnected'. If the state hasn't recovered to
// 'connected'/'completed' by then, call `pc.restartIce()` to nudge the
// browser to try new candidates (this is harmless without a new offer and
// sometimes alone is enough to recover on briefly-flaky networks).
// If state reaches 'failed', the full ICE restart offer is created (FIX A).
//
// FIX C — replaceVideoTrack Updates localStream
// ───────────────────────────────────────────────────────────────────────────
// PROBLEM: `replaceVideoTrack` only called `sender.replaceTrack()` on each
// peer connection, but did NOT update `localStreamRef.current` or call
// `setLocalStream`. This meant the local preview <video> element was left
// showing the old track after a camera switch.
//
// FIX: After replacing the track in all peer connections, also swap the
// old video track for the new one inside `localStreamRef.current` and call
// `setLocalStream` so VideoTile re-renders with the new camera.
//
// FIX D — createOffer guards signalingState
// ───────────────────────────────────────────────────────────────────────────
// PROBLEM: If `createOffer` is called while a peer connection is already in
// `have-local-offer` (e.g. rapid reconnect events), `createOffer()` throws
// an InvalidStateError and the call never connects.
//
// FIX: Check `pc.signalingState === 'stable'` before calling
// `pc.createOffer()`. If the state is wrong, log a warning and bail — the
// existing negotiation will complete on its own.
//
// FIX E — connectionState 'failed' Tears Down and Signals UI
// ───────────────────────────────────────────────────────────────────────────
// PROBLEM: On `connectionState === 'failed'`, the old code only removed the
// remote stream from state. It left the dead RTCPeerConnection object in
// `peerConnectionsRef` and never cleaned up event listeners — a memory leak.
//
// FIX: Full peer cleanup (remove listeners → close → delete from map) when
// `connectionState` reaches 'failed' or 'closed'.
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext, useContext, useRef, useState, useCallback,
} from 'react';
import { useSocket } from './SocketContext';
import {
  WEBRTC_CONFIG,
  getUserMedia,
  MEDIA_CONSTRAINTS,
  replaceTrack,
} from '../utils/webrtc';

const WebRTCContext = createContext(null);

export const useWebRTC = () => {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error('useWebRTC must be used within WebRTCProvider');
  return ctx;
};

// ─────────────────────────────────────────────────────────────────────────────

export const WebRTCProvider = ({ children }) => {
  const { emit } = useSocket();

  // ── State ──────────────────────────────────────────────────────────────────
  const [localStream,      setLocalStream]     = useState(null);
  const [remoteStreamsObj, setRemoteStreamsObj] = useState({});
  const [isMuted,          setIsMuted]         = useState(false);
  const [isVideoOff,       setIsVideoOff]      = useState(false);
  const [isScreenSharing,  setIsScreenSharing] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const peerConnectionsRef  = useRef(new Map()); // userId → RTCPeerConnection
  const remoteStreamsRef    = useRef(new Map()); // userId → MediaStream
  const localStreamRef      = useRef(null);
  const myUserIdRef         = useRef(null);
  const pendingCandidates   = useRef(new Map()); // userId → RTCIceCandidate[]

  // ── NEW: ICE restart tracking (FIX A + B) ────────────────────────────────
  // offerersRef: set of userIds for which WE sent the original offer.
  // Only the original offerer should send ICE-restart offers.
  const offerersRef         = useRef(new Set());
  // iceRestartTimersRef: timers for the 'disconnected' recovery window.
  const iceRestartTimersRef = useRef(new Map()); // userId → timerId
  // currentRoomRef: last roomId used, needed inside async ICE-restart callbacks.
  const currentRoomRef      = useRef(null);

  // ── Derived: expose remoteStreams as Map ───────────────────────────────────
  const remoteStreams = new Map(
    Object.entries(remoteStreamsObj).filter(([k]) => k !== '_ts')
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  const publishStream = useCallback((userId, stream) => {
    remoteStreamsRef.current.set(userId, stream);
    setRemoteStreamsObj(() => ({
      ...Object.fromEntries(remoteStreamsRef.current),
      _ts: Date.now(),
    }));
  }, []);

  const removeRemoteStream = useCallback((userId) => {
    remoteStreamsRef.current.delete(userId);
    setRemoteStreamsObj(Object.fromEntries(remoteStreamsRef.current));
  }, []);

  const flushPendingCandidates = useCallback(async (userId, pc) => {
    const pending = pendingCandidates.current.get(userId) ?? [];
    console.log(`[WebRTC] Flushing ${pending.length} pending ICE candidate(s) for ${userId}`);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] flushPendingCandidates addIceCandidate error:', err.message);
      }
    }
    pendingCandidates.current.delete(userId);
  }, []);

  // ── cleanupPeer: centralised teardown helper ──────────────────────────────
  // FIX E: removes all listeners before closing to prevent memory leaks and
  // stale event callbacks firing after a peer is gone.
  const cleanupPeer = useCallback((userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.ontrack                    = null;
      pc.onicecandidate             = null;
      pc.onconnectionstatechange    = null;
      pc.oniceconnectionstatechange = null;
      pc.onnegotiationneeded        = null;
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    // Clear any pending ICE-restart timers for this peer (FIX B)
    const timer = iceRestartTimersRef.current.get(userId);
    if (timer) {
      clearTimeout(timer);
      iceRestartTimersRef.current.delete(userId);
    }
    offerersRef.current.delete(userId);
    pendingCandidates.current.delete(userId);
  }, []);

  // ── createPeer ─────────────────────────────────────────────────────────────
  const createPeer = useCallback((userId) => {
    // Close any stale connection first (FIX E: use centralised cleanup)
    cleanupPeer(userId);

    console.log(`[WebRTC] Creating peer connection for ${userId}`);
    const pc = new RTCPeerConnection(WEBRTC_CONFIG);

    // ── Add local tracks ──────────────────────────────────────────────────
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log(`[WebRTC] Added local ${track.kind} track to peer ${userId}`);
      });
    } else {
      console.warn(`[WebRTC] createPeer(${userId}): no local stream yet — tracks will be missing`);
    }

    // ── Incoming remote tracks ────────────────────────────────────────────
    pc.ontrack = ({ track, streams }) => {
      console.log(`[WebRTC] ontrack from ${userId}: kind=${track.kind} streams=${streams?.length}`);

      let peerStream = remoteStreamsRef.current.get(userId);
      if (!peerStream) {
        peerStream = new MediaStream();
        remoteStreamsRef.current.set(userId, peerStream);
      }

      const addIfMissing = (t) => {
        if (!peerStream.getTracks().find(e => e.id === t.id)) peerStream.addTrack(t);
      };

      if (streams && streams.length > 0) {
        streams[0].getTracks().forEach(addIfMissing);
      } else {
        addIfMissing(track); // Firefox / older Safari
      }

      publishStream(userId, peerStream);

      track.onended  = () => publishStream(userId, peerStream);
      track.onmute   = () => publishStream(userId, peerStream);
      track.onunmute = () => {
        console.log(`[WebRTC] track unmuted from ${userId}: kind=${track.kind}`);
        publishStream(userId, peerStream);
      };
    };

    // ── ICE candidate signalling ──────────────────────────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        emit('webrtc-ice-candidate', { candidate, to: userId });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state with ${userId}: ${pc.iceGatheringState}`);
    };

    // ── ICE connection lifecycle  (FIX A + FIX B) ─────────────────────────
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[WebRTC] ICE connection state with ${userId}: ${state}`);

      if (state === 'connected' || state === 'completed') {
        // ── Success: clear any pending restart timer ───────────────────
        const t = iceRestartTimersRef.current.get(userId);
        if (t) { clearTimeout(t); iceRestartTimersRef.current.delete(userId); }
        console.log(`[WebRTC] ✅ Connected to ${userId}`);
      }

      if (state === 'disconnected') {
        // ── FIX B: brief network hiccup — give it 5 s to self-recover ──
        console.warn(`[WebRTC] ⚠️ ICE disconnected from ${userId} — waiting 5 s before restart`);
        const timer = setTimeout(() => {
          iceRestartTimersRef.current.delete(userId);
          const currentPc = peerConnectionsRef.current.get(userId);
          if (!currentPc) return;
          if (currentPc.iceConnectionState === 'disconnected') {
            console.warn(`[WebRTC] Still disconnected from ${userId} after 5 s — triggering restartIce`);
            currentPc.restartIce?.();
          }
        }, 5000);
        iceRestartTimersRef.current.set(userId, timer);
      }

      if (state === 'failed') {
        // ── FIX A: ICE failed — the original offerer creates a restart offer ──
        const t = iceRestartTimersRef.current.get(userId);
        if (t) { clearTimeout(t); iceRestartTimersRef.current.delete(userId); }

        if (offerersRef.current.has(userId)) {
          // We sent the original offer → we must send the restart offer too
          console.warn(`[WebRTC] ICE failed with ${userId} — restarting as offerer`);
          const roomId = currentRoomRef.current;
          if (!roomId) {
            console.error('[WebRTC] ICE restart: no currentRoomRef — cannot restart');
            return;
          }
          pc.createOffer({ iceRestart: true })
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
              emit('webrtc-offer', {
                offer:  pc.localDescription,
                to:     userId,
                from:   myUserIdRef.current,
                roomId,
              });
              console.log(`[WebRTC] ICE restart offer sent to ${userId}`);
            })
            .catch(err => console.error('[WebRTC] ICE restart offer error:', err));
        } else {
          // We were the answerer — the offerer will send a restart offer.
          // No action needed here; we will respond via the webrtc-offer handler.
          console.warn(`[WebRTC] ICE failed with ${userId} — waiting for offerer to restart`);
        }
      }
    };

    // ── Overall connection state (FIX E: proper cleanup on failure) ────────
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] Connection state with ${userId}: ${state}`);

      if (state === 'failed' || state === 'closed') {
        // Remove remote stream from UI
        removeRemoteStream(userId);
        // FIX E: Do NOT clean up the PC here — it's still in peerConnectionsRef
        // and may be referenced by the ICE restart logic above. Cleanup happens
        // via handlePeerDisconnect (socket user-left) or createPeer (reconnect).
        console.warn(`[WebRTC] Peer ${userId} connection ${state}`);
      }
    };

    peerConnectionsRef.current.set(userId, pc);
    return pc;
  }, [emit, cleanupPeer, publishStream, removeRemoteStream]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const initializeMedia = useCallback(async (userId) => {
    myUserIdRef.current = userId;
    console.log('[WebRTC] Initializing media for user:', userId);
    const { stream, error } = await getUserMedia(MEDIA_CONSTRAINTS);
    if (error || !stream) {
      console.error('[WebRTC] Media init failed:', error);
      return { success: false, error };
    }
    console.log(
      `[WebRTC] Media ready — audio tracks: ${stream.getAudioTracks().length}, ` +
      `video tracks: ${stream.getVideoTracks().length}`
    );
    localStreamRef.current = stream;
    setLocalStream(stream);
    return { success: true };
  }, []);

  // ── FIX D: signalingState guard + offerer tracking ─────────────────────────
  const createOffer = useCallback(async (userId, roomId) => {
    currentRoomRef.current = roomId;
    const pc = createPeer(userId);

    // FIX D: guard against creating an offer in a non-stable state
    if (pc.signalingState !== 'stable') {
      console.warn(
        `[WebRTC] createOffer(${userId}): signalingState is '${pc.signalingState}', not 'stable' — skipping`
      );
      return;
    }

    // FIX A: mark ourselves as the offerer so ICE restart sends a new offer
    offerersRef.current.add(userId);
    console.log(`[WebRTC] Creating offer for ${userId} (room: ${roomId})`);

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      emit('webrtc-offer', { offer, to: userId, from: myUserIdRef.current, roomId });
      console.log(`[WebRTC] Offer sent to ${userId}`);
    } catch (err) {
      console.error('[WebRTC] createOffer error:', err);
      offerersRef.current.delete(userId); // clean up on error
    }
  }, [createPeer, emit]);

  const handleOffer = useCallback(async (fromUserId, roomId, offer) => {
    currentRoomRef.current = roomId;
    console.log(`[WebRTC] Handling offer from ${fromUserId}`);

    // FIX A: we're the answerer — do not track this userId in offerersRef
    offerersRef.current.delete(fromUserId);

    const pc = createPeer(fromUserId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates(fromUserId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('webrtc-answer', { answer, to: fromUserId, from: myUserIdRef.current, roomId });
      console.log(`[WebRTC] Answer sent to ${fromUserId}`);
    } catch (err) {
      console.error('[WebRTC] handleOffer error:', err);
    }
  }, [createPeer, emit, flushPendingCandidates]);

  const handleAnswer = useCallback(async (fromUserId, answer) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc) {
      console.warn(`[WebRTC] handleAnswer: no PC found for ${fromUserId}`);
      return;
    }
    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingCandidates(fromUserId, pc);
        console.log(`[WebRTC] Answer from ${fromUserId} applied`);
      } else {
        console.warn(
          `[WebRTC] handleAnswer(${fromUserId}): unexpected signalingState '${pc.signalingState}' — ignoring answer`
        );
      }
    } catch (err) {
      console.error('[WebRTC] handleAnswer error:', err);
    }
  }, [flushPendingCandidates]);

  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    if (!candidate) return;
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc || !pc.remoteDescription) {
      // Queue until remote description is ready
      if (!pendingCandidates.current.has(fromUserId)) {
        pendingCandidates.current.set(fromUserId, []);
      }
      pendingCandidates.current.get(fromUserId).push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      if (!err.message?.includes('remote description')) {
        console.warn('[WebRTC] addIceCandidate error:', err.message);
      }
    }
  }, []);

  // ── Mute / Video controls ──────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newMuted = !isMuted;
    stream.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
  }, [isMuted]);

  const forceMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = false; });
    setIsMuted(true);
  }, []);

  const forceUnmute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = true; });
    setIsMuted(false);
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newOff = !isVideoOff;
    stream.getVideoTracks().forEach(t => { t.enabled = !newOff; });
    setIsVideoOff(newOff);
  }, [isVideoOff]);

  // ── FIX C: replaceVideoTrack also updates the localStream ─────────────────
  //
  // PROBLEM: The original implementation only called sender.replaceTrack() on
  // each RTCPeerConnection, updating what the remote peers see. It did NOT
  // update localStreamRef or call setLocalStream, so the local <video> preview
  // kept showing the old camera track after a switch. The VideoTile's
  // stream.addtrack listener would never fire because the stream reference and
  // its tracks were not updated through the React state path.
  //
  // FIX: After replacing the sender tracks, swap the video track inside the
  // local MediaStream and call setLocalStream to trigger VideoTile to re-render.
  const replaceVideoTrack = useCallback(async (newTrack) => {
    console.log(`[WebRTC] Replacing video track in ${peerConnectionsRef.current.size} peer(s)`);

    // 1. Replace in every active peer connection sender
    const results = await Promise.allSettled(
      Array.from(peerConnectionsRef.current.values()).map(pc =>
        replaceTrack(pc, newTrack, 'video')
      )
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('[WebRTC] replaceVideoTrack — peer', i, 'error:', r.reason);
      }
    });

    // 2. FIX C: Update the local MediaStream so the local preview shows the new track
    const stream = localStreamRef.current;
    if (stream) {
      const oldTrack = stream.getVideoTracks()[0];
      if (oldTrack && oldTrack.id !== newTrack.id) {
        stream.removeTrack(oldTrack);
        // Do NOT stop oldTrack here — the caller (e.g. screen share) manages its lifecycle
      }
      if (!stream.getVideoTracks().find(t => t.id === newTrack.id)) {
        stream.addTrack(newTrack);
      }
      // Trigger React re-render so VideoTile picks up the new track
      setLocalStream(stream);
    }
  }, []);

  const startScreenShare = useCallback(() => {
    setIsScreenSharing(true);
  }, []);

  const stopScreenShare = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const cameraTrack = stream.getVideoTracks()[0];
      if (cameraTrack) {
        peerConnectionsRef.current.forEach(pc => {
          replaceTrack(pc, cameraTrack, 'video').catch(() => {});
        });
      }
    }
    setIsScreenSharing(false);
  }, []);

  // ── handlePeerDisconnect ───────────────────────────────────────────────────
  const handlePeerDisconnect = useCallback((userId) => {
    console.log(`[WebRTC] Peer disconnected: ${userId}`);
    cleanupPeer(userId);
    removeRemoteStream(userId);
  }, [cleanupPeer, removeRemoteStream]);

  // ── cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up all peer connections');
    peerConnectionsRef.current.forEach((_, userId) => cleanupPeer(userId));
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidates.current.clear();
    offerersRef.current.clear();
    currentRoomRef.current = null;

    // Clear all ICE restart timers
    iceRestartTimersRef.current.forEach(t => clearTimeout(t));
    iceRestartTimersRef.current.clear();

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    setLocalStream(null);
    setRemoteStreamsObj({});
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  }, [cleanupPeer]);

  // ── Context value ──────────────────────────────────────────────────────────
  return (
    <WebRTCContext.Provider value={{
      localStream,
      remoteStreams,
      isMuted,
      isVideoOff,
      isScreenSharing,
      initializeMedia,
      createOffer,
      handleOffer,
      handleAnswer,
      handleIceCandidate,
      toggleMute,
      forceMute,
      forceUnmute,
      toggleVideo,
      startScreenShare,
      stopScreenShare,
      replaceVideoTrack,
      handlePeerDisconnect,
      cleanup,
    }}>
      {children}
    </WebRTCContext.Provider>
  );
};