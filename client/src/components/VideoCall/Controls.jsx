import { useState, memo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff,
  LayoutGrid, Users, MessageCircle, Hand, MoreHorizontal,
  SwitchCamera, UserCheck, MicOff as MuteAllIcon,
  Radio, StopCircle, Smile, Minimize2, ChevronDown,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Haptic helper
// ─────────────────────────────────────────────────────────────────────────────
const haptic = (pattern = [8]) => {
  try { navigator.vibrate?.(pattern); } catch (_) {}
};

const fmtDur = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ── Pulsing REC indicator ─────────────────────────────────────────────────────
const RecIndicator = ({ duration }) => (
  <motion.div
    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
               bg-red-500/15 border border-red-500/30 backdrop-blur-sm"
  >
    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
    </span>
    <span className="text-red-300 text-[10px] font-bold tracking-widest uppercase">REC</span>
    {duration > 0 && (
      <span className="font-mono text-red-200 text-[10px] font-bold tabular-nums ml-0.5">
        {fmtDur(duration)}
      </span>
    )}
  </motion.div>
);

// ── Screen share indicator ────────────────────────────────────────────────────
const ShareIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
               bg-sky-500/15 border border-sky-500/30 backdrop-blur-sm"
  >
    <MonitorUp className="w-3 h-3 text-sky-400" />
    <span className="text-sky-300 text-[10px] font-bold tracking-widest uppercase">Sharing</span>
  </motion.div>
);

// ── Status bar ────────────────────────────────────────────────────────────────
const StatusBar = ({ isRecording, isScreenSharing, recordingDuration }) => (
  <AnimatePresence>
    {(isRecording || isScreenSharing) && (
      <motion.div
        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="flex items-center justify-center gap-2 pt-2 pb-1 px-4">
          {isRecording    && <RecIndicator duration={recordingDuration} />}
          {isScreenSharing && <ShareIndicator />}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ── Tooltip (desktop only) ───────────────────────────────────────────────────
const Tip = ({ label, shortcut, children }) => (
  <div className="group relative flex items-center justify-center">
    {children}
    <div className="pointer-events-none absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2
                    opacity-0 group-hover:opacity-100 transition-all duration-150 z-50
                    hidden lg:flex flex-col items-center gap-1">
      <div className="bg-[#12172a] border border-white/12 text-white text-[11px] font-medium
                      px-2.5 py-1.5 rounded-xl shadow-2xl whitespace-nowrap flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="text-[9px] font-bold bg-white/10 border border-white/15
                          px-1.5 py-0.5 rounded-md text-slate-300 font-mono">
            {shortcut}
          </kbd>
        )}
      </div>
      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4
                      border-l-transparent border-r-transparent border-t-[#12172a]" />
    </div>
  </div>
);

// ── Ripple effect hook ────────────────────────────────────────────────────────
const useRipple = () => {
  const [ripples, setRipples] = useState([]);
  const trigger = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left;
    const y = (e.clientY ?? rect.top  + rect.height / 2) - rect.top;
    const id = Date.now();
    setRipples(r => [...r, { x, y, id }]);
    setTimeout(() => setRipples(r => r.filter(r => r.id !== id)), 600);
  }, []);
  return [ripples, trigger];
};

// ── Emoji picker ──────────────────────────────────────────────────────────────
const EMOJIS = ['❤️', '😂', '👏', '🎉', '👍', '🔥'];

const EmojiPicker = memo(({ onSelect, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.9 }}
    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
    className="flex gap-1 p-2.5 rounded-2xl
               bg-[#0d1017]/98 backdrop-blur-2xl border border-white/12
               shadow-2xl shadow-black/80"
    onClick={e => e.stopPropagation()}
  >
    {EMOJIS.map((e, i) => (
      <motion.button
        key={e}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        whileHover={{ scale: 1.35, y: -6 }}
        whileTap={{ scale: 0.85 }}
        onClick={() => { haptic([6]); onSelect(e); onClose(); }}
        className="w-10 h-10 text-xl flex items-center justify-center rounded-xl
                   hover:bg-white/10 active:bg-white/15 transition-colors"
      >
        {e}
      </motion.button>
    ))}
  </motion.div>
));
EmojiPicker.displayName = 'EmojiPicker';

// ── Mobile Bottom Sheet ───────────────────────────────────────────────────────
// Renders above the control bar (absolute bottom-full).
// Clicking ANYWHERE outside the sheet panel closes it.
const MobileSheet = memo(({ items, onClose }) => {
  const sheetRef = useRef(null);

  // Close on any pointerdown that lands outside the sheet panel
  useEffect(() => {
    const handler = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Use capture so we intercept before children can stopPropagation
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [onClose]);

  return (
    <>
      {/* Full-screen dimmed backdrop — purely visual, pointer-events none so
          the document pointerdown handler above catches outside taps cleanly */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        style={{ zIndex: 45 }}
        aria-hidden="true"
      />

      {/* Sheet panel — absolute bottom-full so it sits just above the control bar */}
      <motion.div
        ref={sheetRef}
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 440, damping: 36, mass: 0.8 }}
        className="absolute bottom-full left-0 right-0
                   bg-[#0e1118] border border-white/10 border-b-0
                   rounded-t-[22px] overflow-hidden"
        style={{ zIndex: 50, boxShadow: '0 -6px 40px rgba(0,0,0,0.8)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-0.5">
          <div className="w-9 h-[3px] rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2 pb-2.5">
          <span className="text-white/55 text-[11px] font-bold tracking-[0.12em] uppercase">
            More Options
          </span>
          <motion.button
            whileTap={{ scale: 0.84 }}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 border border-white/10
                       flex items-center justify-center text-white/40 hover:text-white/70
                       hover:bg-white/12 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* 2-column grid of action cards */}
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          {items.map((item, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => { haptic([8]); item.onClick?.(); onClose(); }}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl
                          border transition-all text-left
                          ${item.danger
                            ? 'bg-red-500/10 border-red-500/18 active:bg-red-500/16'
                            : item.active
                              ? 'bg-blue-500/12 border-blue-500/22 active:bg-blue-500/18'
                              : 'bg-white/5 border-white/8 active:bg-white/10'}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                ${item.danger
                  ? 'bg-red-500/16 border border-red-500/22'
                  : item.active
                    ? 'bg-blue-500/20 border border-blue-500/30'
                    : 'bg-white/8 border border-white/10'}`}>
                <item.icon className={`w-[15px] h-[15px]
                  ${item.danger ? 'text-red-400' : item.active ? 'text-blue-300' : 'text-slate-300'}`} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-[12.5px] font-semibold leading-snug truncate
                  ${item.danger ? 'text-red-300' : item.active ? 'text-blue-200' : 'text-slate-100'}`}>
                  {item.label}
                </span>
                {item.trailing && (
                  <span className="mt-0.5 leading-none">{item.trailing}</span>
                )}
                {item.active && !item.trailing && (
                  <span className="text-[10px] text-blue-400 font-medium mt-0.5 leading-none">On</span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </>
  );
});
MobileSheet.displayName = 'MobileSheet';

// ── Desktop More Drawer (unchanged, used on md+) ──────────────────────────────
const DesktopDrawer = memo(({ items, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 12, scale: 0.94 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 12, scale: 0.94 }}
    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50
               w-64 rounded-2xl overflow-hidden
               bg-[#0d1017]/98 backdrop-blur-2xl border border-white/10
               shadow-2xl shadow-black/80"
    onClick={e => e.stopPropagation()}
  >
    {items.map((item, i) => (
      <motion.button
        key={i}
        whileTap={{ scale: 0.97 }}
        onClick={() => { haptic([8]); item.onClick?.(); onClose(); }}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm transition-all
                    ${i < items.length - 1 ? 'border-b border-white/6' : ''}
                    ${item.danger
                      ? 'text-red-400 hover:bg-red-500/8 active:bg-red-500/14'
                      : 'text-slate-200 hover:bg-white/5 active:bg-white/9'}`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
          ${item.danger
            ? 'bg-red-500/15 border border-red-500/20'
            : item.active
              ? 'bg-blue-500/20 border border-blue-500/30'
              : 'bg-white/6 border border-white/8'}`}>
          <item.icon className={`w-4 h-4
            ${item.danger ? 'text-red-400' : item.active ? 'text-blue-300' : 'text-slate-300'}`} />
        </div>
        <span className="flex-1 text-left font-medium text-[13px]">{item.label}</span>
        {item.trailing}
        {item.active && !item.trailing && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
        )}
      </motion.button>
    ))}
  </motion.div>
));
DesktopDrawer.displayName = 'DesktopDrawer';

// ── Transparent backdrop ──────────────────────────────────────────────────────
const Backdrop = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-40"
    onClick={onClose}
  />
);

// ── Core button primitive ─────────────────────────────────────────────────────
const Btn = memo(({
  onClick, label, title, icon: Icon, iconEl,
  variant = 'default',
  pulse = false,
  badge = 0,
  size = 'md',
  showLabel = true,
  disabled = false,
}) => {
  const [ripples, triggerRipple] = useRipple();

  const iconCls = { sm: 'w-4 h-4', md: 'w-[18px] h-[18px]', lg: 'w-5 h-5' }[size];
  const btnCls  = { sm: 'w-9 h-9', md: 'w-11 h-11',          lg: 'w-12 h-12' }[size];

  const bg = {
    default:  'bg-white/7 hover:bg-white/13 active:bg-white/18 border border-white/8 text-slate-200 hover:text-white',
    active:   'bg-blue-500/22 hover:bg-blue-500/32 active:bg-blue-500/40 border border-blue-500/40 text-blue-300',
    danger:   'bg-red-500/18 hover:bg-red-500/28 active:bg-red-500/36 border border-red-500/32 text-red-300',
    end:      'bg-red-600 hover:bg-red-500 active:bg-red-700 border border-red-400/30 text-white shadow-lg shadow-red-900/60',
    minimize: 'bg-slate-600/40 hover:bg-slate-500/50 active:bg-slate-400/50 border border-slate-500/30 text-slate-300 hover:text-white',
  }[variant];

  const handleClick = useCallback((e) => {
    if (disabled) return;
    haptic(variant === 'end' ? [15, 8, 15] : variant === 'danger' ? [10] : [6]);
    triggerRipple(e);
    onClick?.(e);
  }, [disabled, variant, triggerRipple, onClick]);

  return (
    <div className="relative flex flex-col items-center gap-1 select-none">
      <motion.button
        whileTap={{ scale: disabled ? 1 : 0.85 }}
        whileHover={{ scale: disabled ? 1 : 1.06 }}
        onClick={handleClick}
        disabled={disabled}
        title={title || label}
        className={`
          relative ${btnCls} rounded-2xl flex items-center justify-center
          transition-all duration-150 touch-manipulation overflow-hidden
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
          ${bg}
          ${pulse ? 'animate-pulse' : ''}
          ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {ripples.map(r => (
          <span
            key={r.id}
            className="absolute rounded-full bg-white/25 pointer-events-none"
            style={{
              left: r.x - 10, top: r.y - 10,
              width: 20, height: 20,
              animation: 'ping 0.5s cubic-bezier(0,0,0.2,1) 1',
            }}
          />
        ))}
        {iconEl ?? (Icon && <Icon className={iconCls} />)}
      </motion.button>

      {badge > 0 && (
        <motion.span
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500
                     rounded-full flex items-center justify-center pointer-events-none
                     text-[9px] font-bold text-white px-0.5 ring-2 ring-slate-950 z-10"
        >
          {badge > 99 ? '99+' : badge}
        </motion.span>
      )}

      {showLabel && label && (
        <span className={`
          text-[10px] font-medium leading-none text-center truncate max-w-[60px]
          pointer-events-none transition-colors duration-150
          ${variant === 'end'      ? 'text-red-400'
          : variant === 'danger'   ? 'text-red-400'
          : variant === 'active'   ? 'text-blue-400'
          : variant === 'minimize' ? 'text-slate-400'
          : 'text-slate-500'}
        `}>
          {label}
        </span>
      )}
    </div>
  );
});
Btn.displayName = 'Btn';

const Divider = () => (
  <div className="w-px self-stretch my-1 bg-white/8 flex-shrink-0 mx-0.5 lg:mx-1" />
);

// ── Responsive More Menu ─────────────────────────────────────────────────────
const MoreMenu = ({ items, open, onClose, isMobile }) => (
  <AnimatePresence>
    {open && (
      isMobile
        ? <MobileSheet items={items} onClose={onClose} />
        : <>
            <Backdrop onClose={onClose} />
            <DesktopDrawer items={items} onClose={onClose} />
          </>
    )}
  </AnimatePresence>
);

// ─────────────────────────────────────────────────────────────────────────────
// CALL CONTROLS — floating pill above video
// ─────────────────────────────────────────────────────────────────────────────
const CallControls = memo(({
  isMuted, isVideoOff, isScreenSharing, isRecording,
  onToggleMute, onToggleVideo, onToggleScreenShare,
  onToggleRecording, onEndCall, onSwitchCamera,
  onReaction, recordingDuration = 0,
  onMinimize,
}) => {
  const [openPanel, setOpenPanel] = useState(null);

  const togglePanel = useCallback((name) => {
    haptic([6]);
    setOpenPanel(p => p === name ? null : name);
  }, []);

  const closeAll = useCallback(() => setOpenPanel(null), []);

  const [callWinW, setCallWinW] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth : 1024,
  );
  useEffect(() => {
    const h = () => setCallWinW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const callIsMd  = callWinW >= 768;
  const isMobile  = callWinW < 640;

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'm') onToggleMute?.();
      if (e.key === 'v') onToggleVideo?.();
      if (e.key === 's') onToggleScreenShare?.();
      if (e.key === 'r') onToggleRecording?.();
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggleMute, onToggleVideo, onToggleScreenShare, onToggleRecording, closeAll]);

  const moreItems = [
    { icon: SwitchCamera, label: 'Flip Camera', onClick: onSwitchCamera },
    ...(!callIsMd ? [{
      icon: MonitorUp,
      label: isScreenSharing ? 'Stop Sharing' : 'Share Screen',
      active: isScreenSharing,
      onClick: onToggleScreenShare,
    }] : []),
    ...(!callIsMd ? [{
      icon: isRecording ? StopCircle : Radio,
      label: isRecording ? 'Stop Recording' : 'Start Recording',
      danger: isRecording,
      active: isRecording,
      onClick: onToggleRecording,
      trailing: isRecording && recordingDuration > 0
        ? <span className="font-mono text-[10px] text-red-300 tabular-nums">{fmtDur(recordingDuration)}</span>
        : null,
    }] : []),
    ...(onMinimize ? [{ icon: Minimize2, label: 'Minimize', onClick: onMinimize }] : []),
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center
                    pb-[env(safe-area-inset-bottom,0px)]">
      <StatusBar isRecording={isRecording} isScreenSharing={isScreenSharing} recordingDuration={recordingDuration} />

      <AnimatePresence>
        {openPanel === 'emoji' && !isMobile && <Backdrop onClose={closeAll} />}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'emoji' && (
          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50">
            <EmojiPicker
              onSelect={e => { onReaction?.(e); closeAll(); }}
              onClose={closeAll}
            />
          </div>
        )}
      </AnimatePresence>

      <MoreMenu items={moreItems} open={openPanel === 'more'} onClose={closeAll} isMobile={isMobile} />

      <div className="w-full flex justify-center px-3 pb-4 sm:pb-6">
        <motion.div
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.05 }}
          className="relative z-50 flex items-center gap-2 sm:gap-2.5 lg:gap-3
                     px-3 sm:px-4 lg:px-6 py-3 sm:py-3.5
                     bg-[#080c12]/94 backdrop-blur-2xl
                     rounded-[22px] border border-white/8"
          style={{ boxShadow: '0 8px 48px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.055)' }}
        >
          <Tip label={isMuted ? 'Unmute' : 'Mute'} shortcut="M">
            <Btn icon={isMuted ? MicOff : Mic} label={isMuted ? 'Unmute' : 'Mute'}
              variant={isMuted ? 'danger' : 'default'} onClick={onToggleMute} />
          </Tip>

          <Tip label={isVideoOff ? 'Start Camera' : 'Stop Camera'} shortcut="V">
            <Btn icon={isVideoOff ? VideoOff : Video} label={isVideoOff ? 'Start' : 'Stop'}
              variant={isVideoOff ? 'danger' : 'default'} onClick={onToggleVideo} />
          </Tip>

          <div className="hidden md:block">
            <Tip label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'} shortcut="S">
              <Btn icon={MonitorUp} label={isScreenSharing ? 'Sharing' : 'Share'}
                variant={isScreenSharing ? 'active' : 'default'} onClick={onToggleScreenShare} />
            </Tip>
          </div>

          <div className="hidden md:block">
            <Tip label={isRecording ? 'Stop Recording' : 'Record'} shortcut="R">
              <Btn icon={isRecording ? StopCircle : Radio}
                label={isRecording ? fmtDur(recordingDuration) : 'Record'}
                variant={isRecording ? 'danger' : 'default'} pulse={isRecording}
                onClick={onToggleRecording} />
            </Tip>
          </div>

          <Tip label="Reactions">
            <Btn
              iconEl={<Smile className="w-[18px] h-[18px]" />}
              label="React"
              variant={openPanel === 'emoji' ? 'active' : 'default'}
              onClick={() => togglePanel('emoji')}
            />
          </Tip>

          <Tip label="More options">
            <Btn
              icon={MoreHorizontal}
              label="More"
              variant={openPanel === 'more' ? 'active' : 'default'}
              onClick={() => togglePanel('more')}
            />
          </Tip>

          <Divider />

          <Tip label="End Call" shortcut="⌘W">
            <Btn icon={PhoneOff} label="End" variant="end" size="lg" onClick={onEndCall} />
          </Tip>
        </motion.div>
      </div>
    </div>
  );
});
CallControls.displayName = 'CallControls';


// ─────────────────────────────────────────────────────────────────────────────
// MEETING CONTROLS — anchored bottom bar
// ─────────────────────────────────────────────────────────────────────────────
const MeetingControls = memo(({
  isMuted, isVideoOff, isScreenSharing, isRecording,
  onToggleMute, onToggleVideo, onToggleScreenShare,
  onToggleRecording, onEndCall,
  participantCount = 0,
  onToggleChat, isChatOpen,
  onToggleParticipants, isParticipantsOpen,
  viewMode, onToggleViewMode,
  onRaiseHand, handRaised,
  raisedHandCount = 0,
  isHost          = false,
  isForceMuted    = false,
  allowSelfUnmute = true,
  onMuteAll,
  onToggleAllowUnmute,
  onReaction,
  unreadCount = 0,
  recordingDuration = 0,
  onMinimize,
}) => {
  const [openPanel, setOpenPanel] = useState(null);

  const togglePanel = useCallback((name) => {
    haptic([6]);
    setOpenPanel(p => p === name ? null : name);
  }, []);

  const closeAll = useCallback(() => setOpenPanel(null), []);

  const [winW, setWinW] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth : 1024,
  );
  useEffect(() => {
    const h = () => setWinW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = winW < 640;
  const isMd     = winW >= 640;
  const isLg     = winW >= 1024;

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'm') onToggleMute?.();
      if (e.key === 'v') onToggleVideo?.();
      if (e.key === 's') onToggleScreenShare?.();
      if (e.key === 'r') onToggleRecording?.();
      if (e.key === 'c') onToggleChat?.();
      if (e.key === 'p') onToggleParticipants?.();
      if (e.key === 'h') onRaiseHand?.();
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggleMute, onToggleVideo, onToggleScreenShare, onToggleRecording,
      onToggleChat, onToggleParticipants, onRaiseHand, closeAll]);

  const moreItems = [
    { icon: SwitchCamera, label: 'Flip Camera', onClick: () => {} },
    ...(!isMd ? [{ icon: Hand, label: handRaised ? 'Lower Hand' : 'Raise Hand', active: handRaised, onClick: onRaiseHand }] : []),
    ...(!isMd ? [{
      icon: Users,
      label: `People${participantCount > 0 ? ` (${participantCount})` : ''}`,
      active: isParticipantsOpen,
      onClick: onToggleParticipants,
    }] : []),
    ...(!isLg ? [{
      icon: viewMode === 'grid' ? UserCheck : LayoutGrid,
      label: viewMode === 'grid' ? 'Speaker View' : 'Grid View',
      onClick: onToggleViewMode,
    }] : []),
    ...(!isLg ? [{
      icon: MonitorUp,
      label: isScreenSharing ? 'Stop Sharing' : 'Share Screen',
      active: isScreenSharing,
      onClick: onToggleScreenShare,
    }] : []),
    ...(isHost ? [
      { icon: MuteAllIcon, label: 'Mute Everyone', onClick: onMuteAll },
      {
        icon: MuteAllIcon,
        label: allowSelfUnmute ? 'Lock Unmute' : 'Allow Unmute',
        onClick: () => onToggleAllowUnmute?.(!allowSelfUnmute),
      },
    ] : []),
    ...(!isLg ? [{
      icon: isRecording ? StopCircle : Radio,
      label: isRecording ? 'Stop Recording' : 'Record',
      danger: isRecording,
      active: isRecording,
      onClick: onToggleRecording,
      trailing: isRecording && recordingDuration > 0
        ? <span className="font-mono text-[10px] text-red-300 tabular-nums">{fmtDur(recordingDuration)}</span>
        : null,
    }] : []),
    ...(onMinimize && !isLg ? [{ icon: Minimize2, label: 'Minimize', onClick: onMinimize }] : []),
  ];

  return (
    <div
      className="relative bg-[#07090f]/40 backdrop-blur-xl border-t border-white/4
                 pb-[env(safe-area-inset-bottom,0px)] overflow-visible"
      style={{ boxShadow: '0 -1px 0 rgba(255,255,255,0.02), 0 -16px 48px rgba(0,0,0,0.3)' }}
    >
      <StatusBar isRecording={isRecording} isScreenSharing={isScreenSharing} recordingDuration={recordingDuration} />

      {/* Emoji picker */}
      <AnimatePresence>
        {openPanel === 'emoji' && (
          <div className="absolute bottom-full left-0 right-0 z-50 flex justify-center pb-3 pointer-events-none">
            <div className="pointer-events-auto">
              <EmojiPicker
                onSelect={e => { onReaction?.(e); closeAll(); }}
                onClose={closeAll}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* More menu — sheet on mobile, drawer on desktop */}
      <MoreMenu items={moreItems} open={openPanel === 'more'} onClose={closeAll} isMobile={isMobile} />

      {/* ── Mobile layout: 2-row grid ── */}
      {isMobile ? (
        <div className="px-3 pt-3 pb-2">
          {/* Row 1: primary actions */}
          <div className="flex items-center justify-between gap-1 mb-2">
            {/* Mic */}
            <div className="relative flex flex-col items-center gap-1">
              {isForceMuted && !allowSelfUnmute && (
                <span className="absolute inset-0 rounded-2xl animate-ping bg-red-500/20 pointer-events-none" />
              )}
              <Btn
                icon={isMuted ? MicOff : Mic}
                label={isForceMuted && !allowSelfUnmute ? 'Locked' : isMuted ? 'Unmute' : 'Mute'}
                variant={isMuted ? 'danger' : 'default'}
                onClick={onToggleMute}
                disabled={isForceMuted && !allowSelfUnmute}
              />
              {isForceMuted && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center
                             pointer-events-none z-10 ring-2 ring-slate-950 bg-red-600 text-white text-[9px] font-bold"
                >
                  {allowSelfUnmute ? '!' : '🔒'}
                </motion.span>
              )}
            </div>

            {/* Camera */}
            <Btn
              icon={isVideoOff ? VideoOff : Video}
              label={isVideoOff ? 'Start' : 'Camera'}
              variant={isVideoOff ? 'danger' : 'default'}
              onClick={onToggleVideo}
            />

            {/* Chat */}
            <Btn
              icon={MessageCircle}
              label="Chat"
              variant={isChatOpen ? 'active' : 'default'}
              badge={isChatOpen ? 0 : unreadCount}
              onClick={onToggleChat}
            />

            {/* React */}
            <Btn
              iconEl={<Smile className="w-[18px] h-[18px]" />}
              label="React"
              variant={openPanel === 'emoji' ? 'active' : 'default'}
              onClick={() => togglePanel('emoji')}
            />

            {/* More */}
            {moreItems.length > 0 && (
              <Btn
                icon={MoreHorizontal}
                label="More"
                variant={openPanel === 'more' ? 'active' : 'default'}
                onClick={() => togglePanel('more')}
              />
            )}

            {/* End — larger, prominent */}
            <Btn icon={PhoneOff} label="End" variant="end" size="lg" onClick={onEndCall} />
          </div>
        </div>
      ) : (
        /* ── Tablet / Desktop layout: single row ── */
        <div className="flex items-center justify-center flex-wrap sm:flex-nowrap
                        gap-0.5 xs:gap-1 sm:gap-1.5 lg:gap-2
                        px-2 sm:px-4 lg:px-8 py-2.5 sm:py-3 lg:py-3.5">

          <Tip label={
            isForceMuted && !allowSelfUnmute ? 'Muted by host (locked)'
            : isForceMuted ? 'Muted by host — tap to unmute'
            : isMuted ? 'Unmute' : 'Mute'
          } shortcut="M">
            <div className="relative">
              {isForceMuted && !allowSelfUnmute && (
                <span className="absolute inset-0 rounded-2xl animate-ping bg-red-500/20 pointer-events-none" />
              )}
              <Btn
                icon={isMuted ? MicOff : Mic}
                label={isForceMuted && !allowSelfUnmute ? 'Locked' : isMuted ? 'Unmute' : 'Mute'}
                variant={isMuted ? 'danger' : 'default'}
                onClick={onToggleMute}
                disabled={isForceMuted && !allowSelfUnmute}
              />
              {isForceMuted && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center
                             pointer-events-none z-10 ring-2 ring-slate-950 bg-red-600 text-white text-[9px] font-bold"
                >
                  {allowSelfUnmute ? '!' : '🔒'}
                </motion.span>
              )}
            </div>
          </Tip>

          <Tip label={isVideoOff ? 'Start Camera' : 'Stop Camera'} shortcut="V">
            <Btn icon={isVideoOff ? VideoOff : Video} label={isVideoOff ? 'Start' : 'Camera'}
              variant={isVideoOff ? 'danger' : 'default'} onClick={onToggleVideo} />
          </Tip>

          <Tip label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'} shortcut="S">
            <Btn icon={MonitorUp} label={isScreenSharing ? 'Sharing' : 'Share'}
              variant={isScreenSharing ? 'active' : 'default'} onClick={onToggleScreenShare} />
          </Tip>

          <div className="hidden sm:block"><Divider /></div>

          <Tip label="Chat" shortcut="C">
            <Btn icon={MessageCircle} label="Chat"
              variant={isChatOpen ? 'active' : 'default'}
              badge={isChatOpen ? 0 : unreadCount}
              onClick={onToggleChat} />
          </Tip>

          <div className="hidden sm:block">
            <Tip label={`People (${participantCount})`} shortcut="P">
              <Btn icon={Users}
                label={participantCount > 0 ? `${participantCount}` : 'People'}
                variant={isParticipantsOpen ? 'active' : 'default'}
                onClick={onToggleParticipants} />
            </Tip>
          </div>

          <Tip label="Reactions">
            <Btn
              iconEl={<Smile className="w-[18px] h-[18px]" />}
              label="React"
              variant={openPanel === 'emoji' ? 'active' : 'default'}
              onClick={() => togglePanel('emoji')}
            />
          </Tip>

          <div className="hidden md:block">
            <Tip label={handRaised ? 'Lower Hand ✋'
              : raisedHandCount > 0 ? `Raise Hand (${raisedHandCount} raised)` : 'Raise Hand'}
              shortcut="H">
              <div className="relative">
                {raisedHandCount > 0 && !handRaised && (
                  <span className="absolute inset-0 rounded-2xl animate-ping bg-amber-400/25 pointer-events-none" />
                )}
                <Btn
                  icon={Hand}
                  label={handRaised ? 'Lower' : 'Hand'}
                  variant={handRaised ? 'active' : 'default'}
                  onClick={onRaiseHand}
                  badge={raisedHandCount > 0 && !handRaised ? raisedHandCount : 0}
                />
              </div>
            </Tip>
          </div>

          <div className="hidden lg:block">
            <Tip label={viewMode === 'grid' ? 'Speaker View' : 'Grid View'}>
              <Btn icon={viewMode === 'grid' ? UserCheck : LayoutGrid}
                label={viewMode === 'grid' ? 'Speaker' : 'Grid'}
                onClick={onToggleViewMode} />
            </Tip>
          </div>

          <div className="hidden lg:block">
            <Tip label={isRecording ? 'Stop Recording' : 'Record'} shortcut="R">
              <Btn icon={isRecording ? StopCircle : Radio}
                label={isRecording ? fmtDur(recordingDuration) : 'Record'}
                variant={isRecording ? 'danger' : 'default'} pulse={isRecording}
                onClick={onToggleRecording} />
            </Tip>
          </div>

          {onMinimize && (
            <div className="hidden lg:block">
              <Tip label="Minimize call">
                <Btn icon={Minimize2} label="Min" variant="minimize" onClick={onMinimize} />
              </Tip>
            </div>
          )}

          {moreItems.length > 0 && (
            <Tip label="More options">
              <Btn
                icon={MoreHorizontal}
                label="More"
                variant={openPanel === 'more' ? 'active' : 'default'}
                onClick={() => togglePanel('more')}
              />
            </Tip>
          )}

          <div className="hidden sm:block"><Divider /></div>

          <Tip label="Leave call" shortcut="⌘W">
            <Btn icon={PhoneOff} label="End" variant="end" size="lg" onClick={onEndCall} />
          </Tip>
        </div>
      )}
    </div>
  );
});
MeetingControls.displayName = 'MeetingControls';


// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────────────────────
const Controls = memo(({ mode = 'call', ...props }) => (
  <AnimatePresence mode="wait">
    {mode === 'meeting' ? (
      <motion.div key="meeting"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }}
      >
        <MeetingControls {...props} />
      </motion.div>
    ) : (
      <motion.div key="call"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.22 }}
        className="absolute bottom-0 left-0 right-0 z-10"
      >
        <CallControls {...props} />
      </motion.div>
    )}
  </AnimatePresence>
));
Controls.displayName = 'Controls';

export default Controls;