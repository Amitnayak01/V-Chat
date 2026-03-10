import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones, Plus, Send, X, ChevronLeft, Clock,
  CheckCircle, AlertCircle, XCircle, MessageSquare,
  Bug, Lock, Phone, HelpCircle, Loader2, Sparkles,
  RefreshCw, Circle,
} from 'lucide-react';
import { supportAPI } from '../../utils/supportApi';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

/* ── Constants ─────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'bug',     label: 'Bug Report',       emoji: '🐛', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { id: 'account', label: 'Account Issue',    emoji: '🔒', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'chat',    label: 'Chat Problem',     emoji: '💬', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { id: 'call',    label: 'Call Problem',     emoji: '📞', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { id: 'general', label: 'General Question', emoji: '🙋', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
];

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: '#2563EB', bg: '#EFF6FF', icon: Circle },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', icon: Clock },
  resolved:    { label: 'Resolved',    color: '#059669', bg: '#ECFDF5', icon: CheckCircle },
  closed:      { label: 'Closed',      color: '#6B7280', bg: '#F9FAFB', icon: XCircle },
};

const cat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[4];

/* ── Helpers ───────────────────────────────────────────────────────── */
const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (d) => {
  const date = new Date(d);
  const now  = new Date();
  const diff = now - date;
  if (diff < 86400000) return formatTime(d);
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/* ── New Ticket Form ───────────────────────────────────────────────── */
const NewTicketForm = ({ onSubmit, onCancel, submitting }) => {
  const [form, setForm] = useState({ category: '', subject: '', message: '' });

  const valid = form.category && form.subject.trim() && form.message.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        background: '#fff', borderRadius: 20, border: '1px solid #E5E7EB',
        overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>New Support Ticket</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>We typically reply within a few hours</p>
          </div>
        </div>
        <button onClick={onCancel} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X style={{ width: 16, height: 16, color: '#fff' }} />
        </button>
      </div>

      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Category */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Category</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setForm(f => ({ ...f, category: c.id }))}
                style={{
                  padding: '10px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${form.category === c.id ? c.color : '#E5E7EB'}`,
                  background: form.category === c.id ? c.bg : '#F9FAFB',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{c.emoji}</span>
                <span style={{ fontSize: 10.5, fontWeight: form.category === c.id ? 700 : 500, color: form.category === c.id ? c.color : '#6B7280', textAlign: 'center', lineHeight: 1.3 }}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Subject</p>
          <input
            type="text"
            placeholder="Brief description of your issue…"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            maxLength={200}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
              border: '1.5px solid #E5E7EB', background: '#F9FAFB', fontSize: 13,
              color: '#111827', outline: 'none', fontFamily: 'inherit', transition: 'border .15s',
            }}
            onFocus={e => e.target.style.borderColor = '#667eea'}
            onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>

        {/* Message */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Message</p>
          <textarea
            placeholder="Describe your issue in detail…"
            rows={4}
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            maxLength={2000}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
              border: '1.5px solid #E5E7EB', background: '#F9FAFB', fontSize: 13,
              color: '#111827', outline: 'none', fontFamily: 'inherit', resize: 'vertical',
              transition: 'border .15s',
            }}
            onFocus={e => e.target.style.borderColor = '#667eea'}
            onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
          />
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>{form.message.length}/2000</p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E5E7EB',
              background: '#F9FAFB', fontSize: 13, fontWeight: 600, color: '#6B7280',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!valid || submitting}
            style={{
              flex: 2, padding: '11px', borderRadius: 10, border: 'none',
              background: valid && !submitting ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#E5E7EB',
              fontSize: 13, fontWeight: 700, color: valid && !submitting ? '#fff' : '#9CA3AF',
              cursor: valid && !submitting ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', transition: 'all .15s',
            }}
          >
            {submitting
              ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin .8s linear infinite' }} /> Submitting…</>
              : <><Send style={{ width: 14, height: 14 }} /> Submit Ticket</>
            }
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Ticket List Item ──────────────────────────────────────────────── */
const TicketItem = ({ ticket, onClick }) => {
  const c  = cat(ticket.category);
  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const StatusIcon = sc.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      style={{
        padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
        border: '1.5px solid #F3F4F6', background: '#fff',
        display: 'flex', alignItems: 'flex-start', gap: 12,
        transition: 'all .15s', marginBottom: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#C7D2FE'; e.currentTarget.style.background = '#FAFAFE'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#F3F4F6'; e.currentTarget.style.background = '#fff'; }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
        {c.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{ticket.subject}</p>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{formatDate(ticket.lastMessageAt)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, color: c.color, fontWeight: 600 }}>{c.label}</span>
          <span style={{ fontSize: 10, color: '#D1D5DB' }}>·</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StatusIcon style={{ width: 10, height: 10, color: sc.color }} />
            <span style={{ fontSize: 10.5, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
          </div>
          {ticket.unreadUser > 0 && (
            <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 999, background: '#7C3AED', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
              {ticket.unreadUser}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ── Chat Bubble ───────────────────────────────────────────────────── */
const Bubble = ({ msg, isUser }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}
  >
    {!isUser && (
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>
        🛡️
      </div>
    )}
    <div style={{ maxWidth: '75%' }}>
      {!isUser && (
        <p style={{ fontSize: 10.5, color: '#9CA3AF', marginBottom: 3, marginLeft: 2, fontWeight: 600 }}>Support Team</p>
      )}
      <div style={{
        padding: '10px 14px', borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#F3F4F6',
        color: isUser ? '#fff' : '#111827',
        fontSize: 13.5, lineHeight: 1.5,
        boxShadow: isUser ? '0 2px 12px rgba(102,126,234,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {msg.content}
      </div>
      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: isUser ? 'right' : 'left', marginLeft: 2 }}>
        {formatTime(msg.createdAt)}
      </p>
    </div>
  </motion.div>
);

/* ── Ticket Chat View ──────────────────────────────────────────────── */
const TicketChat = ({ ticketId, onBack, currentUserId }) => {
  const [ticket,   setTicket]   = useState(null);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const { socket }              = useSocket();
  const bottomRef               = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await supportAPI.getTicket(ticketId);
      setTicket(res.data.ticket);
    } catch { toast.error('Failed to load ticket'); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.ticketId === ticketId || data.ticketId?.toString() === ticketId) {
        setTicket(prev => prev ? { ...prev, messages: [...prev.messages, data.message], status: prev.status } : prev);
      }
    };
    socket.on('support:new-message', handler);
    const statusHandler = (data) => {
      if (data.ticketId === ticketId) setTicket(prev => prev ? { ...prev, status: data.status } : prev);
    };
    socket.on('support:ticket-updated', statusHandler);
    return () => { socket.off('support:new-message', handler); socket.off('support:ticket-updated', statusHandler); };
  }, [socket, ticketId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.messages?.length]);

const send = async () => {
  if (!input.trim() || sending) return;
  setSending(true);
  try {
    await supportAPI.sendMessage(ticketId, input.trim());
    setInput('');
  } catch { toast.error('Failed to send message'); }
  finally { setSending(false); }
};

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <Loader2 style={{ width: 24, height: 24, color: '#667eea', animation: 'spin .8s linear infinite' }} />
    </div>
  );

  if (!ticket) return null;

  const c  = cat(ticket.category);
  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const StatusIcon = sc.icon;
  const isClosed = ticket.status === 'closed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <ChevronLeft style={{ width: 16, height: 16, color: '#6B7280' }} />
        </button>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
          {c.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{ticket.ticketId}</span>
            <span style={{ fontSize: 10, color: '#D1D5DB' }}>·</span>
            <StatusIcon style={{ width: 10, height: 10, color: sc.color }} />
            <span style={{ fontSize: 10.5, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#FAFAFA' }}>
        {ticket.messages?.map((msg, i) => (
          <Bubble
            key={msg._id || i}
            msg={msg}
            isUser={msg.sender?._id === currentUserId || msg.sender === currentUserId || msg.senderRole === 'user'}
          />
        ))}
        {isClosed && (
          <div style={{ textAlign: 'center', padding: '12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB', marginTop: 8 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>🔒 This ticket is closed</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', background: '#fff', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type your message…"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12,
              border: '1.5px solid #E5E7EB', background: '#F9FAFB',
              fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => e.target.style.borderColor = '#667eea'}
            onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              width: 42, height: 42, borderRadius: 12, border: 'none', cursor: input.trim() ? 'pointer' : 'default',
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
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT — SupportChat
══════════════════════════════════════════════════════════════════════ */
export default function SupportChat() {
  const { user }                      = useAuth();
  const { socket }                    = useSocket();
  const [view,       setView]         = useState('list'); // 'list' | 'new' | 'chat'
  const [tickets,    setTickets]      = useState([]);
  const [activeId,   setActiveId]     = useState(null);
  const [loading,    setLoading]      = useState(true);
  const [submitting, setSubmitting]   = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const res = await supportAPI.getMyTickets();
      setTickets(res.data.tickets || []);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.fromAdmin) {
        setTickets(prev => prev.map(t =>
          t._id === data.ticketId?.toString() || t._id === data.ticketId
            ? { ...t, unreadUser: (t.unreadUser || 0) + (activeId === t._id ? 0 : 1), lastMessageAt: new Date() }
            : t
        ));
        if (activeId !== data.ticketId) toast('💬 Admin replied to your ticket', { duration: 3000 });
      }
    };
    socket.on('support:new-message', handler);
    return () => socket.off('support:new-message', handler);
  }, [socket, activeId]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      const res = await supportAPI.createTicket(form);
      const ticket = res.data.ticket;
      setTickets(prev => [ticket, ...prev]);
      setActiveId(ticket._id);
      setView('chat');
      toast.success('Ticket created! We\'ll reply soon 👍');
    } catch { toast.error('Failed to create ticket'); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 80px', fontFamily: 'system-ui, sans-serif' }}>

        {/* Page header */}
        {view !== 'chat' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Headphones style={{ width: 20, height: 20, color: '#fff' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>Support</h2>
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Chat directly with our admin team</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={loadTickets}
                  style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <RefreshCw style={{ width: 14, height: 14, color: '#6B7280' }} />
                </button>
                <button
                  onClick={() => setView('new')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} /> New Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* New Ticket Form */}
          {view === 'new' && (
            <NewTicketForm
              key="new"
              onSubmit={handleSubmit}
              onCancel={() => setView('list')}
              submitting={submitting}
            />
          )}

          {/* Ticket List */}
          {view === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <Loader2 style={{ width: 24, height: 24, color: '#667eea', animation: 'spin .8s linear infinite' }} />
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px solid #F3F4F6' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
                    🎧
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>No tickets yet</p>
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>Create a ticket to chat with the admin team</p>
                  <button
                    onClick={() => setView('new')}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Create First Ticket
                  </button>
                </div>
              ) : (
                <div>
                  {tickets.map(t => (
                    <TicketItem
                      key={t._id}
                      ticket={t}
                      onClick={() => { setActiveId(t._id); setView('chat'); }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Ticket Chat */}
          {view === 'chat' && activeId && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: '#fff', borderRadius: 20, border: '1px solid #E5E7EB', overflow: 'hidden', height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
            >
              <TicketChat
                ticketId={activeId}
                onBack={() => { setView('list'); setActiveId(null); loadTickets(); }}
                currentUserId={user?._id}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </>
  );
}