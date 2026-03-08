// ─────────────────────────────────────────────────────────────────────────────
// VideoGrid.jsx  —  Layout router: Call mode ↔ Meeting mode
// ─────────────────────────────────────────────────────────────────────────────
//
// FIX — forceMutedIds forwarded to layouts as hostMutedIds
// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM: VideoRoom correctly passes `forceMutedIds` (a Set of userIds muted
// by the host) down to VideoGrid. But VideoGrid's `sharedProps` object did NOT
// include that prop, so CallLayout and MeetingLayout always received an empty
// default `new Set()` for `hostMutedIds`.
//
// Effect: Mute indicators (the red mic icon on remote VideoTiles) never showed
// for host-muted participants. Participants who were force-muted by the host
// looked unmuted to everyone else in the room.
//
// FIX: Accept `forceMutedIds` in VideoGrid's props and forward it to both
// layouts under the name `hostMutedIds` (the name CallLayout/MeetingLayout
// expect). No other changes to any layout component needed.
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CallLayout    from './CallLayout';
import MeetingLayout from './MeetingLayout';

const VideoGrid = memo(({
  mode            = 'call',   // 'call' | 'meeting'
  localStream,
  remoteStreams,
  localUserId,
  localUsername,
  isMuted,
  isVideoOff,
  activeSpeaker,
  participants    = [],
  meetingViewMode = 'grid',
  pinnedUserId    = null,
  onPin,
  screenStream    = null,
  presenterUserId = null,
  onStopSharing,
  onControlsReveal,
  // FIX: accept forceMutedIds from VideoRoom so layouts can show mute indicators
  forceMutedIds   = new Set(),
}) => {
  // Props shared between CallLayout and MeetingLayout
  const sharedProps = {
    localStream,
    remoteStreams,
    localUserId,
    localUsername,
    isMuted,
    isVideoOff,
    activeSpeaker,
    participants,
    screenStream,
    presenterUserId,
    onStopSharing,
    onControlsReveal,
    // FIX: forward as hostMutedIds — the prop name both layouts use
    hostMutedIds: forceMutedIds,
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      <AnimatePresence mode="wait">
        {mode === 'call' ? (
          <motion.div
            key="call"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <CallLayout {...sharedProps} />
          </motion.div>
        ) : (
          <motion.div
            key="meeting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <MeetingLayout
              {...sharedProps}
              viewMode={meetingViewMode}
              pinnedUserId={pinnedUserId}
              onPin={onPin}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

VideoGrid.displayName = 'VideoGrid';
export default VideoGrid;