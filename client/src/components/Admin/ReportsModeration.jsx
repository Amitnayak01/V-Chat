// client/src/components/Admin/ReportsModeration.jsx
import { useState, useEffect, useCallback } from 'react';
import { Flag, Check, X, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';
import adminAPI from '../../utils/adminApi';
import toast from 'react-hot-toast';

const REASON_LABELS = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate_content: 'Inappropriate Content',
  hate_speech: 'Hate Speech',
  misinformation: 'Misinformation',
  other: 'Other'
};

const TYPE_COLORS = {
  user:    'bg-violet-500/15 text-violet-400',
  message: 'bg-blue-500/15 text-blue-400',
  room:    'bg-fuchsia-500/15 text-fuchsia-400'
};

export default function ReportsModeration() {
  const [reports, setReports] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [resolving, setResolving] = useState(null);
  const [resolutionModal, setResolutionModal] = useState(null);
  const [resolution, setResolution] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getReports({ page, limit: 15, status: statusFilter });
      setReports(res.data.reports);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleResolve = async (status) => {
    if (!resolutionModal) return;
    setResolving(resolutionModal._id);
    try {
      await adminAPI.resolveReport(resolutionModal._id, { status, resolution });
      toast.success(`Report ${status}`);
      fetchReports();
      setResolutionModal(null);
      setResolution('');
    } catch { toast.error('Action failed'); }
    finally { setResolving(null); }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Reports Moderation</h1>
          <p className="text-sm text-white/30 mt-0.5">{total.toLocaleString()} {statusFilter} reports</p>
        </div>
        <button onClick={fetchReports} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2">
        {['pending', 'reviewed', 'resolved', 'dismissed'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all
              ${statusFilter === s
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {reports.map(report => (
              <div key={report._id} className="px-4 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Flag className="w-4 h-4 text-orange-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[report.type]}`}>
                        {report.type}
                      </span>
                      <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full">
                        {REASON_LABELS[report.reason] || report.reason}
                      </span>
                      <span className="text-xs text-white/20">
                        by {report.reportedBy?.username || report.reportedByUsername}
                      </span>
                      <span className="text-xs text-white/20">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Target */}
                    {report.targetUser && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-white/30">Target user:</span>
                        <div className="flex items-center gap-1.5">
                          <img src={report.targetUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${report.targetUser.username}`}
                            className="w-4 h-4 rounded-full" alt="" />
                          <span className="text-xs text-white/60 font-medium">{report.targetUser.username}</span>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {report.description && (
                      <p className="text-sm text-white/40 mt-1 italic">"{report.description}"</p>
                    )}

                    {/* Resolution */}
                    {report.resolution && (
                      <p className="text-xs text-white/30 mt-1">Resolution: {report.resolution}</p>
                    )}
                  </div>

                  {/* Actions for pending */}
                  {report.status === 'pending' && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setResolutionModal(report)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-all flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Resolve
                      </button>
                      <button
                        onClick={() => { setResolutionModal(report); setResolution('No violation found'); }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 text-xs font-medium transition-all flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </div>
                  )}

                  {report.status !== 'pending' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize flex-shrink-0
                      ${report.status === 'resolved'  ? 'bg-emerald-500/15 text-emerald-400' :
                        report.status === 'dismissed' ? 'bg-white/5 text-white/30' :
                                                        'bg-yellow-500/15 text-yellow-400'}`}>
                      {report.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!reports.length && (
              <div className="flex flex-col items-center justify-center py-16 text-white/20">
                <AlertTriangle className="w-8 h-8 mb-2" />
                <p className="text-sm">No {statusFilter} reports</p>
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

      {/* Resolution Modal */}
      {resolutionModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#13131e] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Resolve Report</h3>
            <p className="text-sm text-white/50 mb-4">
              Report by <strong className="text-white/70">{resolutionModal.reportedByUsername}</strong> about {resolutionModal.type}
            </p>
            <textarea
              placeholder="Resolution notes (optional)…"
              rows={3}
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              className="w-full mb-4 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setResolutionModal(null); setResolution(''); }}
                className="flex-1 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button onClick={() => handleResolve('dismissed')} disabled={!!resolving}
                className="flex-1 py-2 rounded-lg bg-white/10 text-white/60 text-sm font-medium hover:bg-white/15 transition-all">
                Dismiss
              </button>
              <button onClick={() => handleResolve('resolved')} disabled={!!resolving}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all">
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}