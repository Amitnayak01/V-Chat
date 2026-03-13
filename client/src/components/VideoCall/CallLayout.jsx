import { useState, useRef, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import VideoTile from './VideoTile';
import ScreenShareView from './ScreenShareView';

const toMap = (rs) =>
  rs instanceof Map ? rs : new Map(Object.entries(rs ?? {}));

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
  hostMutedIds    = new Set(),  // ── MUTE CONTROL: Set of userId muted by host
}) => {
  // ── ALL hooks declared unconditionally at the top ──────────────────────
  const [swapped,  setSwapped]  = useState(false);
  const [pipPos,   setPipPos]   = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const remoteMap = useMemo(() => toMap(remoteStreams), [remoteStreams]);
  const remoteEntries = useMemo(() => Array.from(remoteMap.entries()), [remoteMap]);
  const totalCount = 1 + remoteEntries.length;

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

  // PIP drag handlers — must be declared even when screen sharing
  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragRef.current = { mx: e.clientX, my: e.clientY, px: pipPos.x, py: pipPos.y };
  }, [pipPos]);

  const onPointerMove = useCallback((e) => {
    if (!dragging) return;
    const d = dragRef.current;
    setPipPos({ x: d.px + (e.clientX - d.mx), y: d.py + (e.clientY - d.my) });
  }, [dragging]);

  const onPointerUp = useCallback(() => setDragging(false), []);

  // ── Conditional renders AFTER all hooks ───────────────────────────────

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

  // ── Solo view ─────────────────────────────────────────────────────────
  if (totalCount === 1) {
    return (
      <div className="w-full h-full relative bg-black">
        <VideoTile stream={localStream} username={localUsername}
          isMuted={isMuted} isVideoOff={isVideoOff} isLocal
          className="w-full h-full rounded-none" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      </div>
    );
  }

  // ── 2-person: remote fills screen, local PIP draggable in top-right ───
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

    return (
      <div className="w-full h-full relative overflow-hidden bg-black">
        {/* Remote fills entire screen */}
        <VideoTile
          stream={mainStream}
          username={mainUsername}
          isMuted={mainIsLocal ? isMuted : hostMutedIds.has(mainId)}
          isVideoOff={mainIsLocal ? isVideoOff : false}
          isMutedByHost={!mainIsLocal && hostMutedIds.has(mainId)}
          isLocal={mainIsLocal}
          isActive={activeSpeaker === mainId}
          className="w-full h-full rounded-none"
        />

        {/* Subtle gradient overlays */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Local PIP — draggable, anchored top-right, tap to swap */}
        <div
          className="absolute z-30 select-none"
          style={{
            top:   `calc(16px + ${pipPos.y}px)`,
            right: `calc(14px - ${pipPos.x}px)`,
            touchAction: 'none',
            cursor: dragging ? 'grabbing' : 'grab',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={(e) => { onPointerMove(e); onControlsReveal?.(); }}
          onPointerUp={onPointerUp}
        >
          <motion.div
            whileTap={{ scale: 0.96 }}
            onClick={() => !dragging && setSwapped(v => !v)}
            className="overflow-hidden"
            style={{
              width:        'clamp(88px, 22vw, 118px)',
              height:       'clamp(124px, 30vw, 166px)',
              borderRadius: 16,
              border:       '2px solid rgba(255,255,255,0.22)',
              boxShadow:    '0 4px 24px rgba(0,0,0,0.65)',
            }}
          >
            <VideoTile
              stream={pipStream}
              username={pipUsername}
              isMuted={pipIsLocal ? isMuted : false}
              isVideoOff={pipIsLocal ? isVideoOff : false}
              isLocal={pipIsLocal}
              isFloating
              isActive={activeSpeaker === pipId}
              className="w-full h-full rounded-none"
            />
          </motion.div>
        </div>
      </div>
    );
  }

  // ── 3-person: top row 2 equal tiles, bottom row 1 full-width tile ─────
  if (totalCount === 3) {
    // Active speaker (or first remote) goes full-width on the bottom
    const active = remoteEntries.find(([uid]) => uid === activeSpeaker);
    const [bottomId, bottomStream] = active ?? remoteEntries[0];
    const bottomUsername = getUsername(bottomId);

    // The other two tiles share the top row
    const topTiles = [
      { id: localUserId, stream: localStream, username: localUsername, isLocal: true },
      ...remoteEntries
        .filter(([uid]) => uid !== bottomId)
        .map(([uid, s]) => ({ id: uid, stream: s, username: getUsername(uid), isLocal: false })),
    ];

    return (
      <div className="w-full h-full bg-black flex flex-col" style={{ gap: 4, padding: 4 }}>
        {/* Top row: 2 equal tiles */}
        <div className="flex flex-1" style={{ gap: 4 }}>
          {topTiles.map(t => (
            <div key={t.id} className="flex-1 overflow-hidden rounded-2xl">
              <VideoTile
                stream={t.stream}
                username={t.username}
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

        {/* Bottom row: 1 full-width tile */}
        <div className="flex-1 overflow-hidden rounded-2xl">
          <VideoTile
            stream={bottomStream}
            username={bottomUsername}
            isMuted={hostMutedIds.has(bottomId)}
            isVideoOff={false}
            isLocal={false}
            isMutedByHost={hostMutedIds.has(bottomId)}
            isActive={activeSpeaker === bottomId}
            className="w-full h-full rounded-none"
          />
        </div>
      </div>
    );
  }

  // ── 4+ person: equal 2×2 grid (or auto grid for more) ────────────────
  const cols = totalCount <= 4 ? 2 : Math.ceil(Math.sqrt(camTiles.length));
  const rows = Math.ceil(camTiles.length / cols);

  return (
    <div
      className="w-full h-full bg-black"
      style={{
        display:             'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows:    `repeat(${rows}, 1fr)`,
        gap:     4,
        padding: 4,
      }}
    >
      {camTiles.map(p => (
        <VideoTile
          key={p.id}
          stream={p.stream}
          username={p.username}
          isMuted={p.isMuted}
          isVideoOff={p.isVideoOff}
          isLocal={p.isLocal}
          isMutedByHost={p.isMutedByHost}
          isActive={activeSpeaker === p.id}
          className="rounded-2xl"
        />
      ))}
    </div>
  );
});

CallLayout.displayName = 'CallLayout';
export default CallLayout;