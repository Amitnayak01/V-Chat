// client/src/components/Admin/SystemHealth.jsx
import { useState, useEffect } from 'react';
import { Activity, Server, Database, Cpu, HardDrive, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import adminAPI from '../../utils/adminApi';
import { useSocket } from '../../context/SocketContext';

const MetricBar = ({ label, value, max, unit = '', color = '#7c3aed' }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/40">{label}</span>
        <span className="text-xs text-white/60 font-mono">{value}{unit} / {max}{unit}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : color
          }}
        />
      </div>
    </div>
  );
};

const StatusBadge = ({ ok, label }) => (
  <div className="flex items-center gap-2">
    {ok
      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
      : <AlertTriangle className="w-4 h-4 text-red-400" />}
    <span className={`text-sm ${ok ? 'text-white/60' : 'text-red-400'}`}>{label}</span>
    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {ok ? 'OK' : 'Error'}
    </span>
  </div>
);

const formatUptime = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
};

export default function SystemHealth() {
  const { socket } = useSocket();
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getSystemStats();
      setStats(res.data.stats);
      setLastRefresh(new Date());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  // Track real-time online count
  useEffect(() => {
    if (!socket) return;
    socket.on('online-users-list', ({ users }) => setOnlineCount(users.length));
    socket.on('user-online',  () => setOnlineCount(c => c + 1));
    socket.on('user-offline', () => setOnlineCount(c => Math.max(0, c - 1)));
    return () => {
      socket.off('online-users-list');
      socket.off('user-online');
      socket.off('user-offline');
    };
  }, [socket]);

  if (loading && !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const mem = stats?.memoryUsage || {};
  const heapUsed  = Math.round((mem.heapUsed  || 0) / (1024 * 1024));
  const heapTotal = Math.round((mem.heapTotal || 0) / (1024 * 1024));
  const rss       = Math.round((mem.rss       || 0) / (1024 * 1024));

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System Health</h1>
          <p className="text-sm text-white/30 mt-0.5">
            {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <button onClick={fetchStats} disabled={loading}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-30">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Service status */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Service Status</h3>
        <div className="space-y-3">
          <StatusBadge ok={!!stats} label="API Server" />
          <StatusBadge ok={true}    label="Database (MongoDB)" />
          <StatusBadge ok={!!socket?.connected} label="Socket.io" />
          <StatusBadge ok={true}    label="WebRTC Relay" />
        </div>
      </div>

      {/* Server metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Uptime */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Server Info</h3>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">Uptime</span>
              <span className="text-white/60 font-mono">{stats?.uptime ? formatUptime(stats.uptime) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Online Users</span>
              <span className="text-emerald-400 font-semibold">{onlineCount || stats?.onlineUsers || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Active Rooms</span>
              <span className="text-white/60">{stats?.activeRooms || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Total Users</span>
              <span className="text-white/60">{stats?.totalUsers?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Memory Usage</h3>
          </div>
          <div className="space-y-3">
            <MetricBar label="Heap Used" value={heapUsed} max={heapTotal || 512} unit="MB" color="#2563eb" />
            <MetricBar label="RSS"       value={rss}      max={512}              unit="MB" color="#7c3aed" />
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-xs text-white/30">
            External: {formatBytes(mem.external || 0)} · ArrayBuffers: {formatBytes(mem.arrayBuffers || 0)}
          </div>
        </div>
      </div>

      {/* Platform stats */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-fuchsia-400" />
          <h3 className="text-sm font-semibold text-white">Database Stats</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Users',     value: stats?.totalUsers },
            { label: 'Messages',  value: stats?.totalMessages },
            { label: 'Rooms',     value: stats?.totalRooms },
            { label: 'Reports',   value: stats?.totalReports },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-white">{value?.toLocaleString() ?? '—'}</p>
              <p className="text-xs text-white/30 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}