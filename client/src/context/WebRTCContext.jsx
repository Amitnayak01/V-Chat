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

// ─────────────────────────────────────────────────────────────────────────────
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
  const peerConnectionsRef = useRef(new Map()); // userId → RTCPeerConnection
  const remoteStreamsRef   = useRef(new Map()); // userId → MediaStream  (source of truth)
  const localStreamRef     = useRef(null);
  const myUserIdRef        = useRef(null);
  const pendingCandidates  = useRef(new Map()); // userId → RTCIceCandidate[]

  // ── Derived: expose remoteStreams as Map ───────────────────────────────────
  // Build Map from state — exclude the internal _ts timestamp key
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
    for (const candidate of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    }
    pendingCandidates.current.delete(userId);
  }, []);

  // ── createPeer ─────────────────────────────────────────────────────────────
  const createPeer = useCallback((userId) => {
    // Close stale connection
    const existing = peerConnectionsRef.current.get(userId);
    if (existing) {
      existing.ontrack                    = null;
      existing.onicecandidate             = null;
      existing.onconnectionstatechange    = null;
      existing.oniceconnectionstatechange = null;
      existing.close();
      peerConnectionsRef.current.delete(userId);
    }

    const pc = new RTCPeerConnection(WEBRTC_CONFIG);

    // ── Add local tracks ──────────────────────────────────────────────────
    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // ── Incoming remote tracks ────────────────────────────────────────────
    pc.ontrack = ({ track, streams }) => {
      console.log(`[WebRTC] ontrack from ${userId}: kind=${track.kind} id=${track.id} streams=${streams?.length}`);

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
        addIfMissing(track);
      }

      publishStream(userId, peerStream);

      track.onended  = () => publishStream(userId, peerStream);
      track.onmute   = () => publishStream(userId, peerStream);
      track.onunmute = () => {
        console.log(`[WebRTC] track unmuted from ${userId}: kind=${track.kind}`);
        publishStream(userId, peerStream);
      };
    };

    // ── ICE ───────────────────────────────────────────────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) emit('webrtc-ice-candidate', { candidate, to: userId });
    };

    // ── Connection lifecycle ──────────────────────────────────────────────
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] connection state with ${userId}: ${state}`);
      if (state === 'failed' || state === 'closed') {
        if (peerConnectionsRef.current.get(userId) === pc) {
          removeRemoteStream(userId);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log(`[WebRTC] ICE state with ${userId}: ${iceState}`);
      if (iceState === 'failed') {
        console.log(`[WebRTC] ICE failed with ${userId} — restarting ICE`);
        pc.restartIce?.();
      }
      if (iceState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log(`[WebRTC] ICE still disconnected with ${userId} — restarting ICE`);
            pc.restartIce?.();
          }
        }, 4000);
      }
    };

    peerConnectionsRef.current.set(userId, pc);
    return pc;
  }, [emit, publishStream, removeRemoteStream]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const initializeMedia = useCallback(async (userId) => {
    myUserIdRef.current = userId;
    const { stream, error } = await getUserMedia(MEDIA_CONSTRAINTS);
    if (error || !stream) return { success: false, error };
    localStreamRef.current = stream;
    setLocalStream(stream);
    return { success: true };
  }, []);

  const offerInProgressRef = useRef(new Set());

  const createOffer = useCallback(async (userId, roomId) => {
    if (offerInProgressRef.current.has(userId)) {
      console.log('[WebRTC] createOffer: already in progress for', userId, '— skipping');
      return;
    }
    offerInProgressRef.current.add(userId);

    if (!localStreamRef.current) {
      let waited = 0;
      await new Promise(resolve => {
        const check = setInterval(() => {
          waited += 100;
          if (localStreamRef.current || waited >= 5000) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    const stalePc = peerConnectionsRef.current.get(userId);
    if (stalePc) {
      console.log('[WebRTC] createOffer: closing stale peer for', userId);
      stalePc.ontrack                    = null;
      stalePc.onicecandidate             = null;
      stalePc.onconnectionstatechange    = null;
      stalePc.oniceconnectionstatechange = null;
      try { stalePc.close(); } catch (_) {}
      peerConnectionsRef.current.delete(userId);
      pendingCandidates.current.delete(userId);
      removeRemoteStream(userId);
    }

    const pc = createPeer(userId);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      emit('webrtc-offer', { offer, to: userId, from: myUserIdRef.current, roomId });
    } catch (err) {
      console.error('[WebRTC] createOffer:', err);
    } finally {
      offerInProgressRef.current.delete(userId);
    }
  }, [createPeer, emit, removeRemoteStream]);

  const handleOffer = useCallback(async (fromUserId, roomId, offer) => {
    const existingPc = peerConnectionsRef.current.get(fromUserId);

    if (existingPc) {
      const connState = existingPc.connectionState;
      const iceState  = existingPc.iceConnectionState;
      const isDead    = ['disconnected', 'failed', 'closed'].includes(connState)
                     || ['disconnected', 'failed', 'closed'].includes(iceState);

      if (isDead) {
        console.log('[WebRTC] handleOffer: replacing dead peer for', fromUserId);
        existingPc.ontrack                    = null;
        existingPc.onicecandidate             = null;
        existingPc.onconnectionstatechange    = null;
        existingPc.oniceconnectionstatechange = null;
        try { existingPc.close(); } catch (_) {}
        peerConnectionsRef.current.delete(fromUserId);
        pendingCandidates.current.delete(fromUserId);
        removeRemoteStream(fromUserId);

      } else if (existingPc.signalingState === 'have-local-offer') {
        if (myUserIdRef.current < fromUserId) {
          console.log('[WebRTC] Glare — backing off, accepting remote offer');
          existingPc.close();
          peerConnectionsRef.current.delete(fromUserId);
        } else {
          console.log('[WebRTC] Glare — keeping our offer, ignoring remote');
          return;
        }
      }
    }

    if (!localStreamRef.current) {
      console.log('[WebRTC] handleOffer: waiting for local media...');
      let waited = 0;
      await new Promise(resolve => {
        const check = setInterval(() => {
          waited += 100;
          if (localStreamRef.current || waited >= 5000) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

  // ✅ FIX: abort if media never arrived instead of creating trackless peer
if (!localStreamRef.current) {
  console.error('[WebRTC] handleOffer: local media unavailable after 5s — aborting');
  return;
}
// Abort if media never became available — prevents trackless peer connections
if (!localStreamRef.current) {
  console.error('[WebRTC] handleOffer: no local stream after wait — aborting');
  return;
}

const pc = createPeer(fromUserId);
try {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

      await flushPendingCandidates(fromUserId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('webrtc-answer', { answer, to: fromUserId, from: myUserIdRef.current, roomId });
    } catch (err) {
      console.error('[WebRTC] handleOffer:', err);
    }
  }, [createPeer, emit, flushPendingCandidates, removeRemoteStream]);

  const handleAnswer = useCallback(async (fromUserId, answer) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc) return;
    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingCandidates(fromUserId, pc);
        setTimeout(() => flushPendingCandidates(fromUserId, pc), 0);
      }
    } catch (err) {
      console.error('[WebRTC] handleAnswer:', err);
    }
  }, [flushPendingCandidates]);

  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    if (!candidate) return;
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc || !pc.remoteDescription) {
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
        console.warn('[WebRTC] addIceCandidate:', err);
      }
    }
  }, []);

  // ── Mute controls ──────────────────────────────────────────────────────────

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

  const replaceVideoTrack = useCallback(async (newTrack) => {
    const results = await Promise.allSettled(
      Array.from(peerConnectionsRef.current.values()).map(pc =>
        replaceTrack(pc, newTrack, 'video')
      )
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('[WebRTC] replaceVideoTrack peer', i, r.reason);
      }
    });
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

  const handlePeerDisconnect = useCallback((userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.ontrack                    = null;
      pc.onicecandidate             = null;
      pc.onconnectionstatechange    = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    pendingCandidates.current.delete(userId);
    offerInProgressRef.current.delete(userId);
    removeRemoteStream(userId);
  }, [removeRemoteStream]);

  // ── FIX: expose signalingState so callers can detect in-progress negotiations ──
  const getPeerState = useCallback((userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (!pc) return null;
    return {
      connectionState:    pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState:     pc.signalingState,   // ← NEW: needed to detect live negotiations
    };
  }, []);

  const cleanup = useCallback(() => {
    peerConnectionsRef.current.forEach(pc => {
      pc.ontrack                    = null;
      pc.onicecandidate             = null;
      pc.onconnectionstatechange    = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidates.current.clear();
    offerInProgressRef.current.clear();

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    myUserIdRef.current = null;

    setLocalStream(null);
    setRemoteStreamsObj({});
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  }, []);

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
      getPeerState,
    }}>
      {children}
    </WebRTCContext.Provider>
  );
};