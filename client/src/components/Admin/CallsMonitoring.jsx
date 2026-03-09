// client/src/components/Admin/CallsMonitoring.jsx
import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Video, Users, Clock, RefreshCw } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import adminAPI from '../../utils/adminApi';
import toast from 'react-hot-toast';

export default function CallsMonitoring() {
  const { socket } = useSocket();
  const [activeCalls, setActiveCalls] = useState([]);
  const [callEvents, setCallEvents]   = useState([]);  // live event log
  const [rooms, setRooms]             = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Load active rooms from DB
  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await adminAPI.getRooms({ active: 'true', limit: 50 });
      setRooms(res.data.rooms);
    } catch { toast.error('Failed to load active rooms'); }
    finally { setLoadingRooms(false); }
  };

  useEffect(() => { fetchRooms(); }, []);

  // Real-time call events from socket
  useEffect(() => {
    if (!socket) return;

    const addEvent = (type, data) => {
      setCallEvents(prev => [{ type, data, time: new Date() }, ...prev.slice(0, 49)]);
    };

    socket.on('call-user',   (d) => addEvent('outgoing', d));
    socket.on('call-accepted',(d) => addEvent('accepted', d));
    socket.on('call-rejected',(d) => addEvent('rejected', d));
    socket.on('user-joined', (d) => {
      if (d.roomId) addEvent('joined-room', d);
    });
    socket.on('user-left', (d) => {
      if (d.roomId) addEvent('left-room', d);
    });

    return () => {
      socket.off('call-user');
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('user-joined');
      socket.off('user-left');
    };
  }, [socket]);

  const handleTerminateRoom = async (roomId) => {
    if (!window.confirm(`Terminate room ${roomId}?`)) return;
    try {
      await adminAPI.deleteRoom(roomId);
      setRooms(prev => prev.filter(r => r.roomId !== roomId));
      toast.success('Room terminated');
    } catch {
      toast.error('Failed to terminate room');
    }
  };

  const EVENT_STYLES = {
    outgoing:    { color: 'text-blue-400',    icon: Phone,    label: 'Call initiated' },
    accepted:    { color: 'text-emerald-400', icon: Phone,    label: 'Call accepted' },
    rejected:    { color: 'text-red-400',     icon: PhoneOff, label: 'Call rejected' },
    'joined-room': { color: 'text-violet-400', icon: Video,   label: 'Joined room' },
    'left-room':   { color: 'text-white/30',   icon: Users,   label: 'Left room' },
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Calls Monitoring</h1>
          <p className="text-sm text-white/30 mt-0.5">{rooms.length} active rooms</p>
        </div>
        <button onClick={fetchRooms} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Rooms */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Active Rooms</h3>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          {loadingRooms ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/20">
              <Video className="w-8 h-8 mb-2" />
              <p className="text-sm">No active rooms</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {rooms.map(room => (
                <div key={room._id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <Video className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 font-mono truncate">{room.roomId}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-white/30 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {room.participants?.length || 0}
                      </span>
                      <span className="text-xs text-white/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {room.startedAt ? new Date(room.startedAt).toLocaleTimeString() : '—'}
                      </span>
                      {room.host && (
                        <span className="text-xs text-white/30 truncate">Host: {room.host.username}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTerminateRoom(room.roomId)}
                    className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                    title="Terminate room"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live event log */}
        <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Live Event Log</h3>
            <button onClick={() => setCallEvents([])} className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Clear
            </button>
          </div>
          <div className="divide-y divide-white/[0.03] max-h-96 overflow-y-auto">
            {callEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/20">
                <Phone className="w-8 h-8 mb-2" />
                <p className="text-sm">Waiting for call events…</p>
              </div>
            ) : callEvents.map((evt, i) => {
              const style = EVENT_STYLES[evt.type] || { color: 'text-white/40', icon: Phone, label: evt.type };
              const Icon  = style.icon;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${style.color}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${style.color}`}>{style.label}</span>
                    {evt.data?.username && <span className="text-xs text-white/30 ml-2">{evt.data.username}</span>}
                    {evt.data?.roomId   && <span className="text-xs text-white/20 ml-2 font-mono">{evt.data.roomId}</span>}
                  </div>
                  <span className="text-[10px] text-white/20 flex-shrink-0">
                    {evt.time.toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}