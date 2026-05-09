import { useState, useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import VideoTile from './VideoTile';
import ScreenShareView from './ScreenShareView';

// ─── Design tokens — Zoom-inspired ────────────────────────────────────────────
const Z = {
  bg:           '#1c1c1c',   // Zoom's exact dark canvas
  border:       'rgba(255,255,255,0.07)',
  activeBorder: '#4CAF50',   // Zoom's active-speaker green
  pinnedBorder: '#2196F3',
  gap:          3,
  radius:       8,
  filmH:        94,          // filmstrip height px
  pageSize:     25,          // max tiles/page (Zoom default)
};

// ─── Grid calculator — mirrors Zoom's algorithm ────────────────────────────────
function calcGrid(n) {
  if (n === 1)  return { cols: 1, rows: 1 };
  if (n === 2)  return { cols: 2, rows: 1 };
  if (n <= 4)   return { cols: 2, rows: 2 };
  if (n <= 6)   return { cols: 3, rows: 2 };
  if (n <= 9)   return { cols: 3, rows: 3 };
  if (n <= 12)  return { cols: 4, rows: 3 };
  if (n <= 16)  return { cols: 4, rows: 4 };
  if (n <= 20)  return { cols: 5, rows: 4 };
  return         { cols: 5, rows: 5 };
}

const toMap = (rs) =>
  rs instanceof Map ? rs : new Map(Object.entries(rs ?? {}));

const SPRING = { type: 'spring', stiffness: 320, damping: 30, mass: 0.85 };

// ─── Pagination ────────────────────────────────────────────────────────────────
const PageControls = memo(({ page, total, onPrev, onNext }) => {
  if (total <= 1) return null;
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
        onClick={onPrev} disabled={page === 0}
        className="w-8 h-8 rounded-full bg-black/70 border border-white/20 text-white
                   flex items-center justify-center disabled:opacity-30 backdrop-blur-sm">
        <ChevronLeft className="w-4 h-4" />
      </motion.button>
      <span className="text-white/80 text-xs font-medium bg-black/60 px-3 py-1.5
                       rounded-full backdrop-blur-sm border border-white/10 select-none">
        {page + 1} / {total}
      </span>
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
        onClick={onNext} disabled={page === total - 1}
        className="w-8 h-8 rounded-full bg-black/70 border border-white/20 text-white
                   flex items-center justify-center disabled:opacity-30 backdrop-blur-sm">
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </div>
  );
});
PageControls.displayName = 'PageControls';

// ─── Pin badge ─────────────────────────────────────────────────────────────────
const PinBadge = memo(() => (
  <motion.div
    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }} transition={SPRING}
    className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-0.5
               rounded-full text-[10px] font-bold tracking-widest uppercase
               text-blue-200 select-none pointer-events-none"
    style={{
      background: 'rgba(33,150,243,0.22)',
      border: '1px solid rgba(33,150,243,0.4)',
      backdropFilter: 'blur(8px)',
    }}
  >📌 Pinned</motion.div>
));
PinBadge.displayName = 'PinBadge';

// ─── Waiting overlay ──────────────────────────────────────────────────────────
const WaitingOverlay = memo(() => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="absolute inset-0 flex flex-col items-center justify-center
               pointer-events-none select-none z-10">
    <motion.div
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      className="w-16 h-16 rounded-full mb-4 flex items-center justify-center"
      style={{
        background: 'rgba(76,175,80,0.10)',
        border: '1px solid rgba(76,175,80,0.22)',
        boxShadow: '0 0 40px rgba(76,175,80,0.12)',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="rgba(76,175,80,0.75)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </motion.div>
    <p className="text-slate-400 text-sm font-medium tracking-wide">
      Waiting for others to join…
    </p>
    <div className="flex gap-1.5 mt-3">
      {[0, 0.22, 0.44].map((d, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.3, 0.85, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5, delay: d }}
          className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      ))}
    </div>
  </motion.div>
));
WaitingOverlay.displayName = 'WaitingOverlay';

// ─── Fullscreen overlay ───────────────────────────────────────────────────────
const FullscreenOverlay = memo(({ participant, activeSpeaker, onClose }) => (
  <motion.div key="fullscreen"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.22 }}
    className="fixed inset-0 z-[100] bg-black">
    <VideoTile
      stream={participant.stream} username={participant.username}
      isMuted={participant.isMuted} isVideoOff={participant.isVideoOff}
      isLocal={participant.isLocal} isActive={activeSpeaker === participant.id}
      className="w-full h-full rounded-none"
    />
    <motion.button
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }} onClick={onClose}
      className="absolute top-4 right-4 z-10 flex items-center gap-2 px-4 py-2
                 rounded-full text-sm font-medium text-white active:scale-95"
      style={{
        background: 'rgba(10,10,10,0.82)',
        border: '1px solid rgba(255,255,255,0.16)',
        backdropFilter: 'blur(14px)',
      }}>
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      Exit Fullscreen
    </motion.button>
  </motion.div>
));
FullscreenOverlay.displayName = 'FullscreenOverlay';

// ─── Gallery tile ─────────────────────────────────────────────────────────────
const GalleryTile = memo(({ p, isActive, isPinned, onMaximize, onPin }) => (
  <motion.div layout layoutId={`tile-${p.id}`}
    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.88 }} transition={SPRING}
    onDoubleClick={() => onMaximize(p.id)}
    style={{
      borderRadius: Z.radius, overflow: 'hidden',
      minHeight: 0, minWidth: 0,
      outline: isActive
        ? `2px solid ${Z.activeBorder}`
        : isPinned ? `2px solid ${Z.pinnedBorder}` : `1px solid ${Z.border}`,
      outlineOffset: isActive || isPinned ? '-2px' : '-1px',
    }}>
    <VideoTile
      stream={p.stream} username={p.username} isMuted={p.isMuted}
      isVideoOff={p.isVideoOff} isLocal={p.isLocal}
      isActive={isActive} isPinned={isPinned}
      onPin={() => onPin?.(p.id)} onMaximize={() => onMaximize(p.id)}
      className="w-full h-full rounded-none"
    />
  </motion.div>
));
GalleryTile.displayName = 'GalleryTile';

// ─── Filmstrip thumbnail (speaker view bottom strip) ──────────────────────────
const FilmThumb = memo(({ p, isActive, isPinned, onPin, onMaximize }) => (
  <motion.div layout layoutId={`thumb-${p.id}`}
    initial={{ opacity: 0, scale: 0.82, x: 20 }}
    animate={{ opacity: 1, scale: 1, x: 0 }}
    exit={{ opacity: 0, scale: 0.82, x: -12 }}
    transition={SPRING}
    onClick={() => onPin?.(p.id)} onDoubleClick={() => onMaximize(p.id)}
    style={{
      width:  Math.round((Z.filmH - Z.gap * 2) * (16 / 9)),  // 16:9
      height: Z.filmH - Z.gap * 2,
      flexShrink: 0, borderRadius: Z.radius,
      overflow: 'hidden', cursor: 'pointer',
      outline: isActive
        ? `2px solid ${Z.activeBorder}`
        : isPinned ? `2px solid ${Z.pinnedBorder}` : `1px solid ${Z.border}`,
      outlineOffset: isActive || isPinned ? '-2px' : '-1px',
    }}>
    <VideoTile
      stream={p.stream} username={p.username} isMuted={p.isMuted}
      isVideoOff={p.isVideoOff} isLocal={p.isLocal}
      isActive={isActive} isFloating
      className="w-full h-full rounded-none"
    />
  </motion.div>
));
FilmThumb.displayName = 'FilmThumb';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const MeetingLayout = memo(({
  localStream, remoteStreams, localUserId, localUsername,
  isMuted, isVideoOff, activeSpeaker,
  participants    = [],
  viewMode        = 'grid',
  pinnedUserId    = null,
  onPin,
  screenStream    = null,
  presenterUserId = null,
  onStopSharing, onControlsReveal,
  forceMutedIds   = new Set(),
}) => {
  const [fullscreenId, setFullscreenId] = useState(null);
  const [page,         setPage]         = useState(0);
  const filmRef = useRef(null);

  const remoteMap     = useMemo(() => toMap(remoteStreams), [remoteStreams]);
  const remoteEntries = useMemo(() => Array.from(remoteMap.entries()), [remoteMap]);

  const getUsername = useCallback((uid) => {
    const p = participants.find(p => (p.userId ?? p) === uid);
    return p?.username ?? `User ${String(uid).slice(0, 4)}`;
  }, [participants]);

  const allParticipants = useMemo(() => [
    { id: localUserId, stream: localStream, username: localUsername,
      isMuted, isVideoOff, isLocal: true },
    ...remoteEntries.map(([id, s]) => ({
      id, stream: s, username: getUsername(id),
      isMuted: forceMutedIds.has(id), isVideoOff: false, isLocal: false,
    })),
  ], [localUserId, localStream, localUsername, isMuted, isVideoOff,
      remoteEntries, getUsername, forceMutedIds]);

  const screenInfo = useMemo(() => {
    if (!presenterUserId) return null;
    if (presenterUserId === localUserId)
      return screenStream ? { stream: screenStream, isLocal: true, name: localUsername } : null;
    const rs = remoteMap.get(presenterUserId);
    return rs ? { stream: rs, isLocal: false, name: getUsername(presenterUserId) } : null;
  }, [presenterUserId, screenStream, localUserId, localUsername, remoteMap, getUsername]);

  const total      = allParticipants.length;
  const isAlone    = total === 1;
  const totalPages = Math.ceil(total / Z.pageSize);

  useEffect(() => { setPage(0); }, [total]);

  const fullscreenP = useMemo(
    () => fullscreenId ? allParticipants.find(p => p.id === fullscreenId) : null,
    [fullscreenId, allParticipants]);

  const speakerLayout = useMemo(() => {
    const mainId    = pinnedUserId ?? activeSpeaker ?? remoteEntries[0]?.[0] ?? localUserId;
    const main      = allParticipants.find(p => p.id === mainId) ?? allParticipants[0];
    const filmstrip = allParticipants.filter(p => p.id !== main?.id);
    return { main, filmstrip };
  }, [pinnedUserId, activeSpeaker, remoteEntries, localUserId, allParticipants]);

  const handleMaximize = useCallback((id) => setFullscreenId(id),  []);
  const handleCloseFS  = useCallback(() => setFullscreenId(null), []);

  // ── Screen share ──────────────────────────────────────────────────────────
  if (screenInfo) {
    return (
      <ScreenShareView
        screenStream={screenInfo.stream} isLocalSharing={screenInfo.isLocal}
        presenterName={screenInfo.name}
        onStopSharing={screenInfo.isLocal ? onStopSharing : undefined}
        onControlsReveal={onControlsReveal}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEAKER VIEW — main stage + bottom filmstrip
  // ═══════════════════════════════════════════════════════════════════════════
  if (viewMode === 'speaker') {
    const { main, filmstrip } = speakerLayout;

    return (
      <div className="w-full h-full flex flex-col overflow-hidden"
        style={{ background: Z.bg, padding: Z.gap, gap: Z.gap }}>

        {/* Main stage */}
        <div className="relative flex-1 min-h-0"
          style={{ borderRadius: Z.radius, overflow: 'hidden' }}>
          <VideoTile
            stream={main.stream} username={main.username}
            isMuted={main.isMuted} isVideoOff={main.isVideoOff}
            isLocal={main.isLocal} isActive={activeSpeaker === main.id}
            isPinned={pinnedUserId === main.id}
            onPin={() => onPin?.(main.id)}
            onMaximize={() => handleMaximize(main.id)}
            onDoubleClick={() => handleMaximize(main.id)}
            className="w-full h-full rounded-none"
            style={{
              outline: activeSpeaker === main.id
                ? `3px solid ${Z.activeBorder}`
                : pinnedUserId === main.id ? `3px solid ${Z.pinnedBorder}` : 'none',
              outlineOffset: '-3px',
            }}
          />
          <AnimatePresence>
            {pinnedUserId === main.id && <PinBadge key="pin" />}
          </AnimatePresence>
        </div>

        {/* Bottom filmstrip — 16:9 tiles, horizontally scrollable */}
        {filmstrip.length > 0 && (
          <div ref={filmRef}
            className="flex-shrink-0 flex items-center overflow-x-auto overflow-y-hidden"
            style={{ height: Z.filmH, gap: Z.gap, scrollbarWidth: 'none' }}>
            <AnimatePresence mode="popLayout">
              {filmstrip.map(p => (
                <FilmThumb key={p.id} p={p}
                  isActive={activeSpeaker === p.id}
                  isPinned={pinnedUserId === p.id}
                  onPin={onPin} onMaximize={handleMaximize}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {fullscreenP && (
            <FullscreenOverlay participant={fullscreenP}
              activeSpeaker={activeSpeaker} onClose={handleCloseFS} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GALLERY VIEW — uniform tiles, Zoom grid algorithm, pagination
  // ═══════════════════════════════════════════════════════════════════════════
  const pageTiles      = allParticipants.slice(page * Z.pageSize, (page + 1) * Z.pageSize);
  const count          = pageTiles.length;
  const { cols, rows } = calcGrid(count);
  const mobileCols     = count === 1 ? 1 : 2;

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: Z.bg }}>

      <AnimatePresence>{isAlone && <WaitingOverlay />}</AnimatePresence>

      {/* Mobile grid */}
      <div className="sm:hidden absolute inset-0 overflow-y-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${mobileCols}, 1fr)`,
          gap: Z.gap, padding: Z.gap,
          alignContent: isAlone ? 'center' : 'start',
          scrollbarWidth: 'none',
        }}>
        <AnimatePresence mode="popLayout">
          {pageTiles.map(p => (
            <GalleryTile key={p.id} p={p}
              isActive={activeSpeaker === p.id} isPinned={pinnedUserId === p.id}
              onMaximize={handleMaximize} onPin={onPin} />
          ))}
        </AnimatePresence>
      </div>

      {/* Desktop grid
          • 1 person  → centered, max 900×506 (16:9)
          • 2 people  → side-by-side at 70% height
          • 3–25      → auto rows+cols filling the viewport
      */}
      <div className="hidden sm:flex absolute inset-0 items-center justify-center"
        style={{ padding: isAlone ? '8%' : Z.gap * 2 }}>
        <motion.div layout transition={SPRING}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows:    `repeat(${rows}, 1fr)`,
            gap: Z.gap, width: '100%', height: '100%',
            ...(isAlone  && { maxWidth: 900, maxHeight: 506 }),
            ...(count === 2 && { gridTemplateRows: '1fr', maxHeight: '70%' }),
          }}>
          <AnimatePresence mode="popLayout">
            {pageTiles.map(p => (
              <GalleryTile key={p.id} p={p}
                isActive={activeSpeaker === p.id} isPinned={pinnedUserId === p.id}
                onMaximize={handleMaximize} onPin={onPin} />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Pagination — only appears when > 25 participants */}
      <PageControls page={page} total={totalPages}
        onPrev={() => setPage(p => Math.max(0, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))} />

      <AnimatePresence>
        {fullscreenP && (
          <FullscreenOverlay participant={fullscreenP}
            activeSpeaker={activeSpeaker} onClose={handleCloseFS} />
        )}
      </AnimatePresence>
    </div>
  );
});

MeetingLayout.displayName = 'MeetingLayout';
export default MeetingLayout;