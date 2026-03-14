import { useState, useMemo, memo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VideoTile from './VideoTile';
import ScreenShareView from './ScreenShareView';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — single source of truth for the dark premium palette
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#07080d',
  surface:     '#0d1018',
  surfaceHigh: '#131720',
  border:      'rgba(255,255,255,0.07)',
  borderActive:'rgba(99,179,237,0.55)',
  accent:      '#3b82f6',
  accentGlow:  'rgba(59,130,246,0.35)',
  gap:         4,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const toMap = (rs) =>
  rs instanceof Map ? rs : new Map(Object.entries(rs ?? {}));

const gridCols = (n) => {
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
};

// spring presets
const SPRING_SOFT   = { type: 'spring', stiffness: 280, damping: 30, mass: 0.8 };
const SPRING_SNAPPY = { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 };

// ─────────────────────────────────────────────────────────────────────────────
// Tile wrapper — adds join/leave animation + hover elevation
// Wraps VideoTile without touching its internals
// ─────────────────────────────────────────────────────────────────────────────
const AnimatedTile = memo(({
  participantId, isActive, isPinned,
  children, onClick, onDoubleClick,
  style, className = '',
}) => (
  <motion.div
    key={participantId}
    layout
    layoutId={`tile-${participantId}`}
    initial={{ opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
    exit={{ opacity: 0, scale: 0.84, filter: 'blur(8px)' }}
    transition={SPRING_SOFT}
    whileHover={{ zIndex: 10 }}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    className={`relative overflow-hidden ${className}`}
    style={{
      borderRadius: 16,
      border: isActive
        ? `1.5px solid ${T.borderActive}`
        : `1px solid ${T.border}`,
      boxShadow: isActive
        ? `0 0 0 1px ${T.accentGlow}, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)`
        : `0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)`,
      transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
      background: T.surface,
      ...style,
    }}
  >
    {children}

    {/* Active speaker ring glow */}
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            boxShadow: `inset 0 0 0 2px ${T.borderActive}`,
            background: 'linear-gradient(180deg, rgba(59,130,246,0.04) 0%, transparent 40%)',
          }}
        />
      )}
    </AnimatePresence>

    {/* Pin badge */}
    <AnimatePresence>
      {isPinned && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: -4 }}
          transition={SPRING_SNAPPY}
          className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1
                     px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase
                     text-blue-200 select-none pointer-events-none"
          style={{
            background: 'rgba(59,130,246,0.22)',
            border: '1px solid rgba(59,130,246,0.38)',
            backdropFilter: 'blur(8px)',
          }}
        >
          📌 Pinned
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
));
AnimatedTile.displayName = 'AnimatedTile';

// ─────────────────────────────────────────────────────────────────────────────
// Fullscreen overlay — cinematic fade + scale
// ─────────────────────────────────────────────────────────────────────────────
const FullscreenOverlay = memo(({ participant, activeSpeaker, onClose }) => (
  <motion.div
    key="fullscreen"
    initial={{ opacity: 0, scale: 1.04 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 1.04 }}
    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    className="fixed inset-0 z-[100]"
    style={{ background: '#000' }}
  >
    {/* Background blur aura */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-[-20%] opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>

    <VideoTile
      stream={participant.stream}
      username={participant.username}
      isMuted={participant.isMuted}
      isVideoOff={participant.isVideoOff}
      isLocal={participant.isLocal}
      isActive={activeSpeaker === participant.id}
      className="w-full h-full rounded-none"
    />

    {/* Floating close button */}
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, ...SPRING_SNAPPY }}
      onClick={onClose}
      className="absolute top-5 right-5 z-10 flex items-center gap-2
                 px-4 py-2 rounded-full text-sm font-semibold text-white
                 transition-all duration-150 active:scale-95"
      style={{
        background: 'rgba(15,18,28,0.82)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      Exit Fullscreen
    </motion.button>

    {/* Bottom gradient for depth */}
    <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)' }} />
  </motion.div>
));
FullscreenOverlay.displayName = 'FullscreenOverlay';

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — shown when only local user is present
// ─────────────────────────────────────────────────────────────────────────────
const WaitingOverlay = memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="absolute inset-0 flex flex-col items-center justify-center
               pointer-events-none select-none z-10"
    style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(59,130,246,0.06) 0%, transparent 65%)' }}
  >
    <motion.div
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      className="w-16 h-16 rounded-full mb-5 flex items-center justify-center"
      style={{
        background: 'rgba(59,130,246,0.1)',
        border: '1px solid rgba(59,130,246,0.2)',
        boxShadow: '0 0 40px rgba(59,130,246,0.15)',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.7)" strokeWidth="1.5" strokeLinecap="round">
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
      {[0, 0.2, 0.4].map((d, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.4, delay: d }}
          className="w-1.5 h-1.5 rounded-full bg-slate-500"
        />
      ))}
    </div>
  </motion.div>
));
WaitingOverlay.displayName = 'WaitingOverlay';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar thumbnail — used in speaker view
// ─────────────────────────────────────────────────────────────────────────────
const SidebarThumb = memo(({
  participant, activeSpeaker, pinnedUserId, onPin, onMaximize,
  height = 110,
}) => {
  const isActive = activeSpeaker === participant.id;
  const isPinned = pinnedUserId === participant.id;

  return (
    <AnimatedTile
      participantId={participant.id}
      isActive={isActive}
      isPinned={isPinned}
      onClick={() => onPin?.(participant.id)}
      onDoubleClick={() => onMaximize?.(participant.id)}
      style={{ height, cursor: 'pointer', flexShrink: 0 }}
      className="w-full"
    >
      <VideoTile
        stream={participant.stream}
        username={participant.username}
        isMuted={participant.isMuted}
        isVideoOff={participant.isVideoOff}
        isLocal={participant.isLocal}
        isActive={isActive}
        isFloating
        className="w-full h-full rounded-none"
      />
    </AnimatedTile>
  );
});
SidebarThumb.displayName = 'SidebarThumb';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const MeetingLayout = memo(({
  localStream,
  remoteStreams,
  localUserId,
  localUsername,
  isMuted,
  isVideoOff,
  activeSpeaker,
  participants    = [],
  viewMode        = 'grid',
  pinnedUserId    = null,
  onPin,
  screenStream    = null,
  presenterUserId = null,
  onStopSharing,
  onControlsReveal,
  forceMutedIds   = new Set(),
}) => {
  // ── ALL hooks unconditionally at the top ──────────────────────────────
  const [fullscreenId, setFullscreenId] = useState(null);
  const gridRef = useRef(null);

  const remoteMap     = useMemo(() => toMap(remoteStreams), [remoteStreams]);
  const remoteEntries = useMemo(() => Array.from(remoteMap.entries()), [remoteMap]);

  const getUsername = useCallback((uid) => {
    const p = participants.find(p => (p.userId ?? p) === uid);
    return p?.username ?? `User ${String(uid).slice(0, 4)}`;
  }, [participants]);

  const allParticipants = useMemo(() => [
    { id: localUserId, stream: localStream, username: localUsername, isMuted, isVideoOff, isLocal: true },
    ...remoteEntries.map(([id, s]) => ({
      id, stream: s, username: getUsername(id),
      isMuted: forceMutedIds.has(id),
      isVideoOff: false,
      isLocal: false,
    })),
  ], [localUserId, localStream, localUsername, isMuted, isVideoOff,
      remoteEntries, getUsername, forceMutedIds]);

  const screenInfo = useMemo(() => {
    if (!presenterUserId) return null;
    if (presenterUserId === localUserId) {
      if (screenStream) return { stream: screenStream, isLocal: true, name: localUsername };
      return null;
    }
    const rs = remoteMap.get(presenterUserId);
    if (rs) return { stream: rs, isLocal: false, name: getUsername(presenterUserId) };
    return null;
  }, [presenterUserId, screenStream, localUserId, localUsername, remoteMap, getUsername]);

  const total       = allParticipants.length;
  const desktopCols = useMemo(() => gridCols(total), [total]);
  const desktopRows = useMemo(() => Math.ceil(total / desktopCols), [total, desktopCols]);
  const mobileCols  = total <= 2 ? 1 : 2;
  const isAlone     = total === 1;

  const fullscreenP = useMemo(
    () => fullscreenId ? allParticipants.find(p => p.id === fullscreenId) : null,
    [fullscreenId, allParticipants],
  );

  const speakerLayout = useMemo(() => {
    const mainId = pinnedUserId ?? activeSpeaker ?? (remoteEntries[0]?.[0] ?? localUserId);
    const main   = allParticipants.find(p => p.id === mainId) ?? allParticipants[0];
    const sidebar = allParticipants.filter(p => p.id !== main?.id);
    return { main, sidebar };
  }, [pinnedUserId, activeSpeaker, remoteEntries, localUserId, allParticipants]);

  const handleMaximize = useCallback((id) => setFullscreenId(id), []);
  const handleCloseFS  = useCallback(() => setFullscreenId(null), []);

  // ── Screen share ──────────────────────────────────────────────────────
  if (screenInfo) {
    return (
      <ScreenShareView
        screenStream={screenInfo.stream}
        isLocalSharing={screenInfo.isLocal}
        presenterName={screenInfo.name}
        onStopSharing={screenInfo.isLocal ? onStopSharing : undefined}
        onControlsReveal={onControlsReveal}
      />
    );
  }

  // ── Speaker view ──────────────────────────────────────────────────────
  if (viewMode === 'speaker') {
    const { main, sidebar } = speakerLayout;

    return (
      <div
        className="w-full h-full flex flex-col sm:flex-row overflow-hidden"
        style={{ background: T.bg, gap: T.gap, padding: T.gap }}
      >
        {/* Main stage */}
        <motion.div
          layout
          transition={SPRING_SOFT}
          className="flex-1 relative min-h-0 min-w-0 overflow-hidden"
          style={{ borderRadius: 20 }}
        >
          <AnimatedTile
            participantId={main.id}
            isActive={activeSpeaker === main.id}
            isPinned={pinnedUserId === main.id}
            onDoubleClick={() => handleMaximize(main.id)}
            className="w-full h-full"
            style={{ borderRadius: 20, height: '100%' }}
          >
            <VideoTile
              stream={main.stream}
              username={main.username}
              isMuted={main.isMuted}
              isVideoOff={main.isVideoOff}
              isLocal={main.isLocal}
              isActive={activeSpeaker === main.id}
              isPinned={pinnedUserId === main.id}
              onPin={() => onPin?.(main.id)}
              onMaximize={() => handleMaximize(main.id)}
              className="w-full h-full rounded-none"
            />
          </AnimatedTile>
        </motion.div>

        {/* Sidebar */}
        {sidebar.length > 0 && (
          <>
            {/* Mobile: horizontal strip */}
            <motion.div
              layout
              className="flex sm:hidden flex-shrink-0 items-center overflow-x-auto"
              style={{
                height: 92, gap: T.gap,
                scrollbarWidth: 'none',
                paddingBottom: 2,
              }}
            >
              <AnimatePresence mode="popLayout">
                {sidebar.map(p => (
                  <div
                    key={p.id}
                    style={{ width: 68, height: '100%', flexShrink: 0 }}
                  >
                    <SidebarThumb
                      participant={p}
                      activeSpeaker={activeSpeaker}
                      pinnedUserId={pinnedUserId}
                      onPin={onPin}
                      onMaximize={handleMaximize}
                      height={84}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Desktop: vertical sidebar */}
            <motion.div
              layout
              className="hidden sm:flex flex-col flex-shrink-0 overflow-y-auto"
              style={{
                width: 180, gap: T.gap,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <AnimatePresence mode="popLayout">
                {sidebar.map(p => (
                  <SidebarThumb
                    key={p.id}
                    participant={p}
                    activeSpeaker={activeSpeaker}
                    pinnedUserId={pinnedUserId}
                    onPin={onPin}
                    onMaximize={handleMaximize}
                    height={112}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}

        <AnimatePresence>
          {fullscreenP && (
            <FullscreenOverlay
              participant={fullscreenP}
              activeSpeaker={activeSpeaker}
              onClose={handleCloseFS}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Mobile grid ── */}
      <div
        className="sm:hidden w-full h-full overflow-y-auto"
        style={{
          background: T.bg,
          display: 'grid',
          gridTemplateColumns: `repeat(${mobileCols}, 1fr)`,
          gap: T.gap,
          padding: T.gap,
          alignContent: isAlone ? 'center' : 'start',
          scrollbarWidth: 'none',
        }}
      >
        <AnimatePresence mode="popLayout">
          {allParticipants.map(p => (
            <AnimatedTile
              key={p.id}
              participantId={p.id}
              isActive={activeSpeaker === p.id}
              isPinned={pinnedUserId === p.id}
              onDoubleClick={() => handleMaximize(p.id)}
              style={{
                aspectRatio: total <= 2 ? '16/9' : '1/1',
              }}
            >
              <VideoTile
                stream={p.stream}
                username={p.username}
                isMuted={p.isMuted}
                isVideoOff={p.isVideoOff}
                isLocal={p.isLocal}
                isActive={activeSpeaker === p.id}
                isPinned={pinnedUserId === p.id}
                onPin={() => onPin?.(p.id)}
                onMaximize={() => handleMaximize(p.id)}
                className="w-full h-full rounded-none"
              />
            </AnimatedTile>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Desktop grid ── */}
      <div
        ref={gridRef}
        className="hidden sm:block absolute inset-0"
        style={{ background: T.bg, padding: T.gap }}
      >
        {/* Waiting state */}
        <AnimatePresence>
          {isAlone && <WaitingOverlay />}
        </AnimatePresence>

        <motion.div
          layout
          style={{
            display: 'grid',
            width: '100%',
            height: '100%',
            gridTemplateColumns: `repeat(${desktopCols}, 1fr)`,
            gridTemplateRows: `repeat(${desktopRows}, 1fr)`,
            gap: T.gap,
            // When solo, center the single tile with max width
            ...(isAlone && {
              gridTemplateColumns: '1fr',
              gridTemplateRows: '1fr',
              maxWidth: '72%',
              maxHeight: '80%',
              margin: 'auto',
            }),
            // 2 people: nice 16:9-ish side-by-side
            ...(total === 2 && {
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridTemplateRows: '1fr',
              alignItems: 'center',
            }),
          }}
          transition={SPRING_SOFT}
        >
          <AnimatePresence mode="popLayout">
            {allParticipants.map((p) => (
              <AnimatedTile
                key={p.id}
                participantId={p.id}
                isActive={activeSpeaker === p.id}
                isPinned={pinnedUserId === p.id}
                onDoubleClick={() => handleMaximize(p.id)}
                className="min-h-0 h-full w-full"
              >
                <VideoTile
                  stream={p.stream}
                  username={p.username}
                  isMuted={p.isMuted}
                  isVideoOff={p.isVideoOff}
                  isLocal={p.isLocal}
                  isActive={activeSpeaker === p.id}
                  isPinned={pinnedUserId === p.id}
                  onPin={() => onPin?.(p.id)}
                  onMaximize={() => handleMaximize(p.id)}
                  className="w-full h-full rounded-none"
                />
              </AnimatedTile>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Fullscreen overlay — shared between mobile + desktop */}
      <AnimatePresence>
        {fullscreenP && (
          <FullscreenOverlay
            participant={fullscreenP}
            activeSpeaker={activeSpeaker}
            onClose={handleCloseFS}
          />
        )}
      </AnimatePresence>
    </>
  );
});

MeetingLayout.displayName = 'MeetingLayout';
export default MeetingLayout;