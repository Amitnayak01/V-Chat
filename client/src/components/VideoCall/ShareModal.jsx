import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, Check, Link2, Mail, Share2,
  Users, QrCode, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Focus trap hook
// ─────────────────────────────────────────────────────────────────────────────
const useFocusTrap = (active) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const el     = ref.current;
    const FOCUS  = 'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])';
    const nodes  = () => [...el.querySelectorAll(FOCUS)];
    const first  = () => nodes()[0];
    const last   = () => nodes().at(-1);

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const all = nodes();
      if (!all.length) return;
      if (e.shiftKey) { if (document.activeElement === all[0]) { e.preventDefault(); all.at(-1).focus(); } }
      else            { if (document.activeElement === all.at(-1)) { e.preventDefault(); all[0].focus(); } }
    };

    el.addEventListener('keydown', trap);
    // Auto-focus first element
    setTimeout(() => first()?.focus(), 60);
    return () => el.removeEventListener('keydown', trap);
  }, [active]);
  return ref;
};

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic SVG QR (visual, not scan-grade)
// ─────────────────────────────────────────────────────────────────────────────
const QRDisplay = memo(({ value }) => {
  const SIZE = 11;
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;

  const cells = Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => {
      const inTL = r < 3 && c < 3;
      const inTR = r < 3 && c >= SIZE - 3;
      const inBL = r >= SIZE - 3 && c < 3;
      if (inTL || inTR || inBL) return true;
      const idx = r * SIZE + c;
      return (((hash >> (idx % 30)) ^ (idx * 2654435761)) & 1) === 1;
    })
  );

  const CELL = 9, PAD = 8, TOTAL = SIZE * CELL + PAD * 2;

  return (
    <svg
      width={TOTAL} height={TOTAL}
      viewBox={`0 0 ${TOTAL} ${TOTAL}`}
      role="img"
      aria-label="QR code for room link"
      fill="none"
    >
      <rect width={TOTAL} height={TOTAL} rx={10} fill="#f8fafc" />
      {cells.flatMap((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={PAD + c * CELL + 1}
              y={PAD + r * CELL + 1}
              width={CELL - 2}
              height={CELL - 2}
              rx={1.5}
              fill="#0f172a"
            />
          ) : null
        )
      )}
      {/* Corner markers */}
      {[[0,0],[0,SIZE-3],[SIZE-3,0]].map(([sr,sc],i) => (
        <rect
          key={`corner-${i}`}
          x={PAD + sc * CELL}
          y={PAD + sr * CELL}
          width={CELL * 3}
          height={CELL * 3}
          rx={3}
          fill="none"
          stroke="#0f172a"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
});
QRDisplay.displayName = 'QRDisplay';

// ─────────────────────────────────────────────────────────────────────────────
// Copy field (link or ID row)
// ─────────────────────────────────────────────────────────────────────────────
const CopyField = memo(({ label, value, displayValue, icon: Icon, iconColor, onCopy, copied }) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-bold tracking-[0.12em] uppercase"
       style={{ color: 'rgba(148,163,184,0.7)' }}>
      {label}
    </p>
    <div
      className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl transition-all"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}28` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
      </div>
      <span className="flex-1 text-xs font-mono text-slate-300 truncate leading-none">
        {displayValue ?? value}
      </span>
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onCopy}
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                   text-[11px] font-bold transition-all duration-300"
        style={{
          background: copied
            ? 'linear-gradient(135deg,#059669,#10b981)'
            : 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
          color: 'white',
          boxShadow: copied
            ? '0 4px 12px rgba(16,185,129,0.35)'
            : '0 4px 12px rgba(59,130,246,0.3)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="y"
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }} className="flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Copied!
            </motion.span>
          ) : (
            <motion.span key="n"
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }} className="flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  </div>
));
CopyField.displayName = 'CopyField';

// ─────────────────────────────────────────────────────────────────────────────
// Share channel button
// ─────────────────────────────────────────────────────────────────────────────
const ChannelBtn = memo(({ icon, label, onClick, bg, border, iconBg, iconColor, disabled }) => (
  <motion.button
    whileTap={{ scale: 0.93 }}
    whileHover={{ y: -2 }}
    onClick={onClick}
    disabled={disabled}
    aria-label={`Share via ${label}`}
    className="relative flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl
               transition-all duration-200 group focus:outline-none
               focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1
               focus-visible:ring-offset-slate-900"
    style={{
      background: bg,
      border: `1px solid ${border}`,
      opacity: disabled ? 0.45 : 1,
    }}
  >
    {/* Hover glow */}
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
      style={{ background: `radial-gradient(circle at 50% 100%, ${iconColor}14 0%, transparent 65%)` }}
    />
    <div
      className="relative w-9 h-9 rounded-xl flex items-center justify-center text-xl"
      style={{ background: iconBg, border: `1px solid ${border}` }}
    >
      {typeof icon === 'string' ? (
        <span style={{ lineHeight: 1 }}>{icon}</span>
      ) : (
        <span style={{ color: iconColor }}>{icon}</span>
      )}
    </div>
    <span className="relative text-[10px] font-semibold text-slate-400
                     group-hover:text-white transition-colors leading-none">
      {label}
    </span>
  </motion.button>
));
ChannelBtn.displayName = 'ChannelBtn';

// ─────────────────────────────────────────────────────────────────────────────
// Main ShareModal
// ─────────────────────────────────────────────────────────────────────────────
const ShareModal = memo(({ isOpen, onClose, roomId, meetingLink }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId,   setCopiedId]   = useState(false);
  const [showQR,     setShowQR]     = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);

  const trapRef = useFocusTrap(isOpen);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) { setCopiedLink(false); setCopiedId(false); setShowQR(false); }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // ── Copy helpers ──────────────────────────────────────────────────────────
  const copy = useCallback(async (text, setter, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      toast.success(`${label} copied!`, {
        style: {
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          fontSize: 13,
        },
        iconTheme: { primary: '#10b981', secondary: '#0f172a' },
      });
      setTimeout(() => setter(false), 2500);
    } catch { toast.error('Failed to copy'); }
  }, []);

  const copyLink = useCallback(() => copy(meetingLink, setCopiedLink, 'Link'), [meetingLink, copy]);
  const copyId   = useCallback(() => copy(roomId,      setCopiedId,   'Room ID'), [roomId, copy]);

  // ── Share channels ────────────────────────────────────────────────────────
  const encodedLink = encodeURIComponent(meetingLink);
  const encodedText = encodeURIComponent(`Join my V-Meet video call: ${meetingLink}`);
  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const shareChannels = [

    {
      label:    'WhatsApp',
      icon:     '💬',
      iconBg:   'rgba(37,211,102,0.15)',
      iconColor:'#25d366',
      bg:       'rgba(37,211,102,0.06)',
      border:   'rgba(37,211,102,0.2)',
      action:   () => window.open(`https://wa.me/?text=${encodedText}`, '_blank'),
    },
    {
      label:    'Telegram',
      icon:     '✈️',
      iconBg:   'rgba(0,136,204,0.15)',
      iconColor:'#0088cc',
      bg:       'rgba(0,136,204,0.06)',
      border:   'rgba(0,136,204,0.2)',
      action:   () => window.open(`https://t.me/share/url?url=${encodedLink}&text=${encodeURIComponent('Join my V-Meet video call')}`, '_blank'),
    },
    {
      label:    'Email',
      icon:     <Mail className="w-4 h-4" />,
      iconBg:   'rgba(245,158,11,0.15)',
      iconColor:'#fbbf24',
      bg:       'rgba(245,158,11,0.06)',
      border:   'rgba(245,158,11,0.2)',
      action:   () => window.open(`mailto:?subject=${encodeURIComponent('Join my V-Meet call')}&body=${encodedText}`),
    },
    {
      label:    'More',
      icon:     <Share2 className="w-4 h-4" />,
      iconBg:   'rgba(139,92,246,0.15)',
      iconColor:'#a78bfa',
      bg:       'rgba(139,92,246,0.06)',
      border:   'rgba(139,92,246,0.2)',
      disabled: !hasNativeShare,
      action:   () => {
        if (hasNativeShare) {
          navigator.share({ title: 'V-Meet Call', text: `Join my video call: ${meetingLink}`, url: meetingLink }).catch(() => {});
        } else {
          copyLink();
        }
      },
    },
  ];

  // Shorten link for display
  const shortLink = meetingLink?.replace(/^https?:\/\//, '') ?? '';

  // ── Animation variants ────────────────────────────────────────────────────
  const backdropVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
  };

  const mobileSheetVariants = {
    hidden:  { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 36 } },
    exit:    { y: '100%', opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } },
  };

  const desktopModalVariants = {
    hidden:  { opacity: 0, scale: 0.88, y: 24 },
    visible: { opacity: 1, scale: 1,    y: 0,
               transition: { type: 'spring', stiffness: 420, damping: 34 } },
    exit:    { opacity: 0, scale: 0.88, y: 24, transition: { duration: 0.18 } },
  };

  const contentVariants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  };

  const itemVariants = {
    hidden:  { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  };

  // ── Shared inner content ──────────────────────────────────────────────────
  const ModalContent = (
    <div
      className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
    >
    <motion.div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Share this call"
      variants={isMobile ? mobileSheetVariants : desktopModalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative w-full max-w-[440px] overflow-hidden flex flex-col rounded-[24px] pointer-events-auto"
      style={{
        background: 'linear-gradient(165deg, #0d1829 0%, #090e1a 55%, #07111f 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04) inset',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
      }}
      onClick={e => e.stopPropagation()}
    >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-between px-5 pt-4 pb-4 flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(56,189,248,0.1) 0%, rgba(99,102,241,0.08) 50%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Decorative orb */}
        <div
          className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)' }}
        />

        <div className="flex items-center gap-3 relative">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.2))',
              border: '1px solid rgba(56,189,248,0.3)',
              boxShadow: '0 0 20px rgba(56,189,248,0.15)',
            }}
          >
            <Share2 className="w-4.5 h-4.5 text-sky-300" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h2 className="text-white font-bold text-[15px] tracking-tight leading-none mb-1">
              Share this call
            </h2>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                style={{ background: '#10b981' }}
              />
              <span className="text-slate-400 text-[11px]">Live · Invite others to join</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close share modal"
          className="relative w-8 h-8 rounded-full flex items-center justify-center
                     text-slate-400 hover:text-white transition-all flex-shrink-0
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="overflow-y-auto overscroll-contain flex-1">
        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          className="px-5 py-4 space-y-4 pb-6"
        >

          {/* Meeting Link */}
          <motion.div variants={itemVariants}>
            <CopyField
              label="Meeting Link"
              value={meetingLink}
              displayValue={shortLink}
              icon={Link2}
              iconColor="#38bdf8"
              onCopy={copyLink}
              copied={copiedLink}
            />
          </motion.div>

          {/* Room ID */}
          <motion.div variants={itemVariants}>
            <CopyField
              label="Room ID"
              value={roomId}
              icon={({ className, style }) => (
                <svg className={className} style={style} viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h2v8H2V4zm3 0h1v8H5V4zm2 0h2v8H7V4zm3 0h1v8h-1V4zm2 0h2v8h-2V4z"
                    fill="currentColor" />
                </svg>
              )}
              iconColor="#f59e0b"
              onCopy={copyId}
              copied={copiedId}
            />
          </motion.div>

          {/* Share channels */}
          <motion.div variants={itemVariants}>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2"
               style={{ color: 'rgba(148,163,184,0.7)' }}>
              Share via
            </p>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Share via">
              {shareChannels.map((ch) => (
                <ChannelBtn key={ch.label} {...ch} onClick={ch.action} />
              ))}
            </div>
          </motion.div>

          {/* QR Code toggle */}
          <motion.div variants={itemVariants}>
            <button
              onClick={() => setShowQR(v => !v)}
              aria-expanded={showQR}
              aria-controls="qr-panel"
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl
                         transition-all duration-200 group
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              style={{
                background: showQR ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showQR ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: showQR ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${showQR ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <QrCode
                    className="w-3.5 h-3.5"
                    style={{ color: showQR ? '#38bdf8' : '#94a3b8' }}
                  />
                </div>
                <span
                  className="text-xs font-semibold transition-colors"
                  style={{ color: showQR ? '#e2e8f0' : '#94a3b8' }}
                >
                  {showQR ? 'Hide QR Code' : 'Show QR Code'}
                </span>
              </div>
              <motion.div
                animate={{ rotate: showQR ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown
                  className="w-4 h-4 transition-colors"
                  style={{ color: showQR ? '#38bdf8' : '#475569' }}
                />
              </motion.div>
            </button>

            {/* QR Panel */}
            <AnimatePresence>
              {showQR && (
                <motion.div
                  id="qr-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-2 rounded-2xl px-4 py-4 flex items-center gap-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
                      className="flex-shrink-0 rounded-xl overflow-hidden"
                      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                    >
                      <QRDisplay value={roomId} />
                    </motion.div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold mb-1.5">Scan to join</p>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Point a phone camera at this code to instantly open the meeting link.
                      </p>
                      <div
                        className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(56,189,248,0.1)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.2)' }}
                      >
                        <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" />
                        No app required
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer note */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
            style={{
              background: 'rgba(56,189,248,0.05)',
              border: '1px solid rgba(56,189,248,0.1)',
            }}
          >
            <Users className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Anyone with the link can join. No account required.
            </p>
          </motion.div>

        </motion.div>
      </div>
    </motion.div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="share-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)' }}
            onClick={onClose}
            aria-hidden="true"
          />
          {ModalContent}
        </>
      )}
    </AnimatePresence>
  );
});

ShareModal.displayName = 'ShareModal';
export default ShareModal;