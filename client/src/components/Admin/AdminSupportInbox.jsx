import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones, ChevronLeft, Send, Loader2, RefreshCw,
  Clock, CheckCircle, XCircle, Circle, AlertCircle,
  User, Shield, Tag, MoreVertical, Check,
} from 'lucide-react';
import { supportAPI } from '../../utils/supportApi';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

/* ── Constants ─────────────────────────────────────────────────────── */
const CATEGORIES = {
  bug:     { label: 'Bug Report',       emoji: '🐛', color: '#DC2626', bg: '#FEF2F2' },
  account: { label: 'Account Issue',    emoji: '🔒', color: '#D97706', bg: '#FFFBEB' },
  chat:    { label: 'Chat Problem',     emoji: '💬', color: '#7C3AED', bg: '#F5F3FF' },
  call:    { label: 'Call Problem',     emoji: '📞', color: '#2563EB', bg: '#EFF6FF' },
  general: { label: 'General Question', emoji: '🙋', color: '#059669', bg: '#ECFDF5' },
};

const STATUSES = [
  { id: 'all',         label: 'All' },
  { id: 'open',        label: 'Open',        color: '#2563EB' },
  { id: 'in_progress', label: 'In Progress', color: '#D97706' },
  { id: 'resolved',    label: 'Resolved',    color: '#059669' },
  { id: 'closed',      label: 'Closed',      color: '#6B7280' },
];

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: '#2563EB', bg: '#EFF6FF', icon: Circle },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', icon: Clock },
  resolved:    { label: 'Resolved',    color: '#059669', bg: '#ECFDF5', icon: CheckCircle },
  closed:      { label: 'Closed',      color: '#6B7280', bg: '#F9FAFB', icon: XCircle },
};

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: '#6B7280', bg: '#F9FAFB' },
  medium: { label: 'Medium', color: '#D97706', bg: '#FFFBEB' },
  high:   { label: 'High',   color: '#DC2626', bg: '#FEF2F2' },
  urgent: { label: 'Urgent', color: '#7C3AED', bg: '#F5F3FF' },
};

const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (d) => {
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 86400000) return formatTime(d);
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/* ── Ticket Row ────────────────────────────────────────────────────── */
const TicketRow = ({ ticket, active, onClick }) => {
  const c  = CATEGORIES[ticket.category] || CATEGORIES.general;
  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const pc = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const StatusIcon = sc.icon;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px', cursor: 'pointer', transition: 'all .12s',
        borderBottom: '1px solid #F3F4F6',
        background: active ? '#F5F3FF' : ticket.unreadAdmin > 0 ? '#FAFAFE' : '#fff',
        borderLeft: `3px solid ${active ? '#7C3AED' : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#FAFAFE'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = ticket.unreadAdmin > 0 ? '#FAFAFE' : '#fff'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <img
          src={ticket.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ticket.user?.username}`}
          alt=""
          style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: '1.5px solid #E5E7EB' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <p style={{ fontSize: 12.5, fontWeight: ticket.unreadAdmin > 0 ? 800 : 600, color: '#111827', margin: 0 }}>
              {ticket.user?.username}
            </p>
            <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>{formatDate(ticket.lastMessageAt)}</span>
          </div>
          <p style={{ fontSize: 12, color: '#374151', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: ticket.unreadAdmin > 0 ? 600 : 400 }}>
            {ticket.subject}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 999, background: c.bg, color: c.color, fontWeight: 700 }}>{c.emoji} {c.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <StatusIcon style={{ width: 9, height: 9, color: sc.color }} />
              <span style={{ fontSize: 9.5, color: sc.color, fontWeight: 700 }}>{sc.label}</span>
            </div>
            {ticket.unreadAdmin > 0 && (
              <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 999, background: '#7C3AED', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {ticket.unreadAdmin}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Admin Chat View ───────────────────────────────────────────────── */
const AdminTicketChat = ({ ticketId, onClose, currentUserId }) => {
  const [ticket,   setTicket]  = useState(null);
  const [input,    setInput]   = useState('');
  const [loading,  setLoading] = useState(true);
  const [sending,  setSending] = useState(false);
  const [showMenu, setShowMenu]= useState(false);
  const { socket }             = useSocket();
  const bottomRef              = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await supportAPI.getAdminTicket(ticketId);
      setTicket(res.data.ticket);
    } catch { toast.error('Failed to load ticket'); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      const tid = data.ticketId?.toString?.() || data.ticketId;
      if (tid === ticketId) {
        setTicket(prev => prev ? { ...prev, messages: [...prev.messages, data.message] } : prev);
      }
    };
    socket.on('support:new-message', handler);
    return () => socket.off('support:new-message', handler);
  }, [socket, ticketId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.messages?.length]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await supportAPI.replyTicket(ticketId, input.trim());
      setTicket(prev => prev ? { ...prev, messages: [...prev.messages, res.data.message], status: prev.status === 'open' ? 'in_progress' : prev.status } : prev);
      setInput('');
    } catch { toast.error('Failed to send reply'); }
    finally { setSending(false); }
  };

  const updateStatus = async (status) => {
    try {
      await supportAPI.updateStatus(ticketId, { status });
      setTicket(prev => prev ? { ...prev, status } : prev);
      setShowMenu(false);
      toast.success(`Ticket marked as ${status.replace('_', ' ')}`);
    } catch { toast.error('Failed to update status'); }
  };

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 style={{ width: 24, height: 24, color: '#7C3AED', animation: 'spin .8s linear infinite' }} />
    </div>
  );

  if (!ticket) return null;

  const c  = CATEGORIES[ticket.category] || CATEGORIES.general;
  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const pc = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const StatusIcon = sc.icon;
  const isClosed = ticket.status === 'closed';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Chat Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src={ticket.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ticket.user?.username}`}
          alt=""
          style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid #E5E7EB', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{ticket.user?.username}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{ticket.ticketId}</span>
            <span style={{ fontSize: 9.5, padding: '1px 7px', borderRadius: 999, background: c.bg, color: c.color, fontWeight: 700 }}>{c.emoji} {c.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <StatusIcon style={{ width: 9, height: 9, color: sc.color }} />
              <span style={{ fontSize: 9.5, color: sc.color, fontWeight: 700 }}>{sc.label}</span>
            </div>
            <span style={{ fontSize: 9.5, padding: '1px 7px', borderRadius: 999, background: pc.bg, color: pc.color, fontWeight: 700 }}>{pc.label}</span>
          </div>
        </div>

        {/* Status menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(m => !m)}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <MoreVertical style={{ width: 15, height: 15, color: '#6B7280' }} />
          </button>
          {showMenu && (
            <div style={{ position: 'absolute', right: 0, top: 36, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.08em', padding: '10px 12px 4px' }}>Set Status</p>
              {['open', 'in_progress', 'resolved', 'closed'].map(s => {
                const sc2 = STATUS_CONFIG[s];
                const StatusIcon2 = sc2.icon;
                return (
                  <div
                    key={s}
                    onClick={() => updateStatus(s)}
                    style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <StatusIcon2 style={{ width: 13, height: 13, color: sc2.color }} />
                    <span style={{ fontSize: 12.5, color: '#374151', fontWeight: ticket.status === s ? 700 : 400 }}>{sc2.label}</span>
                    {ticket.status === s && <Check style={{ width: 12, height: 12, color: sc2.color, marginLeft: 'auto' }} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#FAFAFA' }} onClick={() => setShowMenu(false)}>
        {ticket.messages?.map((msg, i) => {
          const isAdmin = msg.senderRole === 'admin' || msg.senderRole === 'superadmin';
          return (
            <motion.div
              key={msg._id || i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: isAdmin ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}
            >
              {!isAdmin && (
                <img
                  src={ticket.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ticket.user?.username}`}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, border: '1.5px solid #E5E7EB' }}
                />
              )}
              {isAdmin && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>
                  🛡️
                </div>
              )}
              <div style={{ maxWidth: '72%' }}>
                {!isAdmin && (
                  <p style={{ fontSize: 10.5, color: '#9CA3AF', marginBottom: 3, fontWeight: 600 }}>{ticket.user?.username}</p>
                )}
                {isAdmin && (
                  <p style={{ fontSize: 10.5, color: '#9CA3AF', marginBottom: 3, fontWeight: 600, textAlign: 'right' }}>
                    {msg.sender?.username || 'Admin'} · Support Team
                  </p>
                )}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isAdmin ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isAdmin ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#F3F4F6',
                  color: isAdmin ? '#fff' : '#111827',
                  fontSize: 13.5, lineHeight: 1.5,
                  boxShadow: isAdmin ? '0 2px 12px rgba(102,126,234,0.25)' : '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  {msg.content}
                </div>
                <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: isAdmin ? 'right' : 'left' }}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply Input */}
      {!isClosed ? (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', background: '#fff', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Reply to user…"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12,
              border: '1.5px solid #E5E7EB', background: '#F9FAFB',
              fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => e.target.style.borderColor = '#7C3AED'}
            onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              width: 42, height: 42, borderRadius: 12, border: 'none',
              cursor: input.trim() ? 'pointer' : 'default',
              background: input.trim() ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s', flexShrink: 0,
            }}
          >
            {sending
              ? <Loader2 style={{ width: 16, height: 16, color: '#fff', animation: 'spin .8s linear infinite' }} />
              : <Send style={{ width: 16, height: 16, color: input.trim() ? '#fff' : '#9CA3AF' }} />
            }
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>🔒 This ticket is closed</p>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT — AdminSupportInbox
══════════════════════════════════════════════════════════════════════ */
export default function AdminSupportInbox() {
  const { user }                          = useAuth();
  const { socket }                        = useSocket();
  const [tickets,    setTickets]          = useState([]);
  const [activeId,   setActiveId]         = useState(null);
  const [statusFilter, setStatusFilter]   = useState('all');
  const [stats,      setStats]            = useState(null);
  const [loading,    setLoading]          = useState(true);

  const loadTickets = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const [ticketsRes, statsRes] = await Promise.all([
        supportAPI.getAllTickets(params),
        supportAPI.getStats(),
      ]);
      setTickets(ticketsRes.data.tickets || []);
      setStats(statsRes.data.stats);
    } catch { toast.error('Failed to load support tickets'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      // New ticket from user
      if (data.username) {
        setTickets(prev => {
          const exists = prev.find(t => t._id === data._id);
          if (exists) return prev;
          return [{ _id: data._id, ticketId: data.ticketId, subject: data.subject, category: data.category, status: 'open', priority: 'medium', unreadAdmin: 1, lastMessageAt: data.createdAt, user: { username: data.username, avatar: data.avatar } }, ...prev];
        });
        setStats(s => s ? { ...s, open: s.open + 1, total: s.total + 1, unread: s.unread + 1 } : s);
        toast('🎫 New support ticket from ' + data.username, { duration: 4000 });
      }
      // New message from user in existing ticket
      if (data.fromUser) {
        setTickets(prev => prev.map(t =>
          t._id === data.ticketId?.toString() || t._id === data.ticketId
            ? { ...t, unreadAdmin: activeId === t._id ? 0 : (t.unreadAdmin || 0) + 1, lastMessageAt: new Date() }
            : t
        ));
      }
    };
    socket.on('support:new-ticket',   handler);
    socket.on('support:new-message',  handler);
    return () => { socket.off('support:new-ticket', handler); socket.off('support:new-message', handler); };
  }, [socket, activeId]);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', height: '100%', fontFamily: 'system-ui, sans-serif', background: '#F9FAFB' }}>

        {/* Left Panel — Ticket List */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #F3F4F6', background: '#fff', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Headphones style={{ width: 15, height: 15, color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>Support Inbox</p>
                  {stats && <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{stats.total} total · {stats.unread} unread</p>}
                </div>
              </div>
              <button onClick={loadTickets} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <RefreshCw style={{ width: 13, height: 13, color: '#6B7280' }} />
              </button>
            </div>

            {/* Stats row */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                {[
                  { label: 'Open',     value: stats.open,       color: '#2563EB' },
                  { label: 'Active',   value: stats.inProgress, color: '#D97706' },
                  { label: 'Resolved', value: stats.resolved,   color: '#059669' },
                  { label: 'Closed',   value: stats.closed,     color: '#6B7280' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 9.5, color: '#9CA3AF', margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Status filter */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
              {STATUSES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit',
                    background: statusFilter === s.id ? (s.color || '#7C3AED') : '#F3F4F6',
                    color: statusFilter === s.id ? '#fff' : '#6B7280',
                    transition: 'all .15s',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                <Loader2 style={{ width: 20, height: 20, color: '#7C3AED', animation: 'spin .8s linear infinite' }} />
              </div>
            ) : tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>🎉</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>All caught up!</p>
                <p style={{ fontSize: 12, color: '#9CA3AF' }}>No tickets in this category</p>
              </div>
            ) : (
              tickets.map(t => (
                <TicketRow
                  key={t._id}
                  ticket={t}
                  active={activeId === t._id}
                  onClick={() => {
                    setActiveId(t._id);
                    setTickets(prev => prev.map(x => x._id === t._id ? { ...x, unreadAdmin: 0 } : x));
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel — Chat */}
        {activeId ? (
          <AdminTicketChat
            key={activeId}
            ticketId={activeId}
            currentUserId={user?._id}
            onClose={() => setActiveId(null)}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              🎧
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Select a ticket</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Choose a ticket from the left to start replying</p>
          </div>
        )}
      </div>
    </>
  );
}