// client/src/components/Admin/RoomsManagement.jsx
import { useState, useEffect, useCallback } from 'react';
import { Video, PhoneOff, Users, Clock, RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import adminAPI from '../../utils/adminApi';
import toast from 'react-hot-toast';

export default function RoomsManagement() {
  const [rooms, setRooms]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getRooms({ page, limit: 15, active: activeFilter });
      setRooms(res.data.rooms);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { toast.error('Failed to load rooms'); }
    finally { setLoading(false); }
  }, [page, activeFilter]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleTerminate = async (roomId) => {
    if (!window.confirm(`Terminate room "${roomId}"?`)) return;
    try {
      await adminAPI.deleteRoom(roomId);
      setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, isActive: false } : r));
      toast.success('Room terminated');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Rooms Management</h1>
          <p className="text-sm text-white/30 mt-0.5">{total.toLocaleString()} total rooms</p>
        </div>
        <button onClick={fetchRooms} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[['', 'All'], ['true', 'Active'], ['false', 'Ended']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => { setActiveFilter(val); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${activeFilter === val
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Room cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(room => (
            <div key={room._id} className="bg-[#0d0d14] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                    ${room.isActive ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                    <Video className={`w-3.5 h-3.5 ${room.isActive ? 'text-emerald-400' : 'text-white/30'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/70 font-mono truncate">{room.roomId}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                      ${room.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                      {room.isActive ? 'Active' : 'Ended'}
                    </span>
                  </div>
                </div>
                {room.isActive && (
                  <button
                    onClick={() => handleTerminate(room.roomId)}
                    className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                    title="Terminate"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="space-y-1.5 text-xs text-white/30">
                {room.host && (
                  <div className="flex items-center gap-2">
                    <span className="text-white/20">Host:</span>
                    <div className="flex items-center gap-1.5">
                      <img src={room.host.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.host.username}`}
                        className="w-4 h-4 rounded-full" alt="" />
                      <span className="text-white/50">{room.host.username}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  <span>{room.participants?.length || 0} participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>{room.startedAt ? new Date(room.startedAt).toLocaleString() : '—'}</span>
                </div>
                {room.isRecording && (
                  <div className="flex items-center gap-2 text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Recording
                  </div>
                )}
              </div>

              {/* Participant avatars */}
              {room.participants?.length > 0 && (
                <div className="flex items-center mt-3 -space-x-1.5">
                  {room.participants.slice(0, 5).map((p, i) => (
                    <img
                      key={i}
                      src={p.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user?.username || i}`}
                      className="w-6 h-6 rounded-full border border-[#0d0d14]"
                      alt={p.user?.username}
                      title={p.user?.username}
                    />
                  ))}
                  {room.participants.length > 5 && (
                    <span className="text-[10px] text-white/30 pl-3">+{room.participants.length - 5}</span>
                  )}
                </div>
              )}
            </div>
          ))}
          {!rooms.length && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-white/20">
              <Video className="w-8 h-8 mb-2" />
              <p className="text-sm">No rooms found</p>
            </div>
          )}
        </div>
      )}

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