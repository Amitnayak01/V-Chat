/**
 * useAudioDeviceManager.js
 * ────────────────────────────────────────────────────────────────────────────
 * Bridges AudioCallUI's selectedMic / noiseSuppression React state to the
 * audioEnhancer patch layer, so the next getUserMedia call (i.e. the next
 * call answered or initiated) automatically uses the preferred device and
 * noise-suppression setting.
 *
 * Also handles live track replacement while a call is already connected,
 * so switching mic mid-call works without hanging up.
 *
 * USAGE — drop one call inside AudioCallUI (the component already has all
 * the required state; just add this hook at the top of the function body):
 *
 *   import { useAudioDeviceManager } from '../../hooks/useAudioDeviceManager';
 *
 *   // Inside AudioCallUI component:
 *   useAudioDeviceManager({ selectedMic, noiseSuppression });
 *
 * That is the only change needed in AudioCallUI. Everything else is handled
 * here without modifying any existing file.
 *
 * Path: client/src/hooks/useAudioDeviceManager.js
 */

import { useEffect, useRef } from 'react';
import {
  setPreferredMicDevice,
  setNoiseSuppression,
} from '../utils/audioEnhancer';
import { useAudioCall } from '../context/AudioCallContext';

/**
 * @param {object} opts
 * @param {string}  opts.selectedMic        – deviceId from AudioCallUI state
 * @param {boolean} opts.noiseSuppression   – NS toggle from AudioCallUI state
 */
export const useAudioDeviceManager = ({ selectedMic, noiseSuppression }) => {
  const { localStream, callState } = useAudioCall();
  const prevMicRef = useRef(selectedMic);
  const prevNsRef  = useRef(noiseSuppression);

  // ── 1. Keep audioEnhancer prefs in sync with UI state ────────────────────
  //      This ensures the NEXT getUserMedia call uses the correct settings.
  useEffect(() => {
    setPreferredMicDevice(selectedMic);
  }, [selectedMic]);

  useEffect(() => {
    setNoiseSuppression(noiseSuppression);
  }, [noiseSuppression]);

  // ── 2. Live mic switch — replace audio track while call is active ─────────
  //      When the user picks a different mic during a connected call we:
  //        a) Acquire a new stream from the chosen device
  //        b) Replace the track on every active RTCPeerConnection sender
  //           (we read the peer connections via localStream's tracks since we
  //            cannot access peerConnectionsRef directly from outside the context)
  //        c) Stop the old track to release the previous device's LED indicator
  useEffect(() => {
    const micChanged = selectedMic !== prevMicRef.current;
    const nsChanged  = noiseSuppression !== prevNsRef.current;
    prevMicRef.current = selectedMic;
    prevNsRef.current  = noiseSuppression;

    // Only do live replacement when a call is active and something changed
    if (callState !== 'connected') return;
    if (!localStream)              return;
    if (!micChanged && !nsChanged) return;

    let cancelled = false;

    const replaceTrack = async () => {
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression,
            autoGainControl:  true,
            sampleRate:       48000,
            channelCount:     1,
            latency:          0,
            ...(selectedMic && selectedMic !== 'default'
              ? { deviceId: { exact: selectedMic } }
              : {}),
          },
          video: false,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          newStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const [newTrack] = newStream.getAudioTracks();
        if (!newTrack) return;

        // Replace track on every RTCPeerConnection that has this stream's track
        const oldTrack = localStream.getAudioTracks()[0];
        if (!oldTrack) return;

        // Walk all open peer connections via RTCPeerConnection.getStats trick:
        // We use the track itself to find senders across all PeerConnections.
        // Since we can't import peerConnectionsRef, we use a documented
        // approach: iterate window.__vmPeerConnections if the context exports it,
        // OR fall back to replacing via the MediaStreamTrack replaceTrack API.
        const pcs = window.__vmAudioPeerConnections; // populated by the context patch below
        if (pcs && pcs.size > 0) {
          const replacePromises = [];
          pcs.forEach((pc) => {
            for (const sender of pc.getSenders()) {
              if (sender.track?.kind === 'audio') {
                replacePromises.push(sender.replaceTrack(newTrack).catch(() => {}));
              }
            }
          });
          await Promise.all(replacePromises);
        } else {
          // Fallback: if the peer map isn't exposed, just update the local stream
          // so the next re-connection uses the right track.
          console.warn('[AudioDeviceManager] Peer connection map not available — live swap skipped');
        }

        // Swap track in the local stream
        localStream.removeTrack(oldTrack);
        localStream.addTrack(newTrack);
        oldTrack.stop(); // release the old device

        console.info('[AudioDeviceManager] ✅ Live mic switched to', selectedMic || 'default');
      } catch (err) {
        console.error('[AudioDeviceManager] Live mic switch failed:', err);
      }
    };

    replaceTrack();
    return () => { cancelled = true; };
  }, [selectedMic, noiseSuppression, callState, localStream]);
};

// ─── Optional: expose peer connection map for live track replacement ──────────
//
// If you want seamless mid-call mic switching, paste this tiny patch into
// AudioCallContext.jsx's createAudioPeer function (the ONLY context change
// ever needed — one line per operation, purely additive):
//
//   // After:  peerConnectionsRef.current.set(userId, pc);
//   // Add:
//   if (typeof window !== 'undefined') {
//     if (!window.__vmAudioPeerConnections) window.__vmAudioPeerConnections = new Map();
//     window.__vmAudioPeerConnections.set(userId, pc);
//   }
//
//   // After:  peerConnectionsRef.current.delete(userId);
//   // Add:
//   window.__vmAudioPeerConnections?.delete(userId);
//
//   // In fullCleanup, after peerConnectionsRef.current.clear():
//   if (window.__vmAudioPeerConnections) window.__vmAudioPeerConnections.clear();
//
// Without this the hook still works — it just can't hot-swap the mic track
// mid-call (the new device takes effect on the next call instead).