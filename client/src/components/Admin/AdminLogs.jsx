// client/src/components/Admin/AdminLogs.jsx
import { useState, useEffect, useCallback } from 'react';
import { ScrollText, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import adminAPI from '../../utils/adminApi';

const ACTION_COLORS = {
  ban_user:       'text-red-400',
  unban_user:     'text-emerald-400',
  delete_user:    'text-red-500',
  promote_user:   'text-violet-400',
  demote_user:    'text-yellow-400',
  mute_user:      'text-orange-400',
  unmute_user:    'text-emerald-400',
  delete_message: 'text-red-400',
  delete_room:    'text-fuchsia-400',
  end_call:       'text-blue-400',
  broadcast:      'text-cyan-400',
  resolve_report: 'text-emerald-400',
  dismiss_report: 'text-white/40',
};

const ACTION_ICONS = {
  ban_user: '🚫', unban_user: '✅', delete_user: '🗑️', promote_user: '⬆️',
  demote_user: '⬇️', mute_user: '🔇', unmute_user: '🔊', delete_message: '💬',
  delete_room: '🎥', end_call: '📵', broadcast: '📢', resolve_report: '✅',
  dismiss_report: '❌', remove_user_from_room: '👢', view_dashboard: '👁️'
};

const ALL_ACTIONS = [
  'ban_user','unban_user','delete_user','promote_user','demote_user',
  'mute_user','unmute_user','delete_message','delete_room','end_call',
  'broadcast','resolve_report','dismiss_report'
];

export default function AdminLogs() {
  const [logs, setLogs]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getLogs({ page, limit: 25, action: actionFilter });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Admin Logs</h1>
          <p className="text-sm text-white/30 mt-0.5">{total.toLocaleString()} total actions</p>
        </div>
        <button onClick={fetchLogs} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-white/30 flex-shrink-0" />
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none"
        >
          <option value="">All Actions</option>
          {ALL_ACTIONS.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Log list */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {logs.map(log => (
              <div key={log._id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                {/* Icon */}
                <span className="text-base flex-shrink-0 mt-0.5" title={log.action}>
                  {ACTION_ICONS[log.action] || '⚙️'}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    {/* Admin */}
                    <div className="flex items-center gap-1.5">
                      <img
                        src={log.adminId?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${log.adminUsername}`}
                        className="w-4 h-4 rounded-full"
                        alt={log.adminUsername}
                      />
                      <span className="text-xs font-semibold text-white/70">{log.adminUsername}</span>
                    </div>

                    {/* Action */}
                    <span className={`text-xs font-medium capitalize ${ACTION_COLORS[log.action] || 'text-white/40'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>

                    {/* Target */}
                    {log.targetUsername && (
                      <span className="text-xs text-white/30">→ {log.targetUsername}</span>
                    )}
                  </div>

                  {log.details && (
                    <p className="text-xs text-white/30 mt-0.5 truncate">{log.details}</p>
                  )}
                </div>

                <span className="text-[10px] text-white/20 flex-shrink-0 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
            {!logs.length && (
              <div className="flex flex-col items-center justify-center py-16 text-white/20">
                <ScrollText className="w-8 h-8 mb-2" />
                <p className="text-sm">No logs found</p>
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