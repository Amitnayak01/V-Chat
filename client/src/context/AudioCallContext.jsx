/**
 * AudioCallContext.jsx  (v2 — group-call reliability)
 * ─────────────────────────────────────────────────────
 *
 * All original features preserved 100%.  Only the WebRTC negotiation
 * layer was changed.  See inline [FIX *] tags for every change.
 *
 * CHANGES vs original
 * ───────────────────
 * [FIX CRITICAL-2]  Perfect negotiation (RFC 8829 §4.1.1)
 *   makingOfferRef — per-peer Map<userId,boolean> that is true while we
 *     have created an offer but not yet received the answer.
 *   isPolitePeer() — deterministic: peer with the LOWER userId string is
 *     "polite" (will rollback on collision). Impolite peer ignores incoming
 *     offers during glare. This fixes the 1:1→group upgrade race where both
 *     peers simultaneously createOffer for each other → InvalidStateError.
 *
 * [FIX CRITICAL-3]  handleAudioOffer reuses an existing PeerConnection when
 *   possible instead of always destroying it.  createAudioPeer is only
 *   called from the offerer side (createAudioOffer) and from the responder
 *   when no live peer exists for that userId yet.
 *
 * [FIX HIGH-4]  Parallel offer creation in onAudioRoomJoined.
 *   Was:  `for (const p of existing) await createAudioOffer(p.userId)`
 *   Now:  `await Promise.all(existing.map(p => createAudioOffer(p.userId)))`
 *
 * [FIX HIGH-5]  makingOffer guard in createAudioOffer prevents duplicate
 *   offers if onAudioRoomJoined fires twice on a rapid reconnect.
 *
 * [FIX MEDIUM-7]  Ended tracks are purged from the remote MediaStream before
 *   new tracks are added in the ontrack handler.
 *
 * [FIX MEDIUM-8]  makingOfferRef cleared in fullCleanup, peer recreation,
 *   and handleAudioAnswer so a stale makingOffer=true never blocks future
 *   offers permanently.
 *
 * [FIX LOW-9]   pendingCandidates cleaned up in onUserLeftAudio.
 * [FIX LOW-10]  flushPendingCandidates called after setRemoteDescription in
 *   handleAudioAnswer so ICE candidates queued before the answer arrives are
 *   not permanently lost.
 */

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { WEBRTC_CONFIG } from '../utils/webrtc';
import { saveCallRecord } from '../utils/callHistoryStore';
import { SoundEngine } from '../utils/SoundEngine';
import { readSoundSettings } from '../hooks/useSoundSettings';

const AudioCallContext = createContext(null);

export const useAudioCall = () => {
  const ctx = useContext(AudioCallContext);
  if (!ctx) throw new Error('useAudioCall must be used within AudioCallProvider');
  return ctx;
};

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl:  true,
    sampleRate:       48000,
    channelCount:     1,
  },
  video: false,
};

export const AudioCallProvider = ({ children }) => {
  const { socket, emit } = useSocket();
  const { user }         = useAuth();

  const [callState,      setCallState]      = useState('idle');
  const [incomingCall,   setIncomingCall]   = useState(null);
  const [activeCall,     setActiveCall]     = useState(null);
  const [localStream,    setLocalStream]    = useState(null);
  const [remoteStreams,  setRemoteStreams]   = useState(new Map());
  const [isMuted,        setIsMuted]        = useState(false);
  const [callDuration,   setCallDuration]   = useState(0);
  const [participants,   setParticipants]   = useState([]);
  const [callStatus,     setCallStatus]     = useState('');

  // ── Core refs ───────────────────────────────────────────────────────────────
  const peerConnectionsRef = useRef(new Map());
  const localStreamRef     = useRef(null);
  const pendingCandidates  = useRef(new Map());
  const callTimerRef       = useRef(null);
  const remoteStreamsRef   = useRef(new Map());

  // ── Call history tracking refs ──────────────────────────────────────────────
  const callDirectionRef  = useRef(null);  // 'outgoing' | 'incoming'
  const callAcceptedRef   = useRef(false);
  const callRejectedRef   = useRef(false);
  const callPeerRef       = useRef(null);  // { id, name, avatar }
  const callDurationRef   = useRef(0);
  const callStateRef      = useRef('idle');
  const activeCallRef     = useRef(null);
  const callIdRef         = useRef(null);
  const incomingCallRef   = useRef(null);

  // ── Group call history tracking refs ──────────────────────────────────────
  const callIsGroupRef           = useRef(false);
  const callRoomIdRef            = useRef(null);
  /** Peak participant snapshot updated on every join/leave — saved to history. */
  const callGroupParticipantsRef = useRef([]);

  // ── [FIX CRITICAL-2]  Per-peer making-offer tracking ───────────────────────
  /**
   * Map<peerId, boolean>
   * true  = we have sent an offer and are waiting for an answer.
   * false = idle / answer received.
   *
   * The polite-peer uses this to detect offer collisions and roll back.
   * The impolite-peer uses this to ignore the incoming offer on collision.
   */
  const makingOfferRef = useRef(new Map());

  useEffect(() => { callStateRef.current    = callState;   }, [callState]);
  useEffect(() => { activeCallRef.current   = activeCall;  }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall;}, [incomingCall]);
  useEffect(() => { callDurationRef.current = callDuration;}, [callDuration]);

  // ── Ringtone — delegates to SoundEngine ─────────────────────────────────────
  const startRinging = useCallback(() => {
    const s = readSoundSettings();
    SoundEngine.playRingtone(s.audioCall.ringtone, s.audioCall.volume);
    if (s.audioCall.vibration) SoundEngine.vibrate([300, 150, 300]);
  }, []);

  const stopRinging = useCallback(() => SoundEngine.stopRingtone(), []);

  // ── Timer ────────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(callTimerRef.current);
    callTimerRef.current = null;
    setCallDuration(0);
  }, []);

  // ── Remote stream helpers ────────────────────────────────────────────────────
  const publishRemoteStream = useCallback((userId, stream) => {
    remoteStreamsRef.current.set(userId, stream);
    setRemoteStreams(new Map(remoteStreamsRef.current));
  }, []);

  const removeRemoteStream = useCallback((userId) => {
    remoteStreamsRef.current.delete(userId);
    setRemoteStreams(new Map(remoteStreamsRef.current));
  }, []);

  // ── ICE candidate queue flush ────────────────────────────────────────────────
  const flushPendingCandidates = useCallback(async (userId, pc) => {
    const queue = pendingCandidates.current.get(userId) ?? [];
    for (const c of queue) {
      try {
        if (c) await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (_) {/* stale candidate — ignore */}
    }
    pendingCandidates.current.delete(userId);
  }, []);

  // ── [FIX CRITICAL-2]  Polite-peer determination ─────────────────────────────
  /**
   * Returns true if WE are the "polite" peer for the given remote userId.
   *
   * Polite peer   → rolls back its own offer when a collision is detected,
   *                  then accepts and answers the remote offer.
   * Impolite peer → ignores the incoming offer during a collision;
   *                  its own offer (already in flight) takes priority.
   *
   * The rule is deterministic: lexicographically lower userId is polite.
   * Both sides use the same userId strings from the same auth system, so
   * they always agree on who is polite without any extra signaling.
   */
  const isPolitePeer = useCallback(
    (peerId) => (user?._id ?? '') < peerId,
    [user?._id],
  );

  // ── createAudioPeer ──────────────────────────────────────────────────────────
  /**
   * Creates (or replaces) the RTCPeerConnection for `userId`.
   *
   * Should only be called from createAudioOffer (the offerer side).
   * handleAudioOffer (responder) reuses existing peers — see [FIX CRITICAL-3].
   *
   * [FIX MEDIUM-8]  Resets makingOfferRef so a stale `true` from a prior
   * failed negotiation can never permanently block new offers.
   */
  const createAudioPeer = useCallback(
    (userId) => {
      const existing = peerConnectionsRef.current.get(userId);
      if (existing) {
        existing.ontrack                    = null;
        existing.onicecandidate             = null;
        existing.onconnectionstatechange    = null;
        existing.oniceconnectionstatechange = null;
        existing.close();
        peerConnectionsRef.current.delete(userId);
      }

      // [FIX MEDIUM-8]  Reset so we are never stuck with makingOffer=true
      makingOfferRef.current.set(userId, false);

      const pc = new RTCPeerConnection(WEBRTC_CONFIG);

      // Add local audio tracks to the new peer
      const stream = localStreamRef.current;
      if (stream) stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));

      // ── ontrack ─────────────────────────────────────────────────────────────
      pc.ontrack = ({ track, streams }) => {
        let peerStream = remoteStreamsRef.current.get(userId);
        if (!peerStream) {
          peerStream = new MediaStream();
          remoteStreamsRef.current.set(userId, peerStream);
        }

        // [FIX MEDIUM-7]  Remove ended tracks before adding new ones so we
        // don't accumulate silent ended tracks after peer reconnections.
        peerStream
          .getTracks()
          .filter((t) => t.readyState === 'ended')
          .forEach((t) => peerStream.removeTrack(t));

        const addIfMissing = (t) => {
          if (!peerStream.getTracks().find((e) => e.id === t.id))
            peerStream.addTrack(t);
        };
        if (streams?.[0]) streams[0].getTracks().forEach(addIfMissing);
        else addIfMissing(track);

        publishRemoteStream(userId, peerStream);
      };

      // ── onicecandidate ───────────────────────────────────────────────────────
      pc.onicecandidate = ({ candidate }) => {
        // Note: candidate is null when ICE gathering completes.
        // We forward null too so the remote side can call addIceCandidate(null)
        // if it wishes.  The receiving handleAudioIce guards against null.
        emit('audio-webrtc-ice', { candidate, to: userId, from: user?._id });
      };

      // ── onconnectionstatechange ──────────────────────────────────────────────
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('connected');
          callStateRef.current = 'connected';
          setCallStatus('');
          if (!callTimerRef.current) startTimer();
        }
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          removeRemoteStream(userId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') pc.restartIce?.();
      };

      peerConnectionsRef.current.set(userId, pc);
      return pc;
    },
    [emit, user, publishRemoteStream, removeRemoteStream, startTimer],
  );

  // ── createAudioOffer ─────────────────────────────────────────────────────────
  /**
   * Creates a fresh peer connection and sends an SDP offer to `userId`.
   *
   * [FIX HIGH-5]    makingOffer guard: returns early if we are already
   *   in the middle of negotiating with this peer to prevent the second call
   *   from destroying the first peer mid-flight.
   *
   * [FIX CRITICAL-2]  Sets makingOfferRef=true before createOffer() so that
   *   handleAudioOffer on both sides can detect the glare condition and apply
   *   the polite/impolite rule.  Cleared when the answer arrives (or on error).
   */
  const createAudioOffer = useCallback(
    async (userId) => {
      // [FIX HIGH-5]  Bail if negotiation with this peer is already underway
      if (makingOfferRef.current.get(userId)) {
        console.warn(`[AudioCall] createAudioOffer: already making offer to ${userId}`);
        return;
      }

      // Offerer always starts with a fresh RTCPeerConnection
      const pc = createAudioPeer(userId);
      makingOfferRef.current.set(userId, true);

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });

        // Defensive: another async event might have changed state while we
        // awaited createOffer (JS event loop can interleave microtasks).
        if (pc.signalingState !== 'stable') {
          console.warn(
            `[AudioCall] createAudioOffer: state=${pc.signalingState} after createOffer — aborting`,
          );
          makingOfferRef.current.set(userId, false);
          return;
        }

        await pc.setLocalDescription(offer);
        emit('audio-webrtc-offer', { offer: pc.localDescription, to: userId, from: user?._id });
      } catch (err) {
        console.error('[AudioCall] createAudioOffer:', err);
        makingOfferRef.current.set(userId, false);
      }
      // makingOffer stays true until handleAudioAnswer clears it.
    },
    [createAudioPeer, emit, user],
  );

  // ── handleAudioOffer ─────────────────────────────────────────────────────────
  /**
   * Handles an incoming SDP offer from `fromUserId`.
   *
   * [FIX CRITICAL-3]  Reuses the existing RTCPeerConnection when possible.
   *   The original always called createAudioPeer() here, closing any live
   *   connection mid-negotiation.  We only create a new peer when none exists
   *   or the existing one is irrecoverably failed/closed.
   *
   * [FIX CRITICAL-2]  Perfect negotiation:
   *   offerCollision = we are currently making an offer  OR  state ≠ stable.
   *   IMPOLITE + collision → ignore incoming offer (our offer wins).
   *   POLITE   + collision → rollback our offer, accept theirs.
   */
  const handleAudioOffer = useCallback(
    async (fromUserId, offer) => {
      // [FIX CRITICAL-3]  Reuse existing peer unless it is unrecoverable
      let pc = peerConnectionsRef.current.get(fromUserId);
      if (
        !pc ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        pc = createAudioPeer(fromUserId);
      }

      // [FIX CRITICAL-2]  Collision detection
      const making        = makingOfferRef.current.get(fromUserId) ?? false;
      const offerCollision = making || pc.signalingState !== 'stable';
      const polite        = isPolitePeer(fromUserId);

      if (!polite && offerCollision) {
        // Impolite peer: our offer takes priority — silently drop theirs.
        console.warn(
          `[AudioCall] handleAudioOffer: impolite peer dropping collision from ${fromUserId}`,
        );
        return;
      }

      try {
        if (offerCollision) {
          // Polite peer: rollback our offer, then accept theirs.
          console.info(
            `[AudioCall] handleAudioOffer: polite peer rolling back for ${fromUserId}`,
          );
          await pc.setLocalDescription({ type: 'rollback' });
          makingOfferRef.current.set(fromUserId, false);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // [FIX LOW-10]  Flush ICE candidates that may have arrived before offer
        await flushPendingCandidates(fromUserId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        emit('audio-webrtc-answer', {
          answer: pc.localDescription,
          to:     fromUserId,
          from:   user?._id,
        });
      } catch (err) {
        console.error('[AudioCall] handleAudioOffer:', err);
      }
    },
    [createAudioPeer, emit, user, flushPendingCandidates, isPolitePeer],
  );

  // ── handleAudioAnswer ────────────────────────────────────────────────────────
  /**
   * [FIX MEDIUM-8]  Clears the making-offer flag once the answer is set.
   * [FIX LOW-10]    Flushes pending ICE candidates after setRemoteDescription.
   */
  const handleAudioAnswer = useCallback(
    async (fromUserId, answer) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) return;

      // Always clear — even if setRemoteDescription throws below
      makingOfferRef.current.set(fromUserId, false);

      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // [FIX LOW-10]  Flush candidates queued before the answer arrived
          await flushPendingCandidates(fromUserId, pc);
        }
      } catch (err) {
        console.error('[AudioCall] handleAudioAnswer:', err);
      }
    },
    [flushPendingCandidates],
  );

  // ── handleAudioIce ───────────────────────────────────────────────────────────
  const handleAudioIce = useCallback(async (fromUserId, candidate) => {
    // [FIX CRITICAL-1 client guard]  fromUserId is undefined when the server
    // doesn't forward the `from` field — drop silently with a warning.
    if (!fromUserId) {
      console.warn('[AudioCall] handleAudioIce: fromUserId is undefined (server ICE routing bug)');
      return;
    }

    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc?.remoteDescription) {
      // Queue until remote description is set
      if (!pendingCandidates.current.has(fromUserId))
        pendingCandidates.current.set(fromUserId, []);
      pendingCandidates.current.get(fromUserId).push(candidate);
      return;
    }

    try {
      // null candidate = end-of-gathering signal; silently skip.
      if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {/* stale candidate after ICE restart — ignore */}
  }, []);

  // ── Audio device helpers ─────────────────────────────────────────────────────
  const acquireAudio = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const releaseAudio = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  // ── fullCleanup ──────────────────────────────────────────────────────────────
  /**
   * [FIX MEDIUM-8]  Clears makingOfferRef so no peer is permanently locked
   * after a cleanup cycle.
   */
  const fullCleanup = useCallback(() => {
    // ── Persist call record ──────────────────────────────────────────────────
    if (callPeerRef.current && callDirectionRef.current) {
      const dir      = callDirectionRef.current;
      const accepted = callAcceptedRef.current;
      const rejected = callRejectedRef.current;
      const dur      = callDurationRef.current;
      const type     = dir === 'incoming' && !accepted ? 'missed' : dir;
      const status   = accepted ? 'completed' : rejected ? 'rejected' : 'missed';

      saveCallRecord({
        peerId:       callPeerRef.current.id,
        peerName:     callPeerRef.current.name,
        peerAvatar:   callPeerRef.current.avatar,
        type,
        status,
        duration:     dur,
        timestamp:    new Date().toISOString(),
        // Group call extras (undefined for 1:1 calls — ignored by store)
        isGroup:      callIsGroupRef.current || undefined,
        roomId:       callRoomIdRef.current  || undefined,
        participants: callIsGroupRef.current
          ? callGroupParticipantsRef.current.slice()   // snapshot
          : undefined,
      });
    }

    // Snapshot group-call flag BEFORE resetting it (used for auto-refresh below)
    const wasGroupCall = callIsGroupRef.current;

    // Reset history refs
    callDirectionRef.current       = null;
    callAcceptedRef.current        = false;
    callRejectedRef.current        = false;
    callPeerRef.current            = null;
    callDurationRef.current        = 0;
    callIsGroupRef.current         = false;
    callRoomIdRef.current          = null;
    callGroupParticipantsRef.current = [];

    // [FIX MEDIUM-8]  Clear all making-offer flags
    makingOfferRef.current.clear();

    stopRinging();
    stopTimer();
    releaseAudio();

    peerConnectionsRef.current.forEach((pc) => {
      pc.ontrack                    = null;
      pc.onicecandidate             = null;
      pc.onconnectionstatechange    = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidates.current.clear();

    setRemoteStreams(new Map());
    setCallState('idle');
    setIncomingCall(null);
    setActiveCall(null);
    setIsMuted(false);
    setParticipants([]);
    setCallStatus('');

    callIdRef.current       = null;
    callStateRef.current    = 'idle';
    activeCallRef.current   = null;
    incomingCallRef.current = null;

    // Auto-refresh after a group call ends so all stale WebRTC/socket state
    // is fully wiped — prevents the "new call collapses immediately" bug.
    if (wasGroupCall) {
      setTimeout(() => window.location.reload(), 300);
    }
  }, [stopRinging, stopTimer, releaseAudio]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  const initiateCall = useCallback(
    async (receiverId, receiverName, receiverAvatar) => {
      if (callStateRef.current !== 'idle') return;
      try {
        callDirectionRef.current = 'outgoing';
        callAcceptedRef.current  = false;
        callRejectedRef.current  = false;
        callPeerRef.current      = { id: receiverId, name: receiverName, avatar: receiverAvatar };

        setCallState('calling');
        callStateRef.current = 'calling';
        setCallStatus('Ringing…');

        // Set a unique sentinel immediately so stale events from a previous
        // call (which carry an old callId) are blocked during the window
        // before the server responds with onAudioCallInitiated.
        callIdRef.current = `pending_${Date.now()}`;

        const callData = { peerId: receiverId, peerName: receiverName, peerAvatar: receiverAvatar, isGroup: false };
        setActiveCall(callData);
        activeCallRef.current = callData;

        await acquireAudio();
        startRinging();

        emit('audio-call-user', {
          callerId:     user._id,
          receiverId,
          callerName:   user.username,
          callerAvatar: user.avatar,
        });
      } catch (err) {
        console.error('[AudioCall] initiateCall error:', err);
        fullCleanup();
        throw err;
      }
    },
    [acquireAudio, startRinging, emit, user, fullCleanup],
  );

  const acceptCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;
    try {
      stopRinging();

      // Group invite — join the room directly
      if (incoming.isGroupInvite && incoming.roomId) {
        await acquireAudio();
        callAcceptedRef.current  = true;
        callIsGroupRef.current   = true;
        callRoomIdRef.current    = incoming.roomId;

        const callData = {
          callId:     incoming.callId,
          peerId:     null,
          peerName:   `${incoming.callerName}'s call`,
          peerAvatar: incoming.callerAvatar,
          isGroup:    true,
          roomId:     incoming.roomId,
        };
        setActiveCall(callData);
        activeCallRef.current   = callData;
        callIdRef.current       = incoming.callId;
        setCallState('connecting');
        callStateRef.current    = 'connecting';
        setIncomingCall(null);
        incomingCallRef.current = null;

        emit('audio-call-accepted', { callId: incoming.callId, callerId: incoming.callerId });
        emit('join-audio-room', { roomId: incoming.roomId, userId: user._id, username: user.username, avatar: user.avatar });
        return;
      }

      // 1:1 accept
      setCallStatus('Connecting…');
      await acquireAudio();

      callDirectionRef.current = 'incoming';
      callAcceptedRef.current  = true;

      const callData = {
        callId:     incoming.callId,
        peerId:     incoming.callerId,
        peerName:   incoming.callerName,
        peerAvatar: incoming.callerAvatar,
        isGroup:    false,
      };
      setActiveCall(callData);
      activeCallRef.current   = callData;
      callIdRef.current       = incoming.callId;
      setCallState('connecting');
      callStateRef.current    = 'connecting';
      setIncomingCall(null);
      incomingCallRef.current = null;

      emit('audio-call-accepted', { callId: incoming.callId, callerId: incoming.callerId });
    } catch (err) {
      console.error('[AudioCall] acceptCall error:', err);
      fullCleanup();
      throw err;
    }
  }, [stopRinging, acquireAudio, emit, user, fullCleanup]);

  const rejectCall = useCallback(() => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;
    stopRinging();
    emit('audio-call-rejected', { callId: incoming.callId, callerId: incoming.callerId });
    fullCleanup();
  }, [stopRinging, emit, fullCleanup]);

  const endCall = useCallback(() => {
    const call = activeCallRef.current;
    if (!call) { fullCleanup(); return; }
    if (call.isGroup) {
      emit('leave-audio-room', { roomId: call.roomId, userId: user?._id });
    } else {
      emit('audio-call-ended', { callId: callIdRef.current, peerId: call.peerId });
    }
    fullCleanup();
  }, [emit, user, fullCleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setIsMuted(next);
  }, [isMuted]);

  const joinAudioRoom = useCallback(
    async (roomId, roomName) => {
      if (callStateRef.current !== 'idle') return;
      try {
        setCallState('connecting');
        callStateRef.current = 'connecting';
        setCallStatus('Joining…');
        await acquireAudio();
        callIsGroupRef.current = true;
        callRoomIdRef.current  = roomId;
        // Ensure fullCleanup saves a history record for room joins
        if (!callPeerRef.current) {
          callPeerRef.current      = { id: null, name: roomName, avatar: null };
          callDirectionRef.current = callDirectionRef.current ?? 'outgoing';
          callAcceptedRef.current  = true;
        }
        const callData = { peerId: null, peerName: roomName, isGroup: true, roomId };
        setActiveCall(callData);
        activeCallRef.current = callData;
        emit('join-audio-room', { roomId, userId: user._id, username: user.username, avatar: user.avatar });
      } catch (err) {
        console.error('[AudioCall] joinAudioRoom error:', err);
        fullCleanup();
        throw err;
      }
    },
    [acquireAudio, emit, user, fullCleanup],
  );

  const inviteToCall = useCallback(
    async (contactId, contactName, contactAvatar) => {
      const call = activeCallRef.current;
      if (!call) return;

      const roomId =
        call.roomId ||
        `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      if (!call.isGroup) {
        emit('upgrade-call-to-group', { peerId: call.peerId, roomId, initiatorId: user._id });
        const upgraded = { ...call, isGroup: true, roomId, peerName: 'Group Call' };
        setActiveCall(upgraded);
        activeCallRef.current  = upgraded;
        callIsGroupRef.current = true;
        callRoomIdRef.current  = roomId;
        emit('join-audio-room', { roomId, userId: user._id, username: user.username, avatar: user.avatar });
      }

      emit('invite-to-group-call', {
        inviterId:    user._id,
        inviteeId:    contactId,
        inviterName:  user.username,
        inviterAvatar: user.avatar,
        roomId,
      });
    },
    [emit, user],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCKET EVENT HANDLERS
  // fn.current pattern: re-assigned every render so handlers always capture
  // the latest version of all callbacks without re-registering listeners.
  // ═══════════════════════════════════════════════════════════════════════════

  const fn = useRef({});
  fn.current = {

    onAudioCallUpgrade: ({ roomId, initiatorId }) => {
      const call = activeCallRef.current;
      if (!call) return;
      const upgraded = { ...call, isGroup: true, roomId, peerName: 'Group Call' };
      setActiveCall(upgraded);
      activeCallRef.current  = upgraded;
      callIsGroupRef.current = true;
      callRoomIdRef.current  = roomId;
      emit('join-audio-room', { roomId, userId: user?._id, username: user?.username, avatar: user?.avatar });
    },

    onIncomingAudioCall: ({ callId, callerId, callerName, callerAvatar, isGroupInvite, roomId }) => {
      if (callStateRef.current !== 'idle') {
        emit('audio-call-rejected', { callId, callerId });
        return;
      }
      const data = { callId, callerId, callerName, callerAvatar, isGroupInvite, roomId };
      setIncomingCall(data);
      incomingCallRef.current  = data;
      callPeerRef.current      = { id: callerId, name: callerName, avatar: callerAvatar };
      callDirectionRef.current = 'incoming';
      callAcceptedRef.current  = false;
      callRejectedRef.current  = false;
      callIdRef.current = callId;
      setCallState('incoming');
      callStateRef.current = 'incoming';
      startRinging();
    },

    onAudioCallInitiated: ({ callId }) => {
      callIdRef.current = callId;
      setActiveCall((prev) => (prev ? { ...prev, callId } : null));
      if (activeCallRef.current) activeCallRef.current.callId = callId;
    },

    onAudioCallAccepted: async ({ callId }) => {
      stopRinging();
      const call = activeCallRef.current;
      if (callStateRef.current !== 'connected') {
        setCallState('connecting');
        callStateRef.current = 'connecting';
        setCallStatus('Connecting…');
      }
      if (call && !call.isGroup) await createAudioOffer(call.peerId);
    },

    onAudioCallRejected: ({ callId } = {}) => {
      // Guard 1: group call — don't destroy it when an invite is declined.
      if (activeCallRef.current?.isGroup) {
        stopRinging();
        console.info('[AudioCall] group invite was declined — staying in call');
        return;
      }
      // Guard 2: stale event from a previous call.
      if (callId && callId !== callIdRef.current) {
        console.info('[AudioCall] ignoring stale audio-call-rejected for callId', callId);
        return;
      }
      callRejectedRef.current = true;
      stopRinging();
      fullCleanup();
    },

    onAudioCallEnded: ({ callId, reason } = {}) => {
      // Guard 1: if we're in a group call, stray 1:1 ended events must be ignored.
      if (activeCallRef.current?.isGroup) {
        console.info('[AudioCall] ignoring audio-call-ended while in group call, reason:', reason);
        return;
      }
      // Guard 2: if the callId doesn't match our current call, it's a delayed
      // event from a previous call (e.g. the original 1:1 that was upgraded to
      // group, then the peer disconnected). Ignore it so the new call isn't killed.
      if (callId && callId !== callIdRef.current) {
        console.info('[AudioCall] ignoring stale audio-call-ended for callId', callId, '— current is', callIdRef.current);
        return;
      }
      stopRinging();
      fullCleanup();
    },

    onAudioCallFailed: () => {
      if (activeCallRef.current?.isGroup) return;
      stopRinging(); fullCleanup();
    },

    onAudioCallTimeout: ({ callId } = {}) => {
      // Group invite timed out — stay in the call.
      if (activeCallRef.current?.isGroup) {
        console.info('[AudioCall] group invite timed out — staying in call');
        return;
      }
      // Stale timeout from a previous call.
      if (callId && callId !== callIdRef.current) {
        console.info('[AudioCall] ignoring stale audio-call-timeout for callId', callId);
        return;
      }
      stopRinging(); fullCleanup();
    },

    onAudioCallBusy: () => {
      if (activeCallRef.current?.isGroup) {
        console.info('[AudioCall] group invite target was busy — staying in call');
        return;
      }
      stopRinging(); fullCleanup();
    },

    onAudioCallQueued: ({ callId }) => {
      callIdRef.current = callId;
      setActiveCall((prev) => (prev ? { ...prev, callId } : null));
      if (activeCallRef.current) activeCallRef.current.callId = callId;
      setCallStatus('Ringing (offline)…');
    },

    onAudioWebRTCOffer: async ({ offer, from }) => {
      if (!activeCallRef.current) return;
      await handleAudioOffer(from, offer);
    },

    onAudioWebRTCAnswer: async ({ answer, from }) => {
      if (!activeCallRef.current) return;
      await handleAudioAnswer(from, answer);
    },

    onAudioWebRTCIce: async ({ candidate, from }) => {
      if (!activeCallRef.current) return;
      await handleAudioIce(from, candidate);
    },

    /**
     * onAudioRoomJoined — fired when WE successfully join a room.
     *
     * [FIX HIGH-4]  Changed from sequential for-await to Promise.all so all
     * offers are sent in parallel.  With N existing participants the old code
     * completed offers one at a time; now all N fire simultaneously.
     *
     * Architecture note: the new joiner ALWAYS creates the offers.  Existing
     * participants only answer.  This gives us a clean offer-direction rule
     * that prevents glare except in the upgrade-to-group path (where perfect
     * negotiation handles it).
     */
    onAudioRoomJoined: async ({ roomId, participants: existing }) => {
      setParticipants(existing);
      // Snapshot for history — existing peers at join time
      callGroupParticipantsRef.current = existing.map((p) => ({
        userId:   p.userId,
        username: p.username,
        avatar:   p.avatar,
      }));
      callIsGroupRef.current = true;
      callRoomIdRef.current  = roomId;
      setCallState('connected');
      callStateRef.current = 'connected';
      setCallStatus('');
      if (!callTimerRef.current) startTimer();

      // [FIX HIGH-4]  Parallel offers
      if (existing.length > 0) {
        await Promise.all(existing.map((p) => createAudioOffer(p.userId)));
      }
    },

    /**
     * onUserJoinedAudio — fired when someone else joins the room we're in.
     *
     * We deliberately do NOT create an offer here.  The new joiner creates
     * offers to all of us (via their onAudioRoomJoined).  We wait for their
     * offer and answer it.  This is the correct full-mesh pattern:
     *   new-joiner → offer → existing member → answer → new-joiner.
     *
     * Perfect negotiation handles the edge case where both sides simultaneously
     * emit offers (upgrade path).
     */
    onUserJoinedAudio: ({ userId, username, avatar, allParticipants }) => {
      const others = allParticipants.filter((p) => p.userId !== user?._id);
      setParticipants(others);
      // Keep peak snapshot: merge new participant in, preserve existing entries
      const existing = callGroupParticipantsRef.current;
      if (!existing.find((p) => p.userId === userId)) {
        callGroupParticipantsRef.current = [
          ...existing,
          { userId, username, avatar },
        ];
      }
      // No peer creation here — we'll receive their offer shortly.
    },

    /**
     * onUserLeftAudio
     * [FIX LOW-9]   Clear pending ICE candidates for the departed peer.
     * [FIX MEDIUM-8] Clear making-offer flag.
     */
    onUserLeftAudio: ({ userId, roomId, allParticipants }) => {
      // Guard 1: only process when we are actually in a group call.
      if (!activeCallRef.current?.isGroup) {
        console.info('[AudioCall] ignoring stale user-left-audio — not in a group call');
        return;
      }
      // Guard 2: only process if the event is for our current room.
      if (roomId && activeCallRef.current?.roomId !== roomId) {
        console.info('[AudioCall] ignoring user-left-audio for wrong room', roomId);
        return;
      }

      // ── Last-person-standing check ────────────────────────────────────────
      // allParticipants is the authoritative server list AFTER the departure.
      // Filter out ourselves to see how many peers remain.
      const remainingPeers = allParticipants.filter((p) => p.userId !== user?._id);

      // If nobody else is left we are alone in the room — end the call for us too.
      if (remainingPeers.length === 0) {
        console.info('[AudioCall] last peer left the group call — ending call for self');
        // Clean up the departed peer's PC first so fullCleanup doesn't double-close
        const pc = peerConnectionsRef.current.get(userId);
        if (pc) {
          pc.ontrack = null; pc.onicecandidate = null;
          pc.onconnectionstatechange = null; pc.oniceconnectionstatechange = null;
          pc.close();
          peerConnectionsRef.current.delete(userId);
        }
        pendingCandidates.current.delete(userId);
        makingOfferRef.current.delete(userId);
        removeRemoteStream(userId);
        // Emit leave so the server cleans up the room too
        const call = activeCallRef.current;
        if (call?.roomId) emit('leave-audio-room', { roomId: call.roomId, userId: user?._id });
        fullCleanup();
        return;
      }

      setParticipants(remainingPeers);
      // NOTE: We do NOT remove from callGroupParticipantsRef — it holds the
      // PEAK snapshot so history shows everyone who was ever in the call.

      const pc = peerConnectionsRef.current.get(userId);
      if (pc) {
        pc.ontrack                    = null;
        pc.onicecandidate             = null;
        pc.onconnectionstatechange    = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
        peerConnectionsRef.current.delete(userId);
      }

      // [FIX LOW-9]  Prevent unbounded queue growth
      pendingCandidates.current.delete(userId);
      // [FIX MEDIUM-8]
      makingOfferRef.current.delete(userId);

      removeRemoteStream(userId);
    },

    onAudioRoomEnded: ({ roomId } = {}) => {
      // Guard: only end if this event is for our current active room.
      // A delayed audio-room-ended from a just-left group call must not
      // kill a new call the user started immediately after.
      if (roomId && activeCallRef.current?.roomId !== roomId) {
        console.info('[AudioCall] ignoring stale audio-room-ended for room', roomId);
        return;
      }
      fullCleanup();
    },
  };

  // ── Register socket listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const wrap = (key) => (...args) => fn.current[key]?.(...args);

    const handlers = {
      'audio-call-upgrade':   wrap('onAudioCallUpgrade'),
      'incoming-audio-call':  wrap('onIncomingAudioCall'),
      'audio-call-initiated': wrap('onAudioCallInitiated'),
      'audio-call-queued':    wrap('onAudioCallQueued'),
      'audio-call-accepted':  wrap('onAudioCallAccepted'),
      'audio-call-rejected':  wrap('onAudioCallRejected'),
      'audio-call-ended':     wrap('onAudioCallEnded'),
      'audio-call-failed':    wrap('onAudioCallFailed'),
      'audio-call-timeout':   wrap('onAudioCallTimeout'),
      'audio-call-busy':      wrap('onAudioCallBusy'),
      'audio-webrtc-offer':   wrap('onAudioWebRTCOffer'),
      'audio-webrtc-answer':  wrap('onAudioWebRTCAnswer'),
      'audio-webrtc-ice':     wrap('onAudioWebRTCIce'),
      'audio-room-joined':    wrap('onAudioRoomJoined'),
      'user-joined-audio':    wrap('onUserJoinedAudio'),
      'user-left-audio':      wrap('onUserLeftAudio'),
      'audio-room-ended':     wrap('onAudioRoomEnded'),
    };

    Object.entries(handlers).forEach(([ev, h]) => socket.on(ev, h));

    const deliverOnConnect = () => {
      if (!user?._id) return;
      setTimeout(() => socket.emit('check-pending-audio-calls', { userId: user._id }), 500);
    };

    socket.on('connect',   deliverOnConnect);
    socket.on('reconnect', deliverOnConnect);
    if (socket.connected) deliverOnConnect();

    return () => {
      Object.entries(handlers).forEach(([ev, h]) => socket.off(ev, h));
      socket.off('connect',   deliverOnConnect);
      socket.off('reconnect', deliverOnConnect);
    };
  }, [socket, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => fullCleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AudioCallContext.Provider
      value={{
        callState,
        incomingCall,
        activeCall,
        localStream,
        remoteStreams,
        isMuted,
        callDuration,
        participants,
        callStatus,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        joinAudioRoom,
        inviteToCall,
      }}
    >
      {children}
    </AudioCallContext.Provider>
  );
};