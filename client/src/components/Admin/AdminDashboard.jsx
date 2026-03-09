// client/src/components/Admin/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { Users, MessageSquare, Video, Activity, UserX, Flag, TrendingUp, Clock } from 'lucide-react';
import adminAPI from '../../utils/adminApi';

const StatCard = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-4 flex items-start gap-4 hover:border-white/10 transition-all">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value?.toLocaleString() ?? '—'}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
    {trend !== undefined && (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
        {trend >= 0 ? '+' : ''}{trend}%
      </span>
    )}
  </div>
);

const SimpleBar = ({ data = [], color = '#7c3aed' }) => {
  if (!data.length) return <p className="text-white/20 text-xs text-center py-4">No data</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-sm transition-all hover:opacity-80"
            style={{ height: `${(d.count / max) * 80}px`, minHeight: 2, backgroundColor: color }}
            title={`${d._id}: ${d.count}`}
          />
        </div>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await adminAPI.getDashboard();
      setData(res.data);
    } catch {
      /* handled gracefully */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const s = data?.stats || {};

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-sm text-white/30 mt-1">Real-time platform statistics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}        label="Total Users"    value={s.totalUsers}    sub={`${s.onlineUsers} online now`}  color="bg-violet-600"  />
        <StatCard icon={Activity}     label="Online Users"   value={s.onlineUsers}   sub="Currently active"               color="bg-emerald-600" />
        <StatCard icon={MessageSquare}label="Messages"       value={s.totalMessages} sub="All time"                       color="bg-blue-600"    />
        <StatCard icon={Video}        label="Active Rooms"   value={s.activeRooms}   sub={`${s.totalRooms} total`}        color="bg-fuchsia-600" />
        <StatCard icon={UserX}        label="Banned Users"   value={s.bannedUsers}   sub="Platform bans"                  color="bg-red-700"     />
        <StatCard icon={Flag}         label="Pending Reports"value={s.pendingReports}sub="Need review"                    color="bg-orange-600"  />
        <StatCard icon={TrendingUp}   label="Total Rooms"    value={s.totalRooms}    sub="All meetings"                   color="bg-cyan-600"    />
        <StatCard icon={MessageSquare}label="Direct Messages"value={s.totalDMs}      sub="All DMs"                        color="bg-pink-600"    />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User growth */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">User Growth</h3>
            <span className="text-xs text-white/30">Last 7 days</span>
          </div>
          <SimpleBar data={data?.charts?.userGrowth || []} color="#7c3aed" />
          <div className="flex justify-between mt-2">
            {(data?.charts?.userGrowth || []).map((d, i) => (
              <span key={i} className="text-[9px] text-white/20 flex-1 text-center">
                {d._id?.slice(5)}
              </span>
            ))}
          </div>
        </div>

        {/* Messages per hour */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Messages per Hour</h3>
            <span className="text-xs text-white/30">Last 24h</span>
          </div>
          <SimpleBar data={data?.charts?.messagesPerHour?.map(d => ({ _id: `${d._id}:00`, count: d.count })) || []} color="#2563eb" />
        </div>
      </div>

      {/* Recent users */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Signups</h3>
        <div className="space-y-3">
          {(data?.recentUsers || []).map(user => (
            <div key={user._id} className="flex items-center gap-3">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                className="w-8 h-8 rounded-full"
                alt={user.username}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 font-medium truncate">{user.username}</p>
                <p className="text-xs text-white/30">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {user.isBanned && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Banned</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                  ${user.status === 'online'  ? 'bg-emerald-500/20 text-emerald-400' :
                    user.status === 'away'    ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-white/5 text-white/30'}`}>
                  {user.status}
                </span>
                {user.role !== 'user' && (
                  <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full capitalize">{user.role}</span>
                )}
              </div>
            </div>
          ))}
          {!data?.recentUsers?.length && (
            <p className="text-white/20 text-sm text-center py-4">No users yet</p>
          )}
        </div>
      </div>
    </div>
  );
}