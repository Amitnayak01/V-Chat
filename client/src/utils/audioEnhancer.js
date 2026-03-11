/**
 * audioEnhancer.js
 * ────────────────────────────────────────────────────────────────────────────
 * Audio quality patch layer for V-Meet audio calls.
 *
 * HOW IT WORKS — zero changes to existing files:
 *   1. Patches RTCPeerConnection.prototype.setLocalDescription to inject
 *      optimal Opus codec parameters into every SDP before it is sent.
 *   2. Patches navigator.mediaDevices.getUserMedia to honour a runtime-
 *      selected microphone device without touching AudioCallContext.
 *   3. Patches RTCPeerConnection.prototype.setRemoteDescription to apply
 *      sender bitrate limits after the remote description is set.
 *
 * USAGE — add ONE line to client/src/main.jsx (before anything else):
 *   import './utils/audioEnhancer';
 *
 * OPTIONAL device / noise-suppression integration:
 *   import { setPreferredMicDevice, setNoiseSuppression } from './utils/audioEnhancer';
 *   // Call these from AudioCallUI when the user changes device / NS toggle.
 *   // Because AudioCallUI already tracks selectedMic & noiseSuppression state,
 *   // the companion hook useAudioDeviceManager wires them automatically.
 *
 * Path: client/src/utils/audioEnhancer.js
 */

// ─── Runtime preference store (plain object — no React) ──────────────────────
const _prefs = {
  micDeviceId:      null,   // null = browser default
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl:  true,
};

/** Call from UI when user picks a different microphone. */
export const setPreferredMicDevice = (deviceId) => {
  _prefs.micDeviceId = deviceId && deviceId !== 'default' ? deviceId : null;
};

/** Call from UI when user toggles the Noise Suppression button. */
export const setNoiseSuppression = (enabled) => {
  _prefs.noiseSuppression = !!enabled;
};

/** Read-only snapshot (useful for debugging). */
export const getAudioPrefs = () => ({ ..._prefs });

// ─── Opus SDP parameters ──────────────────────────────────────────────────────
//
// These params are injected into every SDP offer / answer before it is set as
// the local description.  They apply to every RTCPeerConnection on the page,
// which is exactly what we want since AudioCallContext creates its own peers.
//
//  maxaveragebitrate   – 510 kbps ceiling keeps Opus in its highest quality
//                        mode (variable bitrate, perceptual optimisation on)
//  maxplaybackrate     – Tells decoder to use full 48 kHz audio path
//  useinbandfec=1      – In-band Forward Error Correction: decoder can recover
//                        a lost packet from the NEXT packet.  Single biggest
//                        clarity improvement on lossy / mobile networks.
//  usedtx=1            – Discontinuous Transmission: silence packets are
//                        skipped, cutting bandwidth during pauses and reducing
//                        background-noise pumping artifacts.
//  cbr=0               – Variable bitrate (default, but explicit is safer)
//  stereo=0            – Voice calls are mono; stereo wastes bits & headroom
//  sprop-stereo=0      – Tell remote end same
//  ptime=20            – 20 ms packet interval is the WebRTC standard

const OPUS_FMTP = [
  'maxaveragebitrate=510000',
  'maxplaybackrate=48000',
  'useinbandfec=1',
  'usedtx=1',
  'cbr=0',
  'stereo=0',
  'sprop-stereo=0',
  'ptime=20',
].join(';');

// Maximum bitrate we instruct the RTCRtpSender to use (in bits/s)
const SENDER_MAX_BITRATE = 510_000;

/** Merge two semicolon-delimited fmtp param strings. Override wins on conflict. */
const _mergeParams = (existing, override) => {
  const map = new Map();
  for (const chunk of existing.split(';')) {
    const eq = chunk.indexOf('=');
    if (eq === -1) continue;
    map.set(chunk.slice(0, eq).trim(), chunk.slice(eq + 1).trim());
  }
  for (const chunk of override.split(';')) {
    const eq = chunk.indexOf('=');
    if (eq === -1) continue;
    map.set(chunk.slice(0, eq).trim(), chunk.slice(eq + 1).trim());
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join(';');
};

/**
 * Rewrite an SDP string to prefer Opus and inject high-quality fmtp params.
 * Also moves the Opus PT to the front of the m=audio line so it is always
 * the first-negotiated codec.
 */
const _enhanceSDP = (sdp) => {
  if (!sdp) return sdp;

  // ── 1. Find the Opus payload type ────────────────────────────────────────
  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!opusMatch) return sdp; // no Opus line — leave unchanged

  const pt = opusMatch[1];
  let out = sdp;

  // ── 2. Inject / merge fmtp line ──────────────────────────────────────────
  const fmtpRx = new RegExp(`(a=fmtp:${pt} )(.+)`);
  if (fmtpRx.test(out)) {
    out = out.replace(fmtpRx, (_, prefix, existing) =>
      `${prefix}${_mergeParams(existing, OPUS_FMTP)}`
    );
  } else {
    // Insert fmtp immediately after the rtpmap line
    out = out.replace(
      new RegExp(`(a=rtpmap:${pt} opus\\/48000\\/2)`),
      `$1\r\na=fmtp:${pt} ${OPUS_FMTP}`
    );
  }

  // ── 3. Move Opus PT to front of m=audio payload list ─────────────────────
  out = out.replace(
    /^(m=audio \d+ [A-Z\/0-9]+ )([\d ]+)/m,
    (_, header, pts) => {
      const list = pts.trim().split(' ');
      const idx  = list.indexOf(pt);
      if (idx > 0) {
        list.splice(idx, 1);
        list.unshift(pt);
      }
      return `${header}${list.join(' ')}`;
    }
  );

  return out;
};

// ─── Patch 1: RTCPeerConnection.prototype.setLocalDescription ────────────────
//
// Every SDP produced by createOffer / createAnswer passes through here before
// being sent to the signalling server.  We rewrite it in-place.

if (typeof window !== 'undefined' && window.RTCPeerConnection) {
  const _origSetLocal = RTCPeerConnection.prototype.setLocalDescription;

  RTCPeerConnection.prototype.setLocalDescription = async function (desc, ...rest) {
    if (desc && desc.sdp && (desc.type === 'offer' || desc.type === 'answer')) {
      const enhanced = _enhanceSDP(desc.sdp);
      if (enhanced !== desc.sdp) {
        desc = new RTCSessionDescription({ type: desc.type, sdp: enhanced });
      }
    }
    return _origSetLocal.call(this, desc, ...rest);
  };

  // ── Patch 2: apply sender bitrate after remote description is set ─────────
  //
  // setRemoteDescription is the point at which both sides have agreed on a
  // codec and tracks exist on the sender.  We walk all audio senders and
  // clamp their maxBitrate to SENDER_MAX_BITRATE.

  const _origSetRemote = RTCPeerConnection.prototype.setRemoteDescription;

  RTCPeerConnection.prototype.setRemoteDescription = async function (desc, ...rest) {
    const result = await _origSetRemote.call(this, desc, ...rest);

    // Best-effort — don't let bitrate errors kill the connection
    try {
      for (const sender of this.getSenders()) {
        if (sender.track?.kind !== 'audio') continue;
        const params = sender.getParameters();
        if (!params.encodings?.length) {
          params.encodings = [{}];
        }
        let changed = false;
        for (const enc of params.encodings) {
          if (enc.maxBitrate !== SENDER_MAX_BITRATE) {
            enc.maxBitrate = SENDER_MAX_BITRATE;
            changed = true;
          }
          // Prioritise audio over any data channels
          if (enc.networkPriority !== 'high') {
            enc.networkPriority = 'high';
            changed = true;
          }
          if (enc.priority !== 'high') {
            enc.priority = 'high';
            changed = true;
          }
        }
        if (changed) {
          await sender.setParameters(params).catch(() => {});
        }
      }
    } catch (_) {
      // Non-fatal — quality patch failed but call can still proceed
    }

    return result;
  };
}

// ─── Patch 3: navigator.mediaDevices.getUserMedia ────────────────────────────
//
// AudioCallContext calls getUserMedia with hardcoded constraints.  This patch
// merges the runtime _prefs on top of whatever the caller requested, so:
//   • the user-selected mic device is always honoured
//   • noiseSuppression / echoCancellation reflect live UI toggles
//
// We only mutate audio constraints — video is left completely untouched.

if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
  const _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (constraints?.audio && typeof constraints.audio === 'object') {
      const audio = { ...constraints.audio };

      // Apply selected microphone device
      if (_prefs.micDeviceId) {
        audio.deviceId = { exact: _prefs.micDeviceId };
      }

      // Keep NS / EC / AGC in sync with UI prefs
      audio.noiseSuppression  = _prefs.noiseSuppression;
      audio.echoCancellation  = _prefs.echoCancellation;
      audio.autoGainControl   = _prefs.autoGainControl;

      // Enforce high-quality audio pipeline parameters
      audio.sampleRate    = audio.sampleRate    ?? 48000;
      audio.channelCount  = audio.channelCount  ?? 1;
      audio.latency       = audio.latency       ?? 0; // request lowest latency
      audio.sampleSize    = audio.sampleSize    ?? 16;

      constraints = { ...constraints, audio };
    }

    try {
      return await _origGUM(constraints);
    } catch (err) {
      // If exact deviceId fails (device unplugged etc.) retry with default
      if (err.name === 'OverconstrainedError' && _prefs.micDeviceId) {
        console.warn('[AudioEnhancer] Preferred mic unavailable, falling back to default');
        _prefs.micDeviceId = null;
        const fallback = { ...constraints };
        if (fallback.audio && typeof fallback.audio === 'object') {
          const { deviceId: _removed, ...rest } = fallback.audio;
          fallback.audio = rest;
        }
        return _origGUM(fallback);
      }
      throw err;
    }
  };
}

// ─── Debug helper ─────────────────────────────────────────────────────────────
if (import.meta.env?.DEV) {
  console.info(
    '[AudioEnhancer] ✅ Loaded — Opus FEC/DTX/48kHz + sender bitrate + getUserMedia patches active'
  );
}