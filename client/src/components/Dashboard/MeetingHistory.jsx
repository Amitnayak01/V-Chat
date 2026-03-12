/**
 * MeetingHistory.jsx  (v2 — CallHistory design parity)
 * ──────────────────────────────────────────────────────
 * All original features preserved 100%:
 *   • roomAPI calls (getHistory, getStats, deleteRoom)
 *   • Infinite scroll via IntersectionObserver
 *   • fetchHistory / fetchNextPage / fetchStats
 *   • filter: all / hosted / joined / live / ended
 *   • sort: hosted rooms first
 *   • handleDelete / handleCopy / navigate to room
 *   • liveCount / hostedCount / joinedCount
 *   • sentinelRef + observerRef pattern
 *
 * NEW in v2 (design upgrades)
 * ───────────────────────────
 * • Shared design tokens (T) identical to CallHistory
 * • DM Sans + JetBrains Mono font + all ch-* CSS animations (mh-* prefixed)
 * • Inline-style component architecture — no Tailwind dependency
 * • Header: white card with border-bottom, stat pills, search input
 * • Filter tabs: same dark-active pill-tab style as CallHistory
 * • MeetingRow: fully redesigned — avatar grid, badges, portal dropdown
 * • MeetingAvatar: grid-slice layout (WhatsApp style) like GroupAvatar
 * • ParticipantStrip: expandable chip list (same as CallHistory)
 * • ConfirmDialog: shared blur-backdrop modal
 * • Empty: contextual icon + message per filter/search state
 * • Stat pills: clickable, jump to filter (replaces static StatCard grid)
 * • Infinite scroll: spinner + end-of-list message preserved
 * • Skeletons: styled to match card height
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Video, Phone, Clock, Users, Calendar, Play,
  Trash2, Trash, RefreshCw, Search, X, Info,
  ChevronDown, ChevronUp, MoreVertical,
  Copy, Loader2, AlertCircle, History,
  TrendingUp, UserCheck, Zap, Crown,
} from 'lucide-react';
import { roomAPI } from '../../utils/api';
import { generateRoomId } from '../../utils/webrtc';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

// ─── Helpers (original, unchanged) ───────────────────────────────────────────
const formatDuration = (sec) => {
  if (!sec || sec <= 0) return null;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  const diff = Math.floor((Date.now() - date) / 86400000);
  if (diff === 0) return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diff === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diff < 7)  return `${diff} days ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─── Design tokens (identical to CallHistory) ─────────────────────────────────
const T = {
  bg:       '#f0f4f8',
  card:     '#ffffff',
  dark:     '#0a1220',
  teal:     '#0fe6c0',
  tealBg:   'rgba(15,230,192,0.10)',
  tealBd:   'rgba(15,230,192,0.25)',
  red:      '#ef4444',
  gold:     '#f0a83e',
  blue:     '#3b82f6',
  blueBg:   'rgba(59,130,246,0.10)',
  blueBd:   'rgba(59,130,246,0.28)',
  green:    '#22c55e',
  greenBg:  'rgba(34,197,94,0.12)',
  greenBd:  'rgba(34,197,94,0.28)',
  violet:   '#8b5cf6',
  violetBg: 'rgba(139,92,246,0.12)',
  violetBd: 'rgba(139,92,246,0.28)',
  orange:   '#f97316',
  orangeBg: 'rgba(249,115,22,0.12)',
  slate1:   '#1e293b',
  slate2:   '#475569',
  slate3:   '#94a3b8',
  slate4:   '#e2e8f0',
  slate5:   '#f8fafc',
};

// ─── Filter config ─────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',    label: 'All'         },
  { id: 'hosted', label: 'Hosted'      },
  { id: 'joined', label: 'Joined'      },
  { id: 'live',   label: 'Live Now'    },
  { id: 'ended',  label: 'Past'        },
];

// ─── Global styles (mh- prefix, same rules as CallHistory ch-) ────────────────
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    .mh-root * { box-sizing: border-box; font-family: 'DM Sans', sans-serif; }
    .mh-mono   { font-family: 'JetBrains Mono', monospace !important; }
    @keyframes mh-in     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
    @keyframes mh-fade   { from{opacity:0} to{opacity:1} }
    @keyframes mh-slide  { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
    @keyframes mh-pop    { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
    @keyframes mh-expand { from{opacity:0;transform:scaleY(.88)} to{opacity:1;transform:scaleY(1)} }
    @keyframes mh-pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
    .mh-row { animation: mh-in .22s ease both; }
    .mh-row:hover .mh-actions { opacity: 1 !important; }
    .mh-row:hover { background: #f1f5f9 !important; }
    .mh-btn-ghost { transition: all .15s; }
    .mh-btn-ghost:hover { transform: translateY(-1px); }
    .mh-btn-ghost:active { transform: scale(.92); }
    .mh-tab { transition: all .18s; }
    .mh-row-action { transition: all .12s; }
    .mh-row-action:hover { transform: scale(1.08); }
    .mh-row-action:active { transform: scale(.92); }
    .mh-participant-chip:hover { background: #e2e8f0 !important; }
    .mh-live-dot { animation: mh-pulse 1.4s ease-in-out infinite; }
    .mh-skeleton { animation: mh-pulse 1.6s ease-in-out infinite; background: #e2e8f0; border-radius: 12px; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
  `}</style>
);

// ─── MiniAvatar ────────────────────────────────────────────────────────────────
const MiniAvatar = ({ src, name, size = 22, border = '#fff' }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
    background: 'linear-gradient(135deg,#4c1d95,#1e3a5f)',
    border: `2px solid ${border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    {src
      ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
             onError={e => { e.target.style.display = 'none'; }} />
      : <span style={{ color: '#fff', fontWeight: 800, fontSize: size * .38, userSelect: 'none' }}>
          {name?.[0]?.toUpperCase() ?? '?'}
        </span>
    }
  </div>
);

/**
 * MeetingAvatar — grid-slice layout identical to GroupAvatar in CallHistory.
 * 0 p → Video icon  |  1 p → full  |  2 p → halves
 * 3 p → top-2 / bottom-full  |  4+ → 2×2 grid with +N overflow
 */
const MeetingAvatar = ({ participants = [], isLive = false, size = 46 }) => {
  const GAP  = 1.5;
  const half = (size - GAP) / 2;

  const BG = [
    'linear-gradient(145deg,#0891b2,#0f766e)',
    'linear-gradient(145deg,#7c3aed,#4f46e5)',
    'linear-gradient(145deg,#db2777,#9333ea)',
    'linear-gradient(145deg,#ea580c,#d97706)',
  ];

  const Tile = ({ p, idx, style, isOverflow = false }) => {
    const fontSize = Math.max(8, Math.round((style.width ?? half) * 0.40));
    return (
      <div style={{
        position: 'absolute', overflow: 'hidden',
        background: BG[idx % BG.length],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}>
        {isOverflow
          ? <span style={{ color: '#fff', fontWeight: 800, fontSize, userSelect: 'none', lineHeight: 1, letterSpacing: '-.02em' }}>+{p}</span>
          : p?.avatar
            ? <img src={p.avatar} alt={p?.username ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                   onError={e => { e.target.style.display = 'none'; }} />
            : <span style={{ color: '#fff', fontWeight: 800, fontSize, userSelect: 'none', lineHeight: 1 }}>
                {p?.username?.[0]?.toUpperCase() ?? '?'}
              </span>
        }
      </div>
    );
  };

  const getSlots = (count) => {
    if (count === 1) return [{ top: 0, left: 0, width: size, height: size }];
    if (count === 2) return [
      { top: 0, left: 0,          width: half, height: size },
      { top: 0, left: half + GAP, width: half, height: size },
    ];
    if (count === 3) return [
      { top: 0,          left: 0,          width: half, height: half },
      { top: 0,          left: half + GAP, width: half, height: half },
      { top: half + GAP, left: 0,          width: size, height: half },
    ];
    return [
      { top: 0,          left: 0,          width: half, height: half },
      { top: 0,          left: half + GAP, width: half, height: half },
      { top: half + GAP, left: 0,          width: half, height: half },
      { top: half + GAP, left: half + GAP, width: half, height: half },
    ];
  };

  const count    = participants.length;
  const clamp    = Math.min(count, 4);
  const visible  = participants.slice(0, clamp);
  const overflow = count > 4 ? count - 3 : 0;
  if (overflow > 0) visible[3] = overflow;
  const slots = getSlots(clamp);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        overflow: 'hidden', position: 'relative',
        background: count === 0
          ? `linear-gradient(145deg, ${T.blueBg}, rgba(59,130,246,0.22))`
          : '#fff',
        border: `2px solid ${isLive ? T.greenBd : T.blueBd}`,
        boxShadow: isLive
          ? `0 0 0 3px ${T.greenBg}, 0 2px 8px rgba(34,197,94,0.22)`
          : '0 2px 8px rgba(59,130,246,0.15)',
        transition: 'box-shadow .2s',
      }}>
        {count === 0
          ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Video style={{ width: size * .46, height: size * .46, color: T.blue }} strokeWidth={1.8} />
            </div>
          : visible.map((p, i) => (
              <Tile key={i} p={p} idx={i} style={slots[i]} isOverflow={overflow > 0 && i === 3} />
            ))
        }
      </div>
      {/* Badge: live green dot OR video icon */}
      <div style={{
        position: 'absolute', bottom: -3, right: -3,
        width: 17, height: 17, borderRadius: '50%',
        background: isLive ? T.green : T.blue,
        border: '2px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }}>
        {isLive
          ? <span className="mh-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block' }} />
          : <Video style={{ width: 8, height: 8, color: '#fff' }} strokeWidth={2.5} />
        }
      </div>
    </div>
  );
};

// ─── ParticipantStrip ──────────────────────────────────────────────────────────
const ParticipantStrip = ({ participants, expanded }) => {
  if (!participants?.length || !expanded) return null;
  return (
    <div style={{
      marginTop: 8, paddingTop: 8,
      borderTop: `1px dashed ${T.slate4}`,
      display: 'flex', flexWrap: 'wrap', gap: 4,
      animation: 'mh-expand .18s ease',
      transformOrigin: 'top',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: T.slate3, textTransform: 'uppercase', letterSpacing: '.06em', width: '100%', marginBottom: 2 }}>
        Participants ({participants.length})
      </span>
      {participants.map((p, i) => (
        <div key={p._id ?? i} className="mh-participant-chip" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px 3px 4px', borderRadius: 999,
          background: T.slate5, border: `1px solid ${T.slate4}`,
          cursor: 'default', transition: 'background .12s',
        }}>
          <MiniAvatar src={p.avatar} name={p.username} size={16} border={T.slate4} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.slate1 }}>{p.username}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Empty state ───────────────────────────────────────────────────────────────
const Empty = ({ filter, search, onRetry, isError }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 24px', gap: 12,
    animation: 'mh-fade .3s ease',
  }}>
    <div style={{
      width: 64, height: 64, borderRadius: 20,
      background: isError ? 'rgba(239,68,68,0.08)' : T.slate5,
      border: `1.5px solid ${isError ? '#fecaca' : '#e2e8f0'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {isError
        ? <AlertCircle style={{ width: 28, height: 28, color: T.red }} />
        : search
          ? <Search  style={{ width: 28, height: 28, color: T.slate3 }} />
          : filter === 'live'
            ? <Zap    style={{ width: 28, height: 28, color: T.green }} />
            : <History style={{ width: 28, height: 28, color: T.slate3 }} />
      }
    </div>
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontWeight: 800, fontSize: 15, color: T.slate1, margin: '0 0 4px' }}>
        {isError    ? 'Failed to load'
        : search    ? `No results for "${search}"`
        : filter === 'live'   ? 'No live meetings'
        : filter === 'hosted' ? 'No hosted meetings'
        : filter === 'joined' ? 'No joined meetings'
        : filter === 'ended'  ? 'No past meetings'
        : 'No meetings yet'}
      </p>
      <p style={{ fontSize: 13, color: T.slate3, margin: 0, lineHeight: 1.55 }}>
        {isError    ? 'Check your connection and try again'
        : search    ? 'Try a different name or room ID'
        : filter === 'live' ? 'No active meetings right now'
        : 'Start or join a meeting to see history here'}
      </p>
    </div>
    {isError && onRetry && (
      <button
        onClick={onRetry}
        className="mh-btn-ghost"
        style={{ marginTop: 4, padding: '9px 20px', borderRadius: 12, background: T.blue, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
      >
        Try Again
      </button>
    )}
  </div>
);

// ─── ConfirmDialog (same as CallHistory) ──────────────────────────────────────
const ConfirmDialog = ({ title = 'Remove Meeting', message, onConfirm, onCancel }) => (
  <div
    style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    onClick={onCancel}
  >
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }} />
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'relative', zIndex: 1, background: '#fff', borderRadius: 20,
        padding: '24px 24px 20px', maxWidth: 340, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.18)', animation: 'mh-pop .22s cubic-bezier(.34,1.3,.64,1)',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Trash2 style={{ width: 22, height: 22, color: T.red }} />
      </div>
      <p style={{ fontWeight: 700, fontSize: 16, color: T.slate1, margin: '0 0 6px' }}>{title}</p>
      <p style={{ fontSize: 13, color: T.slate2, margin: '0 0 20px', lineHeight: 1.55 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel}  className="mh-btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 12, background: T.slate5, border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: 13, color: T.slate2, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} className="mh-btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#fef2f2', border: '1.5px solid #fecaca', fontWeight: 700, fontSize: 13, color: T.red, cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  </div>
);

// ─── Skeleton row ──────────────────────────────────────────────────────────────
const SkeletonRow = ({ idx }) => (
  <div className="mh-skeleton" style={{ height: 72, animationDelay: `${idx * 80}ms` }} />
);

// ─── MeetingRow ────────────────────────────────────────────────────────────────
const MeetingRow = ({ meeting, currentUserId, idx, onDelete, onCopy, onJoin, onCall }) => {
  const isHost = meeting.host?._id?.toString() === currentUserId?.toString();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [menuPos,    setMenuPos]    = useState({ top: 0, left: 0 });
  const [showPeople, setShowPeople] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const menuRef = useRef(null);
  const btnRef  = useRef(null);

  const hasParticipants = Array.isArray(meeting.participants) && meeting.participants.length > 0;

  /* Derive who to call: the single other participant for 1-on-1 meetings */
  const otherParticipants = (meeting.participants ?? []).filter(
    p => p._id?.toString() !== currentUserId?.toString()
  );
  const isOneOnOne      = otherParticipants.length === 1;
  const callTarget      = isOneOnOne ? otherParticipants[0] : null;
  const canCall         = isOneOnOne;
  const callDisabledMsg = !isOneOnOne
    ? 'Use "Join" to connect to group meetings'
    : null;

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const openMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.right - 160 });
    }
    setMenuOpen(v => !v);
  };

  /* Build display name from participants (same logic as original) */
  const displayName = (() => {
    if (meeting.participants?.length > 0) {
      const others = meeting.participants.filter(
        p => p._id?.toString() !== currentUserId?.toString()
      );
      if (others.length === 0) return 'You';
      if (others.length === 1) return `You & ${others[0].username}`;
      if (others.length === 2) return `You, ${others[0].username} & ${others[1].username}`;
      return `You, ${others[0].username} & ${others.length - 1} others`;
    }
    return `Meeting ···${meeting.roomId.slice(-8)}`;
  })();

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(meeting.roomId);
    setDeleting(false);
  };

  return (
    <div
      className="mh-row"
      style={{
        padding: '10px 14px', borderRadius: 14,
        background: '#fff', position: 'relative',
        animationDelay: `${idx * 28}ms`,
        border: meeting.isActive ? `1px solid ${T.greenBd}` : '1px solid transparent',
        transition: 'border-color .15s',
      }}
    >
      {/* Main row content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Avatar */}
        <MeetingAvatar
          participants={meeting.participants ?? []}
          isLive={meeting.isActive}
          size={46}
        />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            {/* Name */}
            <span style={{ fontWeight: 700, fontSize: 14, color: T.slate1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {displayName}
            </span>

            {/* Live badge */}
            {meeting.isActive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: T.green, background: T.greenBg, padding: '1px 7px', borderRadius: 999, flexShrink: 0 }}>
                <span className="mh-live-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, display: 'block' }} />
                Live
              </span>
            )}

            {/* Host badge */}
            {isHost && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: T.violet, background: T.violetBg, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
                <Crown style={{ width: 8, height: 8 }} />
                Host
              </span>
            )}

            {/* Participant count badge */}
            {meeting.participantCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: T.blue, background: T.blueBg, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
                <UserCheck style={{ width: 9, height: 9 }} />
                {meeting.participantCount} {meeting.participantCount === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Date */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Calendar style={{ width: 10, height: 10, color: T.slate3 }} />
              <span style={{ fontSize: 11, color: T.slate3 }}>{formatDate(meeting.startedAt)}</span>
            </span>

            {/* Duration */}
            {formatDuration(meeting.duration) && (
              <>
                <span style={{ color: '#cbd5e1', fontSize: 10 }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock style={{ width: 10, height: 10, color: T.slate3 }} />
                  <span className="mh-mono" style={{ fontSize: 11, color: T.slate3, fontWeight: 600 }}>
                    {formatDuration(meeting.duration)}
                  </span>
                </span>
              </>
            )}

            {/* Room ID */}
            <span style={{ color: '#cbd5e1', fontSize: 10 }}>·</span>
            <span className="mh-mono" style={{ fontSize: 10, color: T.slate3, opacity: .75 }}>
              {meeting.roomId.slice(-8)}
            </span>
          </div>
        </div>

        {/* Action buttons — fixed 4-slot layout so all rows stay the same width */}
        <div className="mh-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: 162 }}>

          {/* Slot 1: join live — invisible placeholder when not live */}
          <button
            onClick={() => meeting.isActive && onJoin(meeting.roomId)}
            className="mh-row-action"
            title={meeting.isActive ? 'Join live meeting' : ''}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: meeting.isActive ? T.greenBg : 'transparent',
              border: `1px solid ${meeting.isActive ? T.greenBd : 'transparent'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: meeting.isActive ? 'pointer' : 'default',
              visibility: meeting.isActive ? 'visible' : 'hidden',
            }}
          >
            <Play style={{ width: 14, height: 14, color: T.green }} />
          </button>

          {/* Slot 2: expand/collapse participants (invisible placeholder when none) */}
          <button
            onClick={() => hasParticipants && setShowPeople(v => !v)}
            className="mh-row-action"
            title={hasParticipants ? (showPeople ? 'Hide participants' : 'Show participants') : ''}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: showPeople ? T.blueBg : T.slate5,
              border: `1px solid ${showPeople ? T.blueBd : T.slate4}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: hasParticipants ? 'pointer' : 'default',
              visibility: hasParticipants ? 'visible' : 'hidden',
            }}
          >
            {showPeople
              ? <ChevronUp   style={{ width: 14, height: 14, color: T.blue }} />
              : <ChevronDown style={{ width: 14, height: 14, color: T.slate3 }} />
            }
          </button>

          {/* Slot 3: video call button */}
          <button
            onClick={() => canCall && onCall(callTarget)}
            disabled={!canCall}
            className="mh-row-action"
            title={callDisabledMsg ?? (isOneOnOne ? `Video call ${callTarget?.username}` : '')}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: canCall ? T.tealBg : T.slate5,
              border: `1px solid ${canCall ? T.tealBd : '#e2e8f0'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: canCall ? 'pointer' : 'not-allowed',
              opacity: canCall ? 1 : 0.45,
              transition: 'all .15s',
            }}
          >
            <Video style={{ width: 14, height: 14, color: canCall ? T.teal : T.slate3 }} />
          </button>

          {/* ⋮ menu */}
          <button
            ref={btnRef}
            onClick={openMenu}
            className="mh-row-action"
            style={{ width: 36, height: 36, borderRadius: 10, background: T.slate5, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <MoreVertical style={{ width: 15, height: 15, color: T.slate3 }} />
          </button>


        </div>
      </div>

      {/* Participant strip */}
      <ParticipantStrip participants={meeting.participants} expanded={showPeople} />

      {/* ⋮ Dropdown portal */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,.15)', zIndex: 99999,
            minWidth: 160, animation: 'mh-pop .15s ease', overflow: 'hidden',
          }}
        >
          {/* Video call — only for 1-on-1 meetings */}
          {isOneOnOne && (
            <>
              <button
                onClick={() => { if (canCall) { onCall(callTarget); setMenuOpen(false); } }}
                disabled={!canCall}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', background: 'none', border: 'none',
                  cursor: canCall ? 'pointer' : 'not-allowed',
                  fontSize: 13, fontWeight: 600,
                  color: canCall ? T.teal : T.slate3,
                  opacity: canCall ? 1 : 0.55,
                }}
                title={callDisabledMsg ?? undefined}
              >
                <Video style={{ width: 14, height: 14 }} />
                {`Video call ${callTarget?.username}`}
              </button>
              <div style={{ height: 1, background: '#f1f5f9' }} />
            </>
          )}

          {/* Join live — only for active meetings */}
          {meeting.isActive && (
            <>
              <button
                onClick={() => { onJoin(meeting.roomId); setMenuOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.slate1 }}
              >
                <Play style={{ width: 14, height: 14, color: T.green }} /> Join live
              </button>
              <div style={{ height: 1, background: '#f1f5f9' }} />
            </>
          )}

          {/* Copy link */}
          <button
            onClick={() => { onCopy(meeting.roomId); setMenuOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.slate1 }}
          >
            <Copy style={{ width: 14, height: 14, color: T.slate3 }} /> Copy link
          </button>
          <div style={{ height: 1, background: '#f1f5f9' }} />

          {/* Show/hide participants */}
          {hasParticipants && (
            <>
              <button
                onClick={() => { setShowPeople(v => !v); setMenuOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.slate1 }}
              >
                <Users style={{ width: 14, height: 14, color: T.blue }} />
                {showPeople ? 'Hide participants' : 'Show participants'}
              </button>
              <div style={{ height: 1, background: '#f1f5f9' }} />
            </>
          )}

          {/* Delete (host only) */}
          {isHost && (
            <button
              onClick={() => { handleDelete(); setMenuOpen(false); }}
              disabled={deleting}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: T.red, opacity: deleting ? .5 : 1 }}
            >
              {deleting
                ? <Loader2 style={{ width: 14, height: 14 }} />
                : <Trash2  style={{ width: 14, height: 14 }} />
              }
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const MeetingHistory = () => {
  const { user }   = useAuth();
  const { socket, emit, onlineUsers } = useSocket();
  const navigate   = useNavigate();

  // ── State (all original) ───────────────────────────────────────────────────
  const [rooms,       setRooms]       = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [statsLoad,   setStatsLoad]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [page,        setPage]        = useState(1);
  const [pagination,  setPagination]  = useState(null);
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMsg,  setConfirmMsg]  = useState('');
  const [confirmCb,   setConfirmCb]   = useState(null);
  const searchRef   = useRef(null);
  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  // ── Data fetching (all original) ───────────────────────────────────────────
  const fetchHistory = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const res = await roomAPI.getHistory(p, 10);
      if (res.data.success) {
        setRooms(res.data.rooms);
        setPagination(res.data.pagination);
        setPage(p);
      }
    } catch {
      setError('Failed to load meeting history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNextPage = useCallback(async (nextPage) => {
    setLoadingMore(true);
    try {
      const res = await roomAPI.getHistory(nextPage, 10);
      if (res.data.success) {
        setRooms(prev => {
          const existingIds = new Set(prev.map(r => r.roomId));
          const fresh = res.data.rooms.filter(r => !existingIds.has(r.roomId));
          return [...prev, ...fresh];
        });
        setPagination(res.data.pagination);
        setPage(nextPage);
      }
    } catch {
      toast.error('Failed to load more meetings');
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoad(true);
    try {
      const res = await roomAPI.getStats();
      if (res.data.success) setStats(res.data.stats);
    } catch { /* silent */ }
    finally { setStatsLoad(false); }
  }, []);

  useEffect(() => { fetchHistory(1); fetchStats(); }, [fetchHistory, fetchStats]);

  // ── IntersectionObserver (original logic) ──────────────────────────────────
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    const hasMore = pagination && page < pagination.pages;
    if (loading || loadingMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(page + 1); },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, page, pagination, fetchNextPage]);

  // ── Actions (all original) ─────────────────────────────────────────────────
  const handleDelete = async (roomId) => {
    try {
      await roomAPI.deleteRoom(roomId);
      toast.success('Removed from history');
      setRooms(p => p.filter(r => r.roomId !== roomId));
      fetchStats();
    } catch {
      toast.error('Failed to remove meeting');
    }
  };

  const handleDeleteWithConfirm = (roomId) => {
    setConfirmTitle('Remove Meeting');
    setConfirmMsg('Remove this meeting from your history? This cannot be undone.');
    setConfirmCb(() => () => { handleDelete(roomId); setShowConfirm(false); });
    setShowConfirm(true);
  };

  const handleCopy = (roomId) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}`);
    toast.success('Meeting link copied!');
  };

  const handleRefresh = () => { fetchHistory(1); fetchStats(); };

  const handleCall = (participant) => {
    if (!participant) return;
    if (!socket?.connected) { toast.error('Not connected to server. Please wait…'); return; }

    // Guard: check online status before emitting — prevents double "offline" toasts
    const isOnline = onlineUsers?.some(
      uid => uid?.toString() === participant._id?.toString()
    );
    if (!isOnline) {
      toast.error(`${participant.username} is offline`);
      return;
    }

    const roomId = generateRoomId();

    emit('call-user', {
      callerId:     user._id,
      receiverId:   participant._id,
      roomId,
      callerName:   user.username,
      callerAvatar: user.avatar,
    });

    sessionStorage.setItem('vmeet_calling', JSON.stringify({
      receiverId: participant._id,
      roomId,
    }));

    window.dispatchEvent(new CustomEvent('outgoing-call-started', {
      detail: {
        receiverId:     participant._id,
        receiverName:   participant.username,
        receiverAvatar: participant.avatar ?? null,
        roomId,
      },
    }));
  };

  const handleClearAll = async () => {
    if (rooms.length === 0) return;
    setConfirmMsg(`Delete all ${rooms.length} meeting record${rooms.length !== 1 ? 's' : ''} from your history? This cannot be undone.`);
    setConfirmTitle('Clear All History');
    setConfirmCb(() => async () => {
      setShowConfirm(false);
      try {
        await Promise.all(
          rooms
            .filter(r => r.host?._id?.toString() === user?._id?.toString())
            .map(r => roomAPI.deleteRoom(r.roomId))
        );
        toast.success('History cleared');
        setRooms([]);
        setPagination(null);
        fetchStats();
      } catch {
        toast.error('Some meetings could not be removed');
        fetchHistory(1);
      }
    });
    setShowConfirm(true);
  };

  // ── Filter + sort (original logic) ─────────────────────────────────────────
  const filtered = rooms
    .filter(r => {
      const isHost = r.host?._id?.toString() === user?._id?.toString();
      if (filter === 'hosted') return isHost;
      if (filter === 'joined') return !isHost;
      if (filter === 'live')   return r.isActive;
      if (filter === 'ended')  return !r.isActive;
      return true;
    })
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.roomId?.toLowerCase().includes(q) ||
        r.participants?.some(p => p.username?.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const aIsHost = a.host?._id?.toString() === user?._id?.toString();
      const bIsHost = b.host?._id?.toString() === user?._id?.toString();
      if (aIsHost === bIsHost) return 0;
      return aIsHost ? -1 : 1;
    });

  // ── Derived counts (original) ───────────────────────────────────────────────
  const liveCount   = rooms.filter(r => r.isActive).length;
  const hostedCount = rooms.filter(r => r.host?._id?.toString() === user?._id?.toString()).length;
  const joinedCount = rooms.length - hostedCount;

  // ── Tab count helper ────────────────────────────────────────────────────────
  const tabCount = (id) => {
    if (id === 'all')    return rooms.length;
    if (id === 'hosted') return hostedCount;
    if (id === 'joined') return joinedCount;
    if (id === 'live')   return liveCount;
    if (id === 'ended')  return rooms.filter(r => !r.isActive).length;
    return 0;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mh-root" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, minHeight: 0 }}>
      <Styles />

      {showConfirm && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMsg}
          onConfirm={confirmCb}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8edf2', padding: '16px 20px 0', flexShrink: 0 }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 22, color: T.slate1, margin: 0, letterSpacing: '-.025em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History style={{ width: 20, height: 20, color: T.blue }} strokeWidth={2.2} />
              Meeting History
            </h1>
            <p style={{ fontSize: 12, color: T.slate3, margin: '2px 0 0' }}>
              {rooms.length} total · {liveCount} live · {hostedCount} hosted
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRefresh}
              className="mh-btn-ghost"
              title="Refresh"
              style={{ width: 36, height: 36, borderRadius: 10, background: T.slate5, border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: 15, height: 15, color: T.slate3 }} />
            </button>
            {rooms.length > 0 && (
              <button
                onClick={handleClearAll}
                className="mh-btn-ghost"
                title="Clear all history"
                style={{ width: 36, height: 36, borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Trash style={{ width: 15, height: 15, color: T.red }} />
              </button>
            )}
          </div>
        </div>

        {/* Stat pills */}
        {!statsLoad && stats && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Total',   value: stats.totalMeetings      ?? 0, color: T.blue,   bg: T.blueBg,   filterTo: 'all'    },
              { label: 'Hosted',  value: stats.hostedMeetings     ?? 0, color: T.violet, bg: T.violetBg, filterTo: 'hosted', Icon: Crown },
              { label: 'Joined',  value: stats.joinedMeetings     ?? 0, color: T.green,  bg: T.greenBg,  filterTo: 'joined' },
              { label: 'Hrs',     value: stats.totalDurationHours ?? 0, color: T.orange, bg: T.orangeBg, filterTo: null,     Icon: Clock },
            ].map(s => (
              <div
                key={s.label}
                onClick={() => s.filterTo && setFilter(s.filterTo)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 999, background: s.bg,
                  cursor: s.filterTo ? 'pointer' : 'default', transition: 'opacity .15s',
                }}
              >
                {s.Icon && <s.Icon style={{ width: 11, height: 11, color: s.color }} />}
                <span style={{ fontWeight: 800, fontSize: 13, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: s.color, opacity: .75 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
        {statsLoad && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[80, 72, 72, 70].map((w, i) => (
              <div key={i} className="mh-skeleton" style={{ width: w, height: 26, borderRadius: 999, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: T.slate3, pointerEvents: 'none' }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by participant or room ID…"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: search ? 36 : 14,
              paddingTop: 9, paddingBottom: 9, fontSize: 13, fontFamily: 'DM Sans',
              fontWeight: 500, color: T.slate1, background: T.slate5,
              border: '1.5px solid #e2e8f0', borderRadius: 12, outline: 'none', transition: 'border-color .15s',
            }}
            onFocus={e  => { e.target.style.borderColor = T.blue;    }}
            onBlur={e   => { e.target.style.borderColor = '#e2e8f0'; }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: T.slate4, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X style={{ width: 10, height: 10, color: T.slate2 }} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, paddingBottom: 1, overflowX: 'auto' }}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            const count  = tabCount(f.id);
            const tabColor = f.id === 'live' ? T.green : T.blue;

            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="mh-tab"
                style={{
                  padding: '7px 12px', borderRadius: '10px 10px 0 0', fontSize: 12,
                  fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: active ? T.slate1 : 'transparent',
                  color: active ? '#fff' : T.slate3,
                  border: 'none',
                  borderBottom: active ? `2px solid ${tabColor}` : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {f.id === 'live' && (
                  <span
                    className={active ? 'mh-live-dot' : ''}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: active ? T.green : T.slate3, display: 'block' }}
                  />
                )}
                {f.id === 'hosted' && <Crown style={{ width: 10, height: 10 }} />}
                {f.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 999,
                    background: active ? (f.id === 'live' ? T.greenBg : T.blueBg) : T.slate5,
                    color:      active ? tabColor : T.slate3,
                    border:     active ? `1px solid ${f.id === 'live' ? T.greenBd : T.blueBd}` : '1px solid #e2e8f0',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LIST ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <Empty filter={filter} search={search} isError onRetry={() => fetchHistory(1)} />
        )}

        {/* Rows */}
        {!loading && !error && filtered.length === 0 && (
          <Empty filter={filter} search={search} />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map((m, idx) => (
              <MeetingRow
                key={m._id}
                meeting={m}
                currentUserId={user?._id}
                idx={idx}
                onDelete={handleDeleteWithConfirm}
                onCopy={handleCopy}
                onJoin={(id) => navigate(`/room/${id}`)}
                onCall={handleCall}
              />
            ))}
          </div>
        )}

        {/* ── Infinite scroll anchor + states ─────────────────────────────── */}
        {!loading && !error && (
          <>
            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />

            {loadingMore && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 0', color: T.slate3, fontSize: 13 }}>
                <Loader2 style={{ width: 18, height: 18, animation: 'mh-pulse 1s linear infinite' }} />
                Loading more meetings…
              </div>
            )}

            {!loadingMore && pagination && page >= pagination.pages && filtered.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 0 8px' }}>
                <Info style={{ width: 12, height: 12, color: T.slate3 }} />
                <span style={{ fontSize: 11, color: T.slate3 }}>
                  Showing {filtered.length} of {pagination.total} meeting{pagination.total !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MeetingHistory;