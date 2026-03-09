// client/src/components/Admin/AdminNavbar.jsx
import { useState } from 'react';
import { Menu, Bell, Search, Megaphone, X, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import adminAPI from '../../utils/adminApi';
import toast from 'react-hot-toast';

export default function AdminNavbar({ onToggleSidebar, sidebarOpen }) {
  const { user } = useAuth();
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', type: 'info' });
  const [sending, setSending] = useState(false);

  const handleBroadcast = async () => {
    if (!broadcastForm.message.trim()) return toast.error('Message is required');
    setSending(true);
    try {
      await adminAPI.broadcast(broadcastForm);
      toast.success('Broadcast sent to all users!');
      setShowBroadcast(false);
      setBroadcastForm({ title: '', message: '', type: 'info' });
    } catch {
      toast.error('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="h-14 border-b border-white/5 bg-[#0d0d14] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs text-white/30">Quick search…</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Broadcast button */}
          <button
            onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20 text-violet-300 text-xs font-medium hover:bg-violet-500/25 transition-all"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Broadcast</span>
          </button>

          {/* Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
              alt={user?.username}
              className="w-7 h-7 rounded-full ring-2 ring-violet-500/30"
            />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-white/80">{user?.username}</p>
              <p className="text-[10px] text-violet-400 uppercase tracking-widest">{user?.role}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Broadcast modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#13131e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-violet-400" /> System Broadcast
              </h3>
              <button onClick={() => setShowBroadcast(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title (optional)"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
              />
              <textarea
                placeholder="Message to broadcast to all users…"
                rows={4}
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm(p => ({ ...p, message: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
              />
              <select
                value={broadcastForm.type}
                onChange={(e) => setBroadcastForm(p => ({ ...p, type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="info">ℹ️ Info</option>
                <option value="warning">⚠️ Warning</option>
                <option value="danger">🚨 Danger</option>
                <option value="success">✅ Success</option>
              </select>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowBroadcast(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBroadcast}
                disabled={sending}
                className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Sending…' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}