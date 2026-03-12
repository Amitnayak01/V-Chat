import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useWebRTC }         from '../../context/WebRTCContext';
import { useMinimizedCall }  from '../../context/MinimizedCallContext';
import { useSocket }         from '../../context/SocketContext';

// ── Responsive breakpoint hook ────────────────────────────────────────────────
const useBreakpoint = () => {
  const get = () => {
    const w = window.innerWidth;
    if (w < 480) return 'xs';   // small phones
    if (w < 768) return 'sm';   // large phones
    if (w < 1024) return 'md';  // tablets
    return 'lg';                // desktop
  };
  const [bp, setBp] = useState(get);
  useEffect(() => {
    const fn = () => setBp(get());
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return bp;
};

// Card dimensions per breakpoint
const CARD_SIZE = {
  xs: { w: 120, h: 172 },
  sm: { w: 138, h: 196 },
  md: { w: 152, h: 212 },
  lg: { w: 156, h: 216 },
};

// Default anchor (right/bottom px) — xs lifts card above mobile nav bars
const DEFAULT_POS = {
  xs: { right: 10, bottom: 72 },
  sm: { right: 12, bottom: 80 },
  md: { right: 16, bottom: 24 },
  lg: { right: 16, bottom: 24 },
};

// ── Self-attaching video element ──────────────────────────────────────────────
const MiniVideo = memo(({ stream, muted = false, mirror = false }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay playsInline muted={muted}
      className={`absolute inset-0 w-full h-full object-cover pointer-events-none
                  ${mirror ? '[transform:scaleX(-1)]' : ''}`}
    />
  );
});
MiniVideo.displayName = 'MiniVideo';

// ── Mini control button ───────────────────────────────────────────────────────
const MiniBtn = memo(({ icon: Icon, onClick, variant = 'ghost', label, small = false }) => {
  const bg = {
    ghost:  'bg-black/50 hover:bg-black/70 text-white border border-white/10',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50',
    active: 'bg-blue-500/80 hover:bg-blue-600 text-white border border-blue-400/30',
    muted:  'bg-red-500/80 hover:bg-red-600/80 text-white border border-red-400/20',
  }[variant];
  return (
    <motion.button
      whileTap={{ scale: 0.80 }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      title={label}
      className={`${small ? 'w-8 h-8' : 'w-9 h-9'} rounded-2xl flex items-center justify-center
                  backdrop-blur-md transition-all duration-150 flex-shrink-0 ${bg}`}
    >
      <Icon className={small ? 'w-[13px] h-[13px]' : 'w-[15px] h-[15px]'} />
    </motion.button>
  );
});
MiniBtn.displayName = 'MiniBtn';

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING CALL WINDOW
// ─────────────────────────────────────────────────────────────────────────────
const FloatingCallWindow = () => {
  const { minimizedCall, clearMinimizedCall } = useMinimizedCall();
  const {
    localStream, remoteStreams,
    isMuted, isVideoOff,
    toggleMute, toggleVideo, cleanup,
  } = useWebRTC();
  const { emit, clearCurrentRoom } = useSocket();
  const navigate = useNavigate();

  const bp       = useBreakpoint();
  const cardSize = CARD_SIZE[bp];
  const isXs     = bp === 'xs';

  // ── Position state ──────────────────────────────────────────────────────
  const [pos,      setPos]      = useState(() => DEFAULT_POS[bp] ?? DEFAULT_POS.lg);
  const [dragging, setDragging] = useState(false);

  const dragRef      = useRef({ mx: 0, my: 0, pr: 16, pb: 24, moved: false });
  const hideTimerRef = useRef(null);
  const [showControls, setShowControls] = useState(false);

  // Re-anchor when screen rotates or breakpoint changes
  useEffect(() => {
    setPos((prev) => {
      const MARGIN = 4;
      const maxR = window.innerWidth  - cardSize.w - MARGIN;
      const maxB = window.innerHeight - cardSize.h - MARGIN;
      const safe = DEFAULT_POS[bp];
      return {
        right:  Math.max(MARGIN, Math.min(prev.right,  maxR > 0 ? maxR : safe.right)),
        bottom: Math.max(MARGIN, Math.min(prev.bottom, maxB > 0 ? maxB : safe.bottom)),
      };
    });
  }, [bp, cardSize.w, cardSize.h]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const remoteEntries = Array.from(remoteStreams.entries());
  const hasRemote     = remoteEntries.length > 0;
  const mainStream    = hasRemote ? remoteEntries[0][1] : localStream;
  const mainMuted     = !hasRemote;

  // ── Auto-hide controls ──────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);
  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  // ── Tap → toggle controls / double-tap → expand ─────────────────────────
  const lastTapRef = useRef(0);
  const handleClick = useCallback(() => {
    if (dragRef.current.moved) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (minimizedCall) { clearMinimizedCall(); navigate(`/room/${minimizedCall.roomId}`); }
      return;
    }
    lastTapRef.current = now;
    setShowControls(v => {
      const next = !v;
      if (next) scheduleHide(); else clearTimeout(hideTimerRef.current);
      return next;
    });
  }, [scheduleHide, minimizedCall, navigate, clearMinimizedCall]);

  const handleExpand = useCallback((e) => {
    e.stopPropagation();
    if (!minimizedCall) return;
    clearMinimizedCall();
    navigate(`/room/${minimizedCall.roomId}`);
  }, [minimizedCall, navigate, clearMinimizedCall]);

  const handleEndCall = useCallback((e) => {
    e.stopPropagation();
    if (!minimizedCall) return;
    clearTimeout(hideTimerRef.current);
    emit('leave-room', { roomId: minimizedCall.roomId, userId: minimizedCall.userId });
    clearCurrentRoom(); clearMinimizedCall(); cleanup();
    toast('Call ended', { icon: '👋' });
  }, [minimizedCall, emit, clearCurrentRoom, clearMinimizedCall, cleanup]);

  const handleToggleMute = useCallback((e) => {
    e.stopPropagation(); toggleMute(); scheduleHide();
  }, [toggleMute, scheduleHide]);

  const handleToggleVideo = useCallback((e) => {
    e.stopPropagation(); toggleVideo(); scheduleHide();
  }, [toggleVideo, scheduleHide]);

  // ── Pointer drag ────────────────────────────────────────────────────────
  const isDownRef = useRef(false);

  const onPointerDown = useCallback((e) => {
    if (e.target.closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mx: e.clientX, my: e.clientY, pr: pos.right, pb: pos.bottom, moved: false };
    isDownRef.current = true;
    setDragging(false);
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!isDownRef.current) return;
    const dx = e.clientX - dragRef.current.mx;
    const dy = e.clientY - dragRef.current.my;
    if (!dragRef.current.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragRef.current.moved = true;
      setDragging(true);
    }
    if (!dragRef.current.moved) return;
    const MARGIN = 4;
    const maxRight  = window.innerWidth  - cardSize.w - MARGIN;
    const maxBottom = window.innerHeight - cardSize.h - MARGIN;
    setPos({
      right:  Math.min(maxRight,  Math.max(MARGIN, dragRef.current.pr - dx)),
      bottom: Math.min(maxBottom, Math.max(MARGIN, dragRef.current.pb - dy)),
    });
  }, [cardSize]);

  const onPointerUp = useCallback(() => {
    isDownRef.current = false;
    setTimeout(() => { setDragging(false); dragRef.current.moved = false; }, 50);
  }, []);

  if (!minimizedCall) return null;

  const { localUsername } = minimizedCall;
  const remoteCount       = remoteEntries.length;

  return (
    <AnimatePresence>
      <motion.div
        key="floating-call-window"
        initial={{ opacity: 0, scale: 0.55, y: 24 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.55, y: 24  }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed z-[9997] select-none"
        style={{
          bottom:      pos.bottom,
          right:       pos.right,
          width:       cardSize.w,
          height:      cardSize.h,
          touchAction: 'none',
          cursor:      dragging ? 'grabbing' : 'grab',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleClick}
      >
        {/* ── Card shell ─────────────────────────────────────────────────── */}
        <div
          className="relative w-full h-full overflow-hidden"
          style={{
            borderRadius: isXs ? 16 : 20,
            border:       '1.5px solid rgba(255,255,255,0.14)',
            boxShadow:    '0 12px 48px rgba(0,0,0,0.72), 0 2px 8px rgba(0,0,0,0.45)',
            background:   '#0a0c14',
          }}
        >
          {/* ── Main video ─────────────────────────────────────────────── */}
          {mainStream && (
            <MiniVideo stream={mainStream} muted={mainMuted} mirror={!hasRemote} />
          )}

          {/* ── No-video placeholder ───────────────────────────────────── */}
          {(!mainStream || (isVideoOff && !hasRemote)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div
                className="rounded-full bg-gradient-to-br from-slate-600 to-slate-800
                            flex items-center justify-center ring-2 ring-white/10"
                style={{ width: isXs ? 44 : 56, height: isXs ? 44 : 56 }}
              >
                <span className="text-white font-bold" style={{ fontSize: isXs ? 16 : 20 }}>
                  {localUsername?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            </div>
          )}

          {/* ── Top gradient ───────────────────────────────────────────── */}
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/65 to-transparent pointer-events-none" />

          {/* ── Top bar: mute badge · expand · live dot ─────────────────── */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
            {/* Left: mute indicator + expand */}
            <div className="flex items-center gap-1">
              {isMuted && (
                <span className="w-4 h-4 rounded-full bg-red-500/90 flex items-center justify-center pointer-events-none">
                  <MicOff className="w-2.5 h-2.5 text-white" />
                </span>
              )}
              <button
                onClick={handleExpand}
                className="w-5 h-5 rounded-full bg-blue-500/70 hover:bg-blue-500
                           flex items-center justify-center transition-all"
                title="Return to call"
              >
                <Maximize2 className="w-2.5 h-2.5 text-white" />
              </button>
            </div>

            {/* Right: live pulse */}
            <span className="relative w-1.5 h-1.5 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          {/* ── Bottom gradient ────────────────────────────────────────── */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* ── Status hint ────────────────────────────────────────────── */}
          {!showControls && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10">
              <span
                className="text-white/40 font-medium tracking-wide text-center leading-tight px-1"
                style={{ fontSize: isXs ? 7 : 8 }}
              >
                {hasRemote ? `${remoteCount + 1} in call · tap for controls` : 'tap for controls'}
              </span>
            </div>
          )}

          {/* ── Control bar ────────────────────────────────────────────── */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0  }}
                exit={{    opacity: 0, y: 10  }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute inset-x-0 bottom-0 z-20 px-1.5 pb-2 pt-1"
                onClick={e => e.stopPropagation()}
              >
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background:    'rgba(6,8,16,0.88)',
                    backdropFilter:'blur(16px)',
                    border:        '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  <div className="flex items-center justify-around px-1 py-2">
                    <MiniBtn
                      icon={isMuted ? MicOff : Mic}
                      onClick={handleToggleMute}
                      variant={isMuted ? 'muted' : 'ghost'}
                      label={isMuted ? 'Unmute' : 'Mute'}
                      small={isXs}
                    />
                    <MiniBtn
                      icon={isVideoOff ? VideoOff : Video}
                      onClick={handleToggleVideo}
                      variant={isVideoOff ? 'muted' : 'ghost'}
                      label={isVideoOff ? 'Start Camera' : 'Stop Camera'}
                      small={isXs}
                    />
                    <MiniBtn
                      icon={PhoneOff}
                      onClick={handleEndCall}
                      variant="danger"
                      label="End Call"
                      small={isXs}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default memo(FloatingCallWindow);