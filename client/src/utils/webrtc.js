// ─────────────────────────────────────────────────────────────────────────────
// webrtc.js  —  V-Meet WebRTC Utilities
// ─────────────────────────────────────────────────────────────────────────────
//
// FIX 1 — TURN SERVERS (Root cause of "connects sometimes, fails sometimes")
// ────────────────────────────────────────────────────────────────────────────
// PROBLEM: The original config had ONLY Google STUN servers. STUN only works
// when both peers are behind "full cone" or "port-restricted cone" NAT.
// Mobile carriers (Jio, Airtel, etc.), corporate WiFi, and many home routers
// use "symmetric NAT", where STUN hole-punching fails completely.
// STUN failure = ICE failure = black screen / no audio with no clear error.
//
// FIX: Add TURN relay servers. A TURN server acts as a relay when direct
// peer-to-peer fails. Connection succeeds 100% of the time via TURN,
// at the cost of slightly higher latency.
//
// HOW TO USE:
//   Option A (Recommended – Production):
//     Sign up at https://www.metered.ca (free tier: 50 GB/month)
//     Add to client/.env:
//       VITE_TURN_URLS=turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443?transport=tcp,turns:a.relay.metered.ca:443?transport=tcp
//       VITE_TURN_USERNAME=your_metered_username
//       VITE_TURN_CREDENTIAL=your_metered_credential
//
//   Option B (Development / Low-traffic fallback):
//     Leave env vars empty — the OpenRelay free public TURN is used.
//     Do NOT use OpenRelay in production — it has rate limits and no SLA.
//
// FIX 2 — bundlePolicy: 'max-bundle'
// ────────────────────────────────────────────────────────────────────────────
// PROBLEM: Default bundlePolicy creates separate ICE transport for audio and
// video, doubling the number of ICE candidates exchanged and slowing connection.
// FIX: 'max-bundle' forces audio + video onto a single ICE path → fewer
// candidates, faster connection, fewer ports required on TURN.
//
// FIX 3 — rtcpMuxPolicy: 'require'
// ────────────────────────────────────────────────────────────────────────────
// PROBLEM: Default policy allows separate RTCP port, wasting a TURN allocation.
// FIX: 'require' multiplexes RTP and RTCP on a single port.
// ─────────────────────────────────────────────────────────────────────────────

const buildIceServers = () => {
  const servers = [
    // Google STUN — works on open networks. Fast discovery for direct P2P.
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrls       = import.meta.env.VITE_TURN_URLS;       // comma-separated
  const turnUsername   = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrls && turnUsername && turnCredential) {
    // ── Production TURN (from your .env) ──────────────────────────────────
    servers.push({
      urls:       turnUrls.split(',').map(u => u.trim()),
      username:   turnUsername,
      credential: turnCredential,
    });
    console.log('[WebRTC] Using configured TURN servers');
  } else {
    // ── Development fallback — OpenRelay free public TURN ─────────────────
    // ⚠️  Replace with a private TURN for any real production traffic.
    console.warn(
      '[WebRTC] VITE_TURN_* env vars not set. ' +
      'Using free public OpenRelay TURN. ' +
      'See client/.env.example for setup instructions.'
    );
    servers.push(
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:80?transport=tcp',
        ],
        username:   'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls:       ['turns:openrelay.metered.ca:443'],
        username:   'openrelayproject',
        credential: 'openrelayproject',
      }
    );
  }

  return servers;
};

// ── Main WebRTC peer connection config ────────────────────────────────────────
export const WEBRTC_CONFIG = {
  iceServers:          buildIceServers(),
  iceCandidatePoolSize: 10,          // pre-gather candidates before createOffer
  bundlePolicy:        'max-bundle', // ← FIX 2: one ICE path for audio+video
  rtcpMuxPolicy:       'require',    // ← FIX 3: one port for RTP+RTCP
};

// ── Media constraints ─────────────────────────────────────────────────────────
export const MEDIA_CONSTRAINTS = {
  video: {
    width:     { ideal: 1280, max: 1920 },
    height:    { ideal: 720,  max: 1080 },
    frameRate: { ideal: 30,   max: 60   },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl:  true,
  },
};

// ── Screen share constraints ──────────────────────────────────────────────────
export const SCREEN_SHARE_CONSTRAINTS = {
  video: { cursor: 'always', displaySurface: 'monitor' },
  audio: false,
};

// ── Factory ───────────────────────────────────────────────────────────────────
export const createPeerConnection = () => new RTCPeerConnection(WEBRTC_CONFIG);

// ── getUserMedia ──────────────────────────────────────────────────────────────
export const getUserMedia = async (constraints = MEDIA_CONSTRAINTS) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, error: null };
  } catch (error) {
    console.error('[Media] getUserMedia error:', error.name, error.message);
    let errorMessage = 'Failed to access camera/microphone';
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Camera/microphone access denied. Please allow access in browser settings.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera/microphone found. Please connect a device.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Camera/microphone is already in use by another application.';
    }
    return { stream: null, error: errorMessage };
  }
};

// ── getDisplayMedia ───────────────────────────────────────────────────────────
export const getDisplayMedia = async (constraints = SCREEN_SHARE_CONSTRAINTS) => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    return { stream, error: null };
  } catch (error) {
    console.error('[Media] getDisplayMedia error:', error.name);
    return {
      stream: null,
      error: error.name === 'NotAllowedError'
        ? 'Screen sharing permission denied'
        : 'Failed to share screen',
    };
  }
};

// ── toggleMediaTrack ──────────────────────────────────────────────────────────
export const toggleMediaTrack = (stream, kind, enabled) => {
  if (!stream) return false;
  const tracks = kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();
  tracks.forEach(track => { track.enabled = enabled; });
  return enabled;
};

// ── stopMediaStream ───────────────────────────────────────────────────────────
export const stopMediaStream = (stream) => {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
};

// ── replaceTrack ──────────────────────────────────────────────────────────────
export const replaceTrack = async (peerConnection, newTrack, kind) => {
  const sender = peerConnection
    .getSenders()
    .find(s => s.track?.kind === kind || (!s.track && kind === 'video'));

  if (sender) {
    await sender.replaceTrack(newTrack);
    return true;
  }
  return false;
};

// ── checkWebRTCSupport ────────────────────────────────────────────────────────
export const checkWebRTCSupport = () => {
  const hasGetUserMedia    = !!(navigator.mediaDevices?.getUserMedia);
  const hasRTCPeerConnection = !!window.RTCPeerConnection;
  return {
    supported:     hasGetUserMedia && hasRTCPeerConnection,
    getUserMedia:  hasGetUserMedia,
    peerConnection: hasRTCPeerConnection,
  };
};

// ── generateRoomId ────────────────────────────────────────────────────────────
export const generateRoomId = () =>
  `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ── MediaRecorderHelper ───────────────────────────────────────────────────────
export class MediaRecorderHelper {
  constructor(stream) {
    this.stream         = stream;
    this.mediaRecorder  = null;
    this.recordedChunks = [];
  }

  start() {
    try {
      const options = { mimeType: 'video/webm;codecs=vp9' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
      }
      this.mediaRecorder  = new MediaRecorder(this.stream, options);
      this.recordedChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) this.recordedChunks.push(event.data);
      };
      this.mediaRecorder.start(1000);
      return true;
    } catch (error) {
      console.error('[Recorder] start error:', error);
      return false;
    }
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) { reject(new Error('No media recorder')); return; }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        resolve({ blob, url: URL.createObjectURL(blob) });
      };
      this.mediaRecorder.onerror = reject;
      this.mediaRecorder.stop();
    });
  }

  isRecording() {
    return this.mediaRecorder?.state === 'recording';
  }
}

export default {
  WEBRTC_CONFIG,
  MEDIA_CONSTRAINTS,
  SCREEN_SHARE_CONSTRAINTS,
  createPeerConnection,
  getUserMedia,
  getDisplayMedia,
  toggleMediaTrack,
  stopMediaStream,
  replaceTrack,
  checkWebRTCSupport,
  generateRoomId,
  MediaRecorderHelper,
};