// client/src/components/Admin/AnalyticsDashboard.jsx
import { useState, useEffect } from 'react';
import { TrendingUp, MessageSquare, Users, Video, RefreshCw } from 'lucide-react';
import adminAPI from '../../utils/adminApi';

// Minimal bar chart without recharts dependency
const BarChart = ({ data = [], color = '#7c3aed', height = 120, labelKey = '_id', valueKey = 'count' }) => {
  if (!data.length) return (
    <div className="flex items-center justify-center h-24 text-white/20 text-xs">No data available</div>
  );
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
            <div
              className="w-full rounded-t-sm transition-all hover:opacity-80"
              style={{ height: `${Math.max((d[valueKey] / max) * (height - 20), 2)}px`, backgroundColor: color }}
            />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded
              opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
              {d[valueKey]}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-white/20 truncate">
            {String(d[labelKey]).slice(-5)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Donut-ish role breakdown
const RoleBreakdown = ({ data = [] }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  const COLORS = { user: '#6d28d9', admin: '#7c3aed', superadmin: '#a855f7' };
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d._id} className="flex items-center gap-3">
          <span className="text-xs text-white/50 capitalize w-20">{d._id}</span>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.count / total) * 100}%`, backgroundColor: COLORS[d._id] || '#6d28d9' }}
            />
          </div>
          <span className="text-xs text-white/40 w-8 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getSystemStats();
      setStats(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const s = stats?.stats || {};
  const c = stats?.charts || {};

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-sm text-white/30 mt-0.5">30-day platform insights</p>
        </div>
        <button onClick={fetchStats} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'New Users Today',    value: s.newUsersToday,    icon: Users,          color: 'text-violet-400' },
          { label: 'Messages (24h)',     value: s.messagesLast24h,  icon: MessageSquare,  color: 'text-blue-400' },
          { label: 'Active Rooms',       value: s.activeRooms,      icon: Video,          color: 'text-fuchsia-400' },
          { label: 'Total Users',        value: s.totalUsers,       icon: TrendingUp,     color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0d0d14] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-white/30 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{value?.toLocaleString() ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* User growth 30d */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">User Growth (30 days)</h3>
          <BarChart data={c.userGrowth30 || []} color="#7c3aed" height={120} />
        </div>

        {/* Message activity 30d */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Message Activity (30 days)</h3>
          <BarChart data={c.messageActivity30 || []} color="#2563eb" height={120} />
        </div>

        {/* Role breakdown */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">User Role Breakdown</h3>
          <RoleBreakdown data={c.roleBreakdown || []} />
        </div>

        {/* Quick stats */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Platform Health</h3>
          <div className="space-y-3">
            {[
              { label: 'Total Messages',    value: s.totalMessages },
              { label: 'Total Rooms',       value: s.totalRooms },
              { label: 'Banned Users',      value: s.bannedUsers },
              { label: 'Muted Users',       value: s.mutedUsers },
              { label: 'Pending Reports',   value: s.pendingReports },
              { label: 'Admin Staff',       value: s.adminCount },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-white/40">{label}</span>
                <span className="text-sm font-semibold text-white/70">{value?.toLocaleString() ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}