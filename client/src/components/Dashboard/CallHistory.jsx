/**
 * CallHistory.jsx  (v2 — group call support)
 * ────────────────────────────────────────────
 * All original features preserved.
 *
 * NEW in v2
 * ─────────
 * • 'group' call type — violet/purple colour, Users icon
 * • 'Group' filter tab with badge count
 * • GroupAvatar: stacked mini-avatars showing up to 3 participants (+N more)
 * • Participant strip under the row showing every person who was in the call
 * • Participant count badge on group rows
 * • "Call again" gracefully disabled for group calls (no single peerId)
 * • Group stats pill in the header
 * • Upgraded stat summary card: shows group count alongside in/out/missed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, PhoneOff,
  Search, Trash2, Trash, X, Filter, Clock, Calendar,
  ChevronDown, ChevronUp, MoreVertical, RefreshCw, Info,
  Users, UserCheck,
} from 'lucide-react';
import { useAudioCall } from '../../context/AudioCallContext';
import {
  getCallHistory, deleteCallRecord, clearCallHistory,
  fmtDuration, fmtTimestamp,
} from '../../utils/callHistoryStore';
import { useThemeTokens } from '../../hooks/useThemeTokens';
import { getCHStyles }    from '../../utils/darkModeStyles';



/* ─── Call type meta (group added) ──────────────────────────────────────── */
const getCallMeta = (T) => ({
  incoming: { Icon: PhoneIncoming, color: T.teal,   label: 'Incoming', bg: T.tealBg               },
  outgoing: { Icon: PhoneOutgoing, color: T.blue,   label: 'Outgoing', bg: 'rgba(59,130,246,.10)'  },
  missed:   { Icon: PhoneMissed,   color: T.red,    label: 'Missed',   bg: 'rgba(239,68,68,.10)'   },
  group:    { Icon: Users,         color: T.violet, label: 'Group',    bg: T.violetBg              },
});

const getStatusMeta = (T) => ({
  completed: { color: T.teal, label: 'Completed' },
  rejected:  { color: T.red,  label: 'Rejected'  },
  missed:    { color: T.red,  label: 'Missed'     },
});

/* ─── Filter tabs (group added) ─────────────────────────────────────────── */
const FILTERS = [
  { id: 'all',      label: 'All'      },
  { id: 'incoming', label: 'Incoming' },
  { id: 'outgoing', label: 'Outgoing' },
  { id: 'missed',   label: 'Missed'   },
  { id: 'group',    label: 'Group'    },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const isGroupRecord = (r) => r.isGroup || r.type === 'group';

/* ─── Global styles ──────────────────────────────────────────────────────── */
const Styles = ({ isDark }) => (
  <style>{getCHStyles(isDark)}</style>
);

/* ─── MiniAvatar (reused in ParticipantStrip chips) ─────────────────────── */
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
 * GroupAvatar — grid-slice layout (WhatsApp / FaceTime style)
 * ────────────────────────────────────────────────────────────
 * 0 people  →  gradient circle + Users icon
 * 1 person  →  full circle photo / initial
 * 2 people  →  left | right halves
 * 3 people  →  top-left | top-right / bottom full-width
 * 4+ people →  2×2 grid, last cell shows "+N" overflow count
 *
 * Each slice is absolutely positioned inside a circle container that
 * clips everything with borderRadius+overflow:hidden.  A 1.5px white
 * gap between tiles acts as a natural divider — no separate borders needed.
 */
const GroupAvatar = ({ participants = [], size = 46, T }) => {
  const GAP  = 1.5;                         // px gap between tiles (white divider)
  const half = (size - GAP) / 2;

  /* Per-slot gradient backgrounds so initials look distinct */
  const BG = [
    'linear-gradient(145deg,#7c3aed,#4f46e5)',
    'linear-gradient(145deg,#0891b2,#0f766e)',
    'linear-gradient(145deg,#db2777,#9333ea)',
    'linear-gradient(145deg,#ea580c,#d97706)',
  ];

  /* ── Single tile ──────────────────────────────────────────────────────── */
  const Tile = ({ p, idx, style, isOverflow = false }) => {
    const fontSize = Math.max(8, Math.round((style.width ?? half) * 0.40));
    return (
      <div style={{
        position: 'absolute',
        overflow: 'hidden',
        background: BG[idx % BG.length],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}>
        {isOverflow
          ? <span style={{ color: '#fff', fontWeight: 800, fontSize, userSelect: 'none', lineHeight: 1, letterSpacing: '-.02em' }}>
              +{p}
            </span>
          : p?.avatar
            ? <img
                src={p.avatar} alt={p?.username ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            : <span style={{ color: '#fff', fontWeight: 800, fontSize, userSelect: 'none', lineHeight: 1 }}>
                {p?.username?.[0]?.toUpperCase() ?? '?'}
              </span>
        }
      </div>
    );
  };

  /* ── Slot geometry per participant count ─────────────────────────────── */
  const getSlots = (count) => {
    // Each rect: { top, left, width, height }
    if (count === 1) return [
      { top: 0, left: 0, width: size, height: size },
    ];
    if (count === 2) return [
      { top: 0, left: 0,            width: half,       height: size },
      { top: 0, left: half + GAP,   width: half,       height: size },
    ];
    if (count === 3) return [
      { top: 0,          left: 0,          width: half,  height: half  },
      { top: 0,          left: half + GAP, width: half,  height: half  },
      { top: half + GAP, left: 0,          width: size,  height: half  },
    ];
    /* 4 */
    return [
      { top: 0,          left: 0,          width: half, height: half },
      { top: 0,          left: half + GAP, width: half, height: half },
      { top: half + GAP, left: 0,          width: half, height: half },
      { top: half + GAP, left: half + GAP, width: half, height: half },
    ];
  };

  /* ── Decide what to render ───────────────────────────────────────────── */
  const count   = participants.length;
  const clamp   = Math.min(count, 4);            // max 4 slots
  const visible = participants.slice(0, clamp);
  const overflow = count > 4 ? count - 3 : 0;   // "+N" shown in slot 4
  if (overflow > 0) visible[3] = overflow;       // slot 4 becomes the overflow tile

  const slots = getSlots(clamp);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>

      {/* ── Main circle ─────────────────────────────────────────────────── */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        overflow: 'hidden', position: 'relative',
        background: count === 0
          ? `linear-gradient(145deg, ${T.violetBg}, rgba(139,92,246,0.22))`
          : '#fff',                               // white = the gap colour
        border: `2px solid ${T.violetBd}`,
        boxShadow: '0 2px 8px rgba(139,92,246,0.18)',
      }}>
        {count === 0
          /* Empty state — just the icon */
          ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: size * .46, height: size * .46, color: T.violet }} strokeWidth={1.8} />
            </div>
          /* Grid slices */
          : visible.map((p, i) => (
              <Tile
                key={i}
                p={p}
                idx={i}
                style={slots[i]}
                isOverflow={overflow > 0 && i === 3}
              />
            ))
        }
      </div>

      {/* ── Bottom-right badge ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: -3, right: -3,
        width: 17, height: 17, borderRadius: '50%',
        background: T.violet,
        border: '2px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }}>
        <Users style={{ width: 8, height: 8, color: '#fff' }} strokeWidth={2.5} />
      </div>

    </div>
  );
};

/* ─── Standard 1:1 Avatar ────────────────────────────────────────────────── */
const Avatar = ({ src, name, size = 46, type, T }) => {
  const CALL_META = getCallMeta(T);
  const meta = CALL_META[type] || CALL_META.incoming;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
        background: 'linear-gradient(135deg,#0b5545,#1e3a5f)',
        border: '2px solid #e2e8f0',
      }}>
        {src
          ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                 onError={e => { e.target.style.display = 'none'; }} />
          : <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontWeight: 800,
              fontSize: size * .38, userSelect: 'none',
            }}>
              {name?.[0]?.toUpperCase() ?? '?'}
            </div>
        }
      </div>
      <div style={{
        position: 'absolute', bottom: -2, right: -2,
        width: 18, height: 18, borderRadius: '50%',
        background: meta.bg, border: `1.5px solid ${meta.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <meta.Icon style={{ width: 9, height: 9, color: meta.color }} strokeWidth={2.5} />
      </div>
    </div>
  );
};

/* ─── ParticipantStrip — expandable list of who was in a group call ──────── */
const ParticipantStrip = ({ participants, expanded, T }) => {
  if (!participants?.length || !expanded) return null;
  return (
    <div style={{
      marginTop: 8, paddingTop: 8,
      borderTop: `1px dashed ${T.slate4}`,
      display: 'flex', flexWrap: 'wrap', gap: 4,
      animation: 'ch-expand .18s ease',
      transformOrigin: 'top',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: T.slate3, textTransform: 'uppercase', letterSpacing: '.06em', width: '100%', marginBottom: 2 }}>
        Participants ({participants.length})
      </span>
      {participants.map((p, i) => (
        <div key={p.userId ?? i} className="ch-participant-chip" style={{
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

/* ─── Empty state ────────────────────────────────────────────────────────── */
const Empty = ({ filter, search, T }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 24px', gap: 12,
    animation: 'ch-fade .3s ease',
  }}>
    <div style={{
      width: 64, height: 64, borderRadius: 20,
      background: T.slate5, border: '1.5px solid #e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {search
        ? <Search style={{ width: 28, height: 28, color: T.slate3 }} />
        : filter === 'group'
          ? <Users  style={{ width: 28, height: 28, color: T.slate3 }} />
          : <Phone  style={{ width: 28, height: 28, color: T.slate3 }} />
      }
    </div>
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontWeight: 800, fontSize: 15, color: T.slate1, margin: '0 0 4px' }}>
        {search
          ? `No results for "${search}"`
          : filter === 'all'   ? 'No calls yet'
          : filter === 'group' ? 'No group calls yet'
          : `No ${filter} calls`
        }
      </p>
      <p style={{ fontSize: 13, color: T.slate3, margin: 0, lineHeight: 1.5 }}>
        {search
          ? 'Try a different name'
          : filter === 'group'
            ? 'Group calls you join will appear here'
            : 'Calls you make and receive will appear here'
        }
      </p>
    </div>
  </div>
);

/* ─── Confirm dialog ─────────────────────────────────────────────────────── */
const ConfirmDialog = ({ message, onConfirm, onCancel, T }) => (
  <div
    style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    onClick={onCancel}
  >
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }} />
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'relative', zIndex: 1, background: T.card, borderRadius: 20,
        padding: '24px 24px 20px', maxWidth: 340, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.18)', animation: 'ch-pop .22s cubic-bezier(.34,1.3,.64,1)',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Trash2 style={{ width: 22, height: 22, color: T.red }} />
      </div>
      <p style={{ fontWeight: 700, fontSize: 16, color: T.slate1, margin: '0 0 6px' }}>Clear History</p>
      <p style={{ fontSize: 13, color: T.slate2, margin: '0 0 20px', lineHeight: 1.55 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} className="ch-btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 12, background: T.slate5, border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: 13, color: T.slate2, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} className="ch-btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#fef2f2', border: '1.5px solid #fecaca', fontWeight: 700, fontSize: 13, color: T.red, cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  </div>
);

/* ─── CallRow ─────────────────────────────────────────────────────────────── */
 const CallRow = ({ record, idx, onDelete, onCallAgain, T }) => {

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [menuPos,     setMenuPos]     = useState({ top: 0, left: 0 });
  const [showPeople,  setShowPeople]  = useState(false);
  const menuRef   = useRef(null);
  const btnRef    = useRef(null);

  const isGroup   = isGroupRecord(record);
const CALL_META = getCallMeta(T);
const STATUS_META = getStatusMeta(T);
const meta      = CALL_META[isGroup ? 'group' : record.type] || CALL_META.incoming;
const sMeta     = STATUS_META[record.status] || STATUS_META.completed;
  const hasParticipants = isGroup && Array.isArray(record.participants) && record.participants.length > 0;
  const participantCount = record.participants?.length ?? 0;

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const close = e => {
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
      setMenuPos({ top: rect.bottom + 6, left: rect.right - 150 });
    }
    setMenuOpen(v => !v);
  };

  return (
    <div
      className="ch-row"
      style={{
        padding: '10px 14px', borderRadius: 14,
       background: T.card, position: 'relative',
animationDelay: `${idx * 28}ms`,
border: isGroup ? `1px solid ${T.violetBd}` : `1px solid ${T.slate4}`,
        transition: 'border-color .15s',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

{isGroup
  ? <GroupAvatar participants={record.participants ?? []} size={46} T={T} />
  : <Avatar src={record.peerAvatar} name={record.peerName} size={46} type={record.type} T={T} />
}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: T.slate1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {isGroup ? (record.peerName || 'Group Call') : record.peerName}
            </span>

            {/* Type badge */}
            <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
              {meta.label}
            </span>

            {/* Participant count badge (group only) */}
            {isGroup && participantCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: T.violet, background: T.violetBg, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
                <UserCheck style={{ width: 9, height: 9 }} />
                {participantCount + 1} people
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Status */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sMeta.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: sMeta.color }}>{sMeta.label}</span>
            </span>
            {/* Duration */}
            {record.duration > 0 && (
              <>
                <span style={{ color: '#cbd5e1', fontSize: 10 }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock style={{ width: 10, height: 10, color: T.slate3 }} />
                  <span className="ch-mono" style={{ fontSize: 11, color: T.slate3, fontWeight: 600 }}>{fmtDuration(record.duration)}</span>
                </span>
              </>
            )}
            {/* Timestamp */}
            <span style={{ color: '#cbd5e1', fontSize: 10 }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Calendar style={{ width: 10, height: 10, color: T.slate3 }} />
              <span style={{ fontSize: 11, color: T.slate3 }}>{fmtTimestamp(record.timestamp)}</span>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Expand participants toggle (group only) */}
          {hasParticipants && (
            <button
              onClick={() => setShowPeople(v => !v)}
              className="ch-row-action"
              title={showPeople ? 'Hide participants' : 'Show participants'}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: showPeople ? T.violetBg : T.slate5,
                border: `1px solid ${showPeople ? T.violetBd : T.slate4}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              {showPeople
                ? <ChevronUp   style={{ width: 14, height: 14, color: T.violet }} />
                : <ChevronDown style={{ width: 14, height: 14, color: T.slate3 }} />
              }
            </button>
          )}

          {/* Call again — disabled for group calls */}
          <button
            onClick={() => !isGroup && onCallAgain(record)}
            className="ch-row-action"
            title={isGroup ? 'Cannot redial group calls' : 'Call again'}
            disabled={isGroup}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: isGroup ? T.slate5  : T.tealBg,
              border:     `1px solid ${isGroup ? T.slate4 : T.tealBd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isGroup ? 'not-allowed' : 'pointer',
              opacity: isGroup ? .4 : 1,
            }}
          >
            <Phone style={{ width: 15, height: 15, color: isGroup ? T.slate3 : '#0ab89a' }} strokeWidth={2.2} />
          </button>

          {/* ⋮ menu */}
          <button
            ref={btnRef}
            onClick={openMenu}
            className="ch-row-action"
            style={{ width: 36, height: 36, borderRadius: 10, background: T.slate5, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <MoreVertical style={{ width: 15, height: 15, color: T.slate3 }} />
          </button>
        </div>
      </div>

      {/* Participant strip (expandable) */}
      <ParticipantStrip participants={record.participants} expanded={showPeople} T={T} />

      {/* ⋮ Dropdown portal */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
           background: T.card, border: `1px solid ${T.slate4}`, borderRadius: 12,
boxShadow: '0 8px 24px rgba(0,0,0,.35)', zIndex: 99999,
            minWidth: 150, animation: 'ch-pop .15s ease', overflow: 'hidden',
          }}
        >
          {!isGroup && (
            <>
              <button
                onClick={() => { onCallAgain(record); setMenuOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.slate1 }}
              >
                <Phone style={{ width: 14, height: 14, color: '#0ab89a' }} /> Call again
              </button>
              <div style={{ height: 1, background: T.divider }} />
            </>
          )}
          {hasParticipants && (
            <>
              <button
                onClick={() => { setShowPeople(v => !v); setMenuOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.slate1 }}
              >
                <Users style={{ width: 14, height: 14, color: T.violet }} />
                {showPeople ? 'Hide participants' : 'Show participants'}
              </button>
              <div style={{ height: 1, background: T.divider }} />
            </>
          )}
          <button
            onClick={() => { onDelete(record.id); setMenuOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.red }}
          >
            <Trash2 style={{ width: 14, height: 14 }} /> Delete
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
const CallHistory = () => {
  const T      = useThemeTokens();
  const isDark = T.bg === '#080e17';
  const { initiateCall, callState } = useAudioCall();

  const [records,     setRecords]     = useState(() => getCallHistory());
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMsg,  setConfirmMsg]  = useState('');
  const [confirmCb,   setConfirmCb]   = useState(null);
  const searchRef = useRef(null);

  /* Live sync from storage events */
  useEffect(() => {
    const onUpdate = (e) => setRecords(e.detail ?? getCallHistory());
    window.addEventListener('vmeet-call-history-updated', onUpdate);
    return () => window.removeEventListener('vmeet-call-history-updated', onUpdate);
  }, []);

  /* Derived list */
  const filtered = records
    .filter(r => {
      if (filter === 'all')   return true;
      if (filter === 'group') return isGroupRecord(r);
      return r.type === filter && !isGroupRecord(r);
    })
    .filter(r => !search || r.peerName?.toLowerCase().includes(search.toLowerCase())
      || r.participants?.some(p => p.username?.toLowerCase().includes(search.toLowerCase()))
    );

  /* Stats */
  const stats = {
    total:    records.length,
    missed:   records.filter(r => r.type === 'missed'   && !isGroupRecord(r)).length,
    incoming: records.filter(r => r.type === 'incoming' && !isGroupRecord(r)).length,
    outgoing: records.filter(r => r.type === 'outgoing' && !isGroupRecord(r)).length,
    group:    records.filter(r => isGroupRecord(r)).length,
  };

  /* Handlers */
  const handleDelete = useCallback((id) => {
    setRecords(deleteCallRecord(id));
  }, []);

  const handleDeleteWithConfirm = useCallback((id) => {
    setConfirmMsg('Remove this call from your history?');
    setConfirmCb(() => () => { handleDelete(id); setShowConfirm(false); });
    setShowConfirm(true);
  }, [handleDelete]);

  const handleClearAll = () => {
    if (records.length === 0) return;
    setConfirmMsg(`Delete all ${records.length} call records? This cannot be undone.`);
    setConfirmCb(() => () => { clearCallHistory(); setRecords([]); setShowConfirm(false); });
    setShowConfirm(true);
  };

  const handleCallAgain = useCallback((record) => {
    if (callState !== 'idle' || isGroupRecord(record)) return;
    initiateCall(record.peerId, record.peerName, record.peerAvatar);
  }, [callState, initiateCall]);

  const handleRefresh = () => setRecords(getCallHistory());

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="ch-root" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, minHeight: 0 }}>
      <Styles isDark={isDark} />
      {showConfirm && (
        <ConfirmDialog
          message={confirmMsg}
          onConfirm={confirmCb}
          onCancel={() => setShowConfirm(false)}
          T={T}
        />
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.headerBd}`, padding: '16px 20px 0', flexShrink: 0 }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 22, color: T.slate1, margin: 0, letterSpacing: '-.025em' }}>
              Call History
            </h1>
            <p style={{ fontSize: 12, color: T.slate3, margin: '2px 0 0' }}>
              {stats.total} total · {stats.missed} missed · {stats.group} group
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRefresh}
              className="ch-btn-ghost"
              title="Refresh"
              style={{ width: 36, height: 36, borderRadius: 10, background: T.slate5, border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: 15, height: 15, color: T.slate3 }} />
            </button>
            {records.length > 0 && (
              <button
                onClick={handleClearAll}
                className="ch-btn-ghost"
                title="Clear all"
                style={{ width: 36, height: 36, borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Trash style={{ width: 15, height: 15, color: T.red }} />
              </button>
            )}
          </div>
        </div>

        {/* Stat pills */}
        {records.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Incoming', value: stats.incoming, color: T.teal,   bg: T.tealBg                    },
              { label: 'Outgoing', value: stats.outgoing, color: T.blue,   bg: 'rgba(59,130,246,.09)'      },
              { label: 'Missed',   value: stats.missed,   color: T.red,    bg: 'rgba(239,68,68,.09)'       },
              { label: 'Group',    value: stats.group,    color: T.violet, bg: T.violetBg, icon: Users     },
            ].map(s => (
              <div
                key={s.label}
                onClick={() => setFilter(s.label.toLowerCase())}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 999, background: s.bg,
                  cursor: 'pointer', transition: 'opacity .15s',
                }}
              >
                {s.icon && <s.icon style={{ width: 11, height: 11, color: s.color }} />}
                <span style={{ fontWeight: 800, fontSize: 13, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: s.color, opacity: .75 }}>{s.label}</span>
              </div>
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
            placeholder="Search by name or participant…"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: search ? 36 : 14,
              paddingTop: 9, paddingBottom: 9, fontSize: 13, fontFamily: 'DM Sans',
              fontWeight: 500, color: T.slate1, background: T.slate5,
              border: '1.5px solid #e2e8f0', borderRadius: 12, outline: 'none', transition: 'border-color .15s',
            }}
            onFocus={e  => { e.target.style.borderColor = T.teal;    }}
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
            const count =
              f.id === 'all'   ? records.length :
              f.id === 'group' ? stats.group :
              records.filter(r => r.type === f.id && !isGroupRecord(r)).length;
            const tabColor = f.id === 'group' ? T.violet : T.teal;

            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="ch-tab"
                style={{
                  padding: '7px 12px', borderRadius: '10px 10px 0 0', fontSize: 12,
                  fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: active ? T.slate1 : 'transparent',
                  color: active ? T.tabActiveText : T.tabText,                  border: 'none',
                  borderBottom: active ? `2px solid ${tabColor}` : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {f.id === 'group' && <Users style={{ width: 10, height: 10 }} />}
                {f.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 999,
                    background: active ? (f.id === 'group' ? T.violetBg : T.tealBg) : T.slate5,
                    color:      active ? tabColor : T.slate3,
                    border:     active ? `1px solid ${f.id === 'group' ? T.violetBd : T.tealBd}` : '1px solid #e2e8f0',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CALL LIST ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {filtered.length === 0
          ? <Empty filter={filter} search={search} T={T} />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map((record, idx) => (
               <CallRow
  key={record.id}
  record={record}
  idx={idx}
  onDelete={handleDeleteWithConfirm}
  onCallAgain={handleCallAgain}
  T={T}
/>
              ))}
            </div>
          )
        }

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 0 8px' }}>
            <Info style={{ width: 12, height: 12, color: T.slate3 }} />
            <span style={{ fontSize: 11, color: T.slate3 }}>
              Showing {filtered.length} of {records.length} records
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallHistory;