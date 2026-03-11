// components/VideoCall/FloatingPiP.jsx
// WhatsApp-style draggable floating mini-video window.
// Rendered globally from App.jsx so it persists across navigation.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, PhoneOff, Mic, MicOff } from 'lucide-react';
import { usePiP } from '../../context/PiPContext';

// ─── helpers ─────────────────────────────────────────────────────────────────

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// ─────────────────────────────────────────────────────────────────────────────

const FloatingPiP = () => {
  const { pipState, deactivatePiP, hidePiP } = usePiP();
  const navigate = useNavigate();

  // ── Video refs ──────────────────────────────────────────────────────────
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  // ── Drag state ──────────────────────────────────────────────────────────
  // Position stored as { x, y } from bottom-right corner
  const [pos, setPos]         = useState({ x: 20, y: 20 });
  const isDragging            = useRef(false);
  const dragStart             = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const pipRef                = useRef(null);

  // ── Misc ────────────────────────────────────────────────────────────────
  const [hasRemote, setHasRemote] = useState(false);

  // ── Attach video streams ────────────────────────────────────────────────
  useEffect(() => {
    if (!pipState) return;

    // Local stream → local video el
    if (localVideoRef.current && pipState.localStream) {
      localVideoRef.current.srcObject = pipState.localStream;
    }

    // Remote: pick the first available remote stream
    const remoteEntries = pipState.remoteStreams instanceof Map
      ? Array.from(pipState.remoteStreams.values())
      : Object.values(pipState.remoteStreams || {}).filter(v => v instanceof MediaStream);

    const firstRemote = remoteEntries[0] ?? null;
    if (remoteVideoRef.current && firstRemote) {
      remoteVideoRef.current.srcObject = firstRemote;
      setHasRemote(true);
    } else {
      setHasRemote(false);
    }
  }, [pipState]);

  // ── Click: return to call ───────────────────────────────────────────────
  const handleReturn = useCallback(() => {
    hidePiP();
    navigate(`/room/${pipState.roomId}`);
  }, [hidePiP, navigate, pipState?.roomId]);

  // ── End call from PiP ───────────────────────────────────────────────────
  const handleEnd = useCallback((e) => {
    e.stopPropagation();
    deactivatePiP();
    // The actual WebRTC teardown is owned by VideoRoom.
    // Since we navigated away, the call socket state is still live on the server.
    // We fire a custom event that App.jsx / SocketContext can optionally listen to.
    window.dispatchEvent(new CustomEvent('pip-end-call', { detail: { roomId: pipState?.roomId } }));
    // Navigate back to dashboard so it's cleanly resolved
    navigate('/dashboard', { replace: true });
  }, [deactivatePiP, navigate, pipState?.roomId]);

  // ── Drag (pointer events — works mouse + touch) ─────────────────────────
  const onPointerDown = useCallback((e) => {
    // Don't start drag on button clicks
    if (e.target.closest('button')) return;
    isDragging.current = true;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: pos.x,
      py: pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const pip = pipRef.current;
    if (!pip) return;

    const W = pip.offsetWidth;
    const H = pip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;

    // pos is distance from bottom-right edge
    const newX = clamp(dragStart.current.px - dx, 0, vw - W - 8);
    const newY = clamp(dragStart.current.py - dy, 0, vh - H - 8);

    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {pipState && (
        <motion.div
          ref={pipRef}
          key="floating-pip"
          initial={{ opacity: 0, scale: 0.7, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 40 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          style={{
            position: 'fixed',
            right: pos.x,
            bottom: pos.y,
            zIndex: 9990,
            touchAction: 'none',
            userSelect: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="cursor-grab active:cursor-grabbing"
        >
          {/* ── Outer shell ── */}
          <div
            className="relative overflow-hidden rounded-2xl shadow-2xl"
            style={{
              width: 168,
              height: 224,
              background: '#0a0d14',
              boxShadow: '0 8px 40px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(255,255,255,0.10)',
            }}
          >
            {/* ── Remote video (main / full frame) ── */}
            {hasRemote ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              /* No remote yet — show a subtle waiting state */
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2
                              bg-gradient-to-br from-slate-900 to-slate-950">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-xl">📞</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                  Connecting…
                </span>
              </div>
            )}

            {/* ── Local video (PiP within PiP — bottom-left) ── */}
            <div
              className="absolute bottom-2 left-2 rounded-xl overflow-hidden border border-white/15"
              style={{ width: 52, height: 70, background: '#111827' }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>

            {/* ── Top action row ── */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between
                            px-2 pt-2 pb-3
                            bg-gradient-to-b from-black/70 to-transparent">
              {/* Room ID label */}
              <span
                className="text-[9px] font-mono font-semibold text-white/60 tracking-widest
                           bg-black/40 px-1.5 py-0.5 rounded-md truncate max-w-[80px]"
              >
                {pipState.roomId}
              </span>

              {/* Close / end call */}
              <button
                onClick={handleEnd}
                className="w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-500
                           flex items-center justify-center transition-colors
                           border border-red-400/30 shadow-md"
                title="End call"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* ── Bottom tap-to-return overlay ── */}
            <button
              onClick={handleReturn}
              className="absolute inset-0 w-full h-full flex items-end justify-center
                         pb-3 opacity-0 hover:opacity-100 focus:opacity-100
                         bg-gradient-to-t from-black/60 via-transparent to-transparent
                         transition-opacity duration-200"
              title="Return to call"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                              bg-white/15 backdrop-blur-sm border border-white/20">
                <Maximize2 className="w-3 h-3 text-white" />
                <span className="text-[10px] font-semibold text-white">Return to call</span>
              </div>
            </button>

            {/* ── Live indicator ── */}
            <div className="absolute top-2 right-8 flex items-center gap-1 pointer-events-none">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full
                                 rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
            </div>
          </div>

          {/* ── Tap-to-return green bar below the window (WhatsApp style) ── */}
          <button
            onClick={handleReturn}
            className="w-full mt-1 flex items-center justify-center gap-1.5
                       py-1.5 px-3 rounded-xl
                       bg-green-600/90 hover:bg-green-500
                       backdrop-blur-sm border border-green-500/30
                       transition-colors shadow-lg shadow-green-900/40"
          >
            <span className="text-[11px] font-semibold text-white tracking-wide">
              Tap to return to call
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingPiP;