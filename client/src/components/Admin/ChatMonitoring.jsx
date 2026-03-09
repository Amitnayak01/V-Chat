// client/src/components/Admin/ChatMonitoring.jsx
import { useState, useEffect, useCallback } from 'react';
import { Search, Trash2, RefreshCw, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import adminAPI from '../../utils/adminApi';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

export default function ChatMonitoring() {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [deleting, setDeleting] = useState(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getMessages({ page, limit: 20, search, roomId: roomFilter });
      setMessages(res.data.messages);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { toast.error('Failed to load messages'); }
    finally { setLoading(false); }
  }, [page, search, roomFilter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Live: insert new room messages
  useEffect(() => {
    if (!socket) return;
    socket.on('chat-message', (msg) => {
      setMessages(prev => [msg, ...prev.slice(0, 19)]);
      setTotal(t => t + 1);
    });
    return () => socket.off('chat-message');
  }, [socket]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    setDeleting(id);
    try {
      await adminAPI.deleteMessage(id);
      setMessages(prev => prev.filter(m => m._id !== id));
      toast.success('Message deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Chat Monitoring</h1>
          <p className="text-sm text-white/30 mt-0.5">{total.toLocaleString()} total messages</p>
        </div>
        <button onClick={fetchMessages} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 flex items-center gap-2 bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search message content…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-white placeholder-white/30 focus:outline-none w-full"
          />
        </div>
        <input
          type="text"
          placeholder="Filter by Room ID…"
          value={roomFilter}
          onChange={e => { setRoomFilter(e.target.value); setPage(1); }}
          className="bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/30 focus:outline-none w-48"
        />
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live monitoring active
      </div>

      {/* Messages */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {messages.map(msg => (
              <div key={msg._id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                <img
                  src={msg.sender?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderUsername}`}
                  className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5"
                  alt={msg.senderUsername}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white/70">{msg.senderUsername || msg.sender?.username}</span>
                    <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full truncate max-w-32">
                      Room: {msg.roomId}
                    </span>
                    <span className="text-[10px] text-white/20">{new Date(msg.createdAt).toLocaleString()}</span>
                    {msg.sender?.role && msg.sender.role !== 'user' && (
                      <span className="text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">{msg.sender.role}</span>
                    )}
                  </div>
                  <p className="text-sm text-white/60 break-words">{msg.content}</p>
                </div>
                <button
                  onClick={() => handleDelete(msg._id)}
                  disabled={deleting === msg._id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {!messages.length && (
              <div className="flex flex-col items-center justify-center py-16 text-white/20">
                <MessageSquare className="w-8 h-8 mb-2" />
                <p className="text-sm">No messages found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 disabled:opacity-30 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 disabled:opacity-30 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}