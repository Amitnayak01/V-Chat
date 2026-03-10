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
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-[#0d0d14] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
      
      {/* Colored top banner based on type */}
      <div className={`px-6 py-4 flex items-center justify-between
        ${broadcastForm.type === 'danger'  ? 'bg-red-500/20 border-b border-red-500/30' :
          broadcastForm.type === 'warning' ? 'bg-yellow-500/20 border-b border-yellow-500/30' :
          broadcastForm.type === 'success' ? 'bg-emerald-500/20 border-b border-emerald-500/30' :
                                             'bg-violet-500/20 border-b border-violet-500/30'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl
            ${broadcastForm.type === 'danger'  ? 'bg-red-500/30' :
              broadcastForm.type === 'warning' ? 'bg-yellow-500/30' :
              broadcastForm.type === 'success' ? 'bg-emerald-500/30' :
                                                 'bg-violet-500/30'}`}>
            {broadcastForm.type === 'danger'  ? '🚨' :
             broadcastForm.type === 'warning' ? '⚠️' :
             broadcastForm.type === 'success' ? '✅' : '📢'}
          </div>
          <div>
            <p className="text-sm font-bold text-white">System Broadcast</p>
            <p className="text-xs text-white/40">Sends to all connected users instantly</p>
          </div>
        </div>
        <button onClick={() => setShowBroadcast(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-4">

        {/* Type selector as pills */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Message Type</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: 'info',    label: 'Info',    emoji: '📢', color: 'border-violet-500/50 bg-violet-500/15 text-violet-300' },
              { value: 'warning', label: 'Warning', emoji: '⚠️', color: 'border-yellow-500/50 bg-yellow-500/15 text-yellow-300' },
              { value: 'danger',  label: 'Danger',  emoji: '🚨', color: 'border-red-500/50 bg-red-500/15 text-red-300' },
              { value: 'success', label: 'Success', emoji: '✅', color: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => setBroadcastForm(p => ({ ...p, type: t.value }))}
                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all
                  ${broadcastForm.type === t.value ? t.color : 'border-white/10 bg-white/5 text-white/30 hover:bg-white/10'}`}
              >
                <span className="text-base">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Title</p>
          <input
            type="text"
            placeholder="e.g. Scheduled Maintenance"
            value={broadcastForm.title}
            onChange={(e) => setBroadcastForm(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>

        {/* Message */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Message</p>
          <textarea
            placeholder="Write your announcement here…"
            rows={3}
            value={broadcastForm.message}
            onChange={(e) => setBroadcastForm(p => ({ ...p, message: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 resize-none transition-all"
          />
          <p className="text-[10px] text-white/20 mt-1 text-right">{broadcastForm.message.length} chars</p>
        </div>

        {/* Live preview */}
        {(broadcastForm.title || broadcastForm.message) && (
          <div className={`rounded-xl p-3 border text-sm flex items-start gap-3
            ${broadcastForm.type === 'danger'  ? 'bg-red-500/10 border-red-500/20 text-red-200' :
              broadcastForm.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200' :
              broadcastForm.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' :
                                                 'bg-violet-500/10 border-violet-500/20 text-violet-200'}`}>
            <span className="text-base flex-shrink-0">
              {broadcastForm.type === 'danger' ? '🚨' : broadcastForm.type === 'warning' ? '⚠️' : broadcastForm.type === 'success' ? '✅' : '📢'}
            </span>
            <div>
              {broadcastForm.title && <p className="font-semibold text-xs mb-0.5">{broadcastForm.title}</p>}
              <p className="text-xs opacity-80">{broadcastForm.message || '…'}</p>
            </div>
            <span className="ml-auto text-[10px] opacity-40 flex-shrink-0">Preview</span>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="px-6 pb-6 flex gap-3">
        <button
          onClick={() => { setShowBroadcast(false); setBroadcastForm({ title: '', message: '', type: 'info' }); }}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleBroadcast}
          disabled={sending || !broadcastForm.message.trim()}
          className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40
            ${broadcastForm.type === 'danger'  ? 'bg-red-600 hover:bg-red-500' :
              broadcastForm.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-500' :
              broadcastForm.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' :
                                                 'bg-violet-600 hover:bg-violet-500'}`}
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? 'Sending…' : 'Broadcast Now'}
        </button>
      </div>

    </div>
  </div>
)}
    </>
  );
}