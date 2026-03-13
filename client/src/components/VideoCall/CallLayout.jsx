import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import { motion, useAnimation } from 'framer-motion';
import VideoTile from './VideoTile';
import ScreenShareView from './ScreenShareView';

const toMap = (rs) =>
  rs instanceof Map ? rs : new Map(Object.entries(rs ?? {}));

// ── Responsive hook: watches the container size ───────────────────────────────
function useContainerSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0, isLandscape: false });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height, isLandscape: width > height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// ── Corner snap hook ──────────────────────────────────────────────────────────
// Keeps the PIP in one of four corners. On pointer-up it snaps to the nearest.
// Returns { corner, pipStyle, handlers, controls }
//   corner: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
//   pipStyle: position CSS to place the animated wrapper
//   handlers: { onPointerDown, onPointerMove, onPointerUp }
//   controls: framer-motion AnimationControls for the inner div
function useCornerSnap({ pipW, pipH, margin = 14 }) {
  // Which corner the PIP currently lives in
  const [corner, setCorner] = useState('top-right');
  // Live drag offset from the corner anchor (reset to 0,0 after snap)
  const [drag, setDrag]     = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const controls  = useAnimation();
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const containerRef = useRef(null); // passed in via closure from component

  // CSS position for each corner anchor (the PIP is absolutely positioned
  // from the corner itself, so we only need one anchor direction per axis).
  const anchorStyle = (c) => {
    const base = { position: 'absolute', zIndex: 30 };
    if (c === 'top-right')    return { ...base, top:    margin, right:  margin };
    if (c === 'top-left')     return { ...base, top:    margin, left:   margin };
    if (c === 'bottom-right') return { ...base, bottom: margin, right:  margin };
    if (c === 'bottom-left')  return { ...base, bottom: margin, left:   margin };
    return base;
  };

  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: drag.x, oy: drag.y };
  }, [drag]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging) return;
    const d  = dragStart.current;
    const dx = e.clientX - d.mx;
    const dy = e.clientY - d.my;

    // Flip sign so drag feels natural regardless of which corner we're anchored to
    const isRight  = corner === 'top-right'    || corner === 'bottom-right';
    const isBottom = corner === 'bottom-right' || corner === 'bottom-left';

    setDrag({
      x: d.ox + (isRight  ? -dx : dx),
      y: d.oy + (isBottom ? -dy : dy),
    });
  }, [isDragging, corner]);

  const onPointerUp = useCallback((e, containerEl) => {
    if (!isDragging) return;
    setIsDragging(false);

    const rect = containerEl?.getBoundingClientRect();
    if (!rect) { setDrag({ x: 0, y: 0 }); return; }

    // Current PIP centre in container-relative coords
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Pick nearest corner
    const goLeft   = cx < rect.width  / 2;
    const goTop    = cy < rect.height / 2;
    const newCorner =
      goTop  && !goLeft ? 'top-right'    :
      goTop  &&  goLeft ? 'top-left'     :
      !goTop && !goLeft ? 'bottom-right' :
                          'bottom-left';

    setCorner(newCorner);

    // Animate the drag offset back to zero (snapping illusion)
    controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
    setDrag({ x: 0, y: 0 });
  }, [isDragging, controls]);

  return { corner, drag, isDragging, anchorStyle, controls, onPointerDown, onPointerMove, onPointerUp };
}

const CallLayout = memo(({
  localStream,
  remoteStreams,
  localUserId,
  localUsername,
  isMuted,
  isVideoOff,
  activeSpeaker,
  participants   = [],
  screenStream    = null,
  presenterUserId = null,
  onStopSharing,
  onControlsReveal,
  hostMutedIds    = new Set(),
}) => {
  // ── ALL hooks declared unconditionally at the top ──────────────────────
  const containerRef  = useRef(null);
  const { isLandscape } = useContainerSize(containerRef);

  const [swapped, setSwapped] = useState(false);

  // PIP dimensions (responsive)
  const PIP_W = 'clamp(88px, 22vw, 118px)';
  const PIP_H = 'clamp(124px, 30vw, 166px)';

  const {
    corner, drag, isDragging,
    anchorStyle, controls,
    onPointerDown, onPointerMove, onPointerUp,
  } = useCornerSnap({ pipW: 118, pipH: 166 });

  const remoteMap     = useMemo(() => toMap(remoteStreams), [remoteStreams]);
  const remoteEntries = useMemo(() => Array.from(remoteMap.entries()), [remoteMap]);
  const totalCount    = 1 + remoteEntries.length;

  const getUsername = useCallback((uid) => {
    const p = participants.find(p => (p.userId ?? p) === uid);
    return p?.username ?? `User ${String(uid).slice(0, 4)}`;
  }, [participants]);

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

  const camTiles = useMemo(() => [
    { id: localUserId, stream: localStream, username: localUsername, isMuted, isVideoOff, isLocal: true, isMutedByHost: false },
    ...remoteEntries.map(([id, s]) => ({
      id, stream: s, username: getUsername(id),
      isMuted: hostMutedIds.has(id), isVideoOff: false, isLocal: false,
      isMutedByHost: hostMutedIds.has(id),
    })),
  ], [localUserId, localStream, localUsername, isMuted, isVideoOff, remoteEntries, getUsername, hostMutedIds]);

  // ── Conditional renders AFTER all hooks ───────────────────────────────

  if (screenInfo) {
    return (
      <div ref={containerRef} className="w-full h-full">
        <ScreenShareView
          screenStream={screenInfo.stream}
          isLocalSharing={screenInfo.isLocal}
          presenterName={screenInfo.name}
          onStopSharing={screenInfo.isLocal ? onStopSharing : undefined}
          onControlsReveal={onControlsReveal}
        />
      </div>
    );
  }

  // ── Solo ──────────────────────────────────────────────────────────────
  if (totalCount === 1) {
    return (
      <div ref={containerRef} className="w-full h-full relative bg-black">
        <VideoTile stream={localStream} username={localUsername}
          isMuted={isMuted} isVideoOff={isVideoOff} isLocal
          className="w-full h-full rounded-none" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      </div>
    );
  }

  // ── 2-person ──────────────────────────────────────────────────────────
  if (totalCount === 2) {
    const remoteId     = remoteEntries[0][0];
    const remoteStream = remoteEntries[0][1];

    const mainStream   = swapped ? localStream   : remoteStream;
    const mainUsername = swapped ? localUsername : getUsername(remoteId);
    const mainIsLocal  = swapped;
    const mainId       = swapped ? localUserId   : remoteId;

    const pipStream   = swapped ? remoteStream : localStream;
    const pipUsername = swapped ? getUsername(remoteId) : localUsername;
    const pipIsLocal  = !swapped;
    const pipId       = swapped ? remoteId     : localUserId;

    if (isLandscape) {
      // Desktop: two equal side-by-side tiles
      return (
        <div ref={containerRef} className="w-full h-full bg-black flex" style={{ gap: 4, padding: 4 }}>
          {[
            { id: remoteId,    stream: remoteStream, username: getUsername(remoteId), isLocal: false },
            { id: localUserId, stream: localStream,  username: localUsername,         isLocal: true  },
          ].map(t => (
            <div key={t.id} className="flex-1 overflow-hidden rounded-2xl">
              <VideoTile
                stream={t.stream} username={t.username}
                isMuted={t.isLocal ? isMuted : hostMutedIds.has(t.id)}
                isVideoOff={t.isLocal ? isVideoOff : false}
                isLocal={t.isLocal}
                isMutedByHost={!t.isLocal && hostMutedIds.has(t.id)}
                isActive={activeSpeaker === t.id}
                className="w-full h-full rounded-none"
              />
            </div>
          ))}
        </div>
      );
    }

    // Mobile portrait: remote full-screen + corner-snapping self PIP
    return (
      <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black">
        {/* Remote fills entire screen */}
        <VideoTile
          stream={mainStream} username={mainUsername}
          isMuted={mainIsLocal ? isMuted : hostMutedIds.has(mainId)}
          isVideoOff={mainIsLocal ? isVideoOff : false}
          isMutedByHost={!mainIsLocal && hostMutedIds.has(mainId)}
          isLocal={mainIsLocal} isActive={activeSpeaker === mainId}
          className="w-full h-full rounded-none"
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Self PIP — corner-snapping, draggable */}
        <div
          style={{
            ...anchorStyle(corner),
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={(e) => { onPointerMove(e); onControlsReveal?.(); }}
          onPointerUp={(e) => onPointerUp(e, containerRef.current)}
        >
          {/* Animated wrapper snaps back to x:0, y:0 at corner anchor */}
          <motion.div
            animate={controls}
            whileTap={{ scale: 0.96 }}
            onClick={() => !isDragging && setSwapped(v => !v)}
            className="overflow-hidden"
            style={{
              width:        PIP_W,
              height:       PIP_H,
              borderRadius: 16,
              border:       '2px solid rgba(255,255,255,0.22)',
              boxShadow:    '0 4px 24px rgba(0,0,0,0.65)',
              x: drag.x,
              y: drag.y,
            }}
          >
            <VideoTile
              stream={pipStream} username={pipUsername}
              isMuted={pipIsLocal ? isMuted : false}
              isVideoOff={pipIsLocal ? isVideoOff : false}
              isLocal={pipIsLocal} isFloating
              isActive={activeSpeaker === pipId}
              className="w-full h-full rounded-none"
            />
          </motion.div>

          {/* Corner hint label */}
          {!isDragging && (
            <p className="text-center text-white/25 text-[9px] mt-1 tracking-wide select-none">
              tap to swap
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── 3-person ──────────────────────────────────────────────────────────
  if (totalCount === 3) {
    const active = remoteEntries.find(([uid]) => uid === activeSpeaker);
    const [featuredId, featuredStream] = active ?? remoteEntries[0];
    const featuredUsername = getUsername(featuredId);

    const otherTiles = [
      { id: localUserId, stream: localStream, username: localUsername, isLocal: true },
      ...remoteEntries
        .filter(([uid]) => uid !== featuredId)
        .map(([uid, s]) => ({ id: uid, stream: s, username: getUsername(uid), isLocal: false })),
    ];

    if (isLandscape) {
      // Desktop: large featured left (2/3) + 2 stacked right (1/3)
      return (
        <div ref={containerRef} className="w-full h-full bg-black flex" style={{ gap: 4, padding: 4 }}>
          <div className="overflow-hidden rounded-2xl" style={{ flex: 2 }}>
            <VideoTile
              stream={featuredStream} username={featuredUsername}
              isMuted={hostMutedIds.has(featuredId)} isVideoOff={false}
              isLocal={false} isMutedByHost={hostMutedIds.has(featuredId)}
              isActive={activeSpeaker === featuredId}
              className="w-full h-full rounded-none"
            />
          </div>
          <div className="flex flex-col" style={{ flex: 1, gap: 4 }}>
            {otherTiles.map(t => (
              <div key={t.id} className="flex-1 overflow-hidden rounded-2xl">
                <VideoTile
                  stream={t.stream} username={t.username}
                  isMuted={t.isLocal ? isMuted : hostMutedIds.has(t.id)}
                  isVideoOff={t.isLocal ? isVideoOff : false}
                  isLocal={t.isLocal}
                  isMutedByHost={!t.isLocal && hostMutedIds.has(t.id)}
                  isActive={activeSpeaker === t.id}
                  className="w-full h-full rounded-none"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Mobile portrait: 2 equal top, 1 full-width bottom
    return (
      <div ref={containerRef} className="w-full h-full bg-black flex flex-col" style={{ gap: 4, padding: 4 }}>
        <div className="flex flex-1" style={{ gap: 4 }}>
          {otherTiles.map(t => (
            <div key={t.id} className="flex-1 overflow-hidden rounded-2xl">
              <VideoTile
                stream={t.stream} username={t.username}
                isMuted={t.isLocal ? isMuted : hostMutedIds.has(t.id)}
                isVideoOff={t.isLocal ? isVideoOff : false}
                isLocal={t.isLocal}
                isMutedByHost={!t.isLocal && hostMutedIds.has(t.id)}
                isActive={activeSpeaker === t.id}
                className="w-full h-full rounded-none"
              />
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-hidden rounded-2xl">
          <VideoTile
            stream={featuredStream} username={featuredUsername}
            isMuted={hostMutedIds.has(featuredId)} isVideoOff={false}
            isLocal={false} isMutedByHost={hostMutedIds.has(featuredId)}
            isActive={activeSpeaker === featuredId}
            className="w-full h-full rounded-none"
          />
        </div>
      </div>
    );
  }

  // ── 4+ person: equal grid ─────────────────────────────────────────────
  const cols = camTiles.length <= 4 ? 2 : isLandscape ? 3 : 2;
  const rows = Math.ceil(camTiles.length / cols);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black"
      style={{
        display:             'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows:    `repeat(${rows}, 1fr)`,
        gap: 4, padding: 4,
      }}
    >
      {camTiles.map(p => (
        <VideoTile
          key={p.id} stream={p.stream} username={p.username}
          isMuted={p.isMuted} isVideoOff={p.isVideoOff}
          isLocal={p.isLocal} isMutedByHost={p.isMutedByHost}
          isActive={activeSpeaker === p.id}
          className="rounded-2xl"
        />
      ))}
    </div>
  );
});

CallLayout.displayName = 'CallLayout';
export default CallLayout;