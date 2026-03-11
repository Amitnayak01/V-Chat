// REMOVE these duplicate/scattered imports at the top and replace with this clean block:
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

import { AuthProvider }      from './context/AuthContext';
import { SocketProvider }    from './context/SocketContext';
import { WebRTCProvider }    from './context/WebRTCContext';
import { AudioCallProvider } from './context/AudioCallContext';
import { useAuth }           from './context/AuthContext';
import { useSocket }         from './context/SocketContext';

import ProtectedRoute    from './components/Common/ProtectedRoute';
import Login             from './components/Auth/Login';
import Register          from './components/Auth/Register';
import Dashboard         from './components/Dashboard/Dashboard';
import VideoRoom         from './components/VideoCall/VideoRoom';
import UserProfilePage   from './components/Dashboard/UserProfilePage';
import IncomingAudioCall from './components/AudioCall/IncomingAudioCall';
import AudioCallUI       from './components/AudioCall/AudioCallUI';
import IncomingCall      from './components/Dashboard/IncomingCall';
import OutgoingCall      from './components/Dashboard/OutgoingCall';

// ─── Admin imports ────────────────────────────────────────────────────────────
import AdminLayout         from './components/Admin/AdminLayout';
import AdminDashboard      from './components/Admin/AdminDashboard';
import UsersManagement     from './components/Admin/UsersManagement';
import ChatMonitoring      from './components/Admin/ChatMonitoring';
import CallsMonitoring     from './components/Admin/CallsMonitoring';
import RoomsManagement     from './components/Admin/RoomsManagement';
import ReportsModeration   from './components/Admin/ReportsModeration';
import AnalyticsDashboard  from './components/Admin/AnalyticsDashboard';
import SystemHealth        from './components/Admin/SystemHealth';
import AdminLogs           from './components/Admin/AdminLogs';
import AdminSupportInbox from './components/Admin/AdminSupportInbox';
import { PiPProvider } from './context/PiPContext';
import FloatingPiP    from './components/VideoCall/FloatingPiP';

// ─── Admin Guard ─────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)                                       return <Navigate to="/login" replace />;
  if (!['admin', 'superadmin'].includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function GlobalBroadcast() {
  const { socket } = useSocket();
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.on('admin:broadcast', (data) => {
      setPopup(data);
      setTimeout(() => setVisible(true), 10);
    });
    return () => socket.off('admin:broadcast');
  }, [socket]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setPopup(null), 300);
  };

  if (!popup) return null;

  const styles = {
    danger:  {
      overlay: 'from-red-950/80 to-black/80',
      card: 'bg-gradient-to-br from-red-900 to-red-950',
      border: 'border-red-400/30',
      glow: 'shadow-red-500/20',
      bar: 'from-red-400 to-red-600',
      badge: 'bg-red-500/30 text-red-300 border-red-400/30',
      btn: 'from-red-500 to-red-700 hover:from-red-400 hover:to-red-600',
      text: 'text-red-100',
      sub: 'text-red-300/70',
      icon: '🚨',
      label: 'URGENT ALERT',
    },
    warning: {
      overlay: 'from-yellow-950/80 to-black/80',
      card: 'bg-gradient-to-br from-yellow-900 to-amber-950',
      border: 'border-yellow-400/30',
      glow: 'shadow-yellow-500/20',
      bar: 'from-yellow-400 to-amber-600',
      badge: 'bg-yellow-500/30 text-yellow-300 border-yellow-400/30',
      btn: 'from-yellow-500 to-amber-700 hover:from-yellow-400 hover:to-amber-600',
      text: 'text-yellow-100',
      sub: 'text-yellow-300/70',
      icon: '⚠️',
      label: 'WARNING',
    },
    success: {
      overlay: 'from-emerald-950/80 to-black/80',
      card: 'bg-gradient-to-br from-emerald-900 to-emerald-950',
      border: 'border-emerald-400/30',
      glow: 'shadow-emerald-500/20',
      bar: 'from-emerald-400 to-emerald-600',
      badge: 'bg-emerald-500/30 text-emerald-300 border-emerald-400/30',
      btn: 'from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600',
      text: 'text-emerald-100',
      sub: 'text-emerald-300/70',
      icon: '✅',
      label: 'ANNOUNCEMENT',
    },
    info: {
      overlay: 'from-violet-950/80 to-black/80',
      card: 'bg-gradient-to-br from-violet-900 to-indigo-950',
      border: 'border-violet-400/30',
      glow: 'shadow-violet-500/20',
      bar: 'from-violet-400 to-indigo-600',
      badge: 'bg-violet-500/30 text-violet-300 border-violet-400/30',
      btn: 'from-violet-500 to-indigo-700 hover:from-violet-400 hover:to-indigo-600',
      text: 'text-violet-100',
      sub: 'text-violet-300/70',
      icon: '📢',
      label: 'SYSTEM NOTICE',
    },
  };

  const s = styles[popup.type] || styles.info;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4
        bg-gradient-to-br ${s.overlay} backdrop-blur-md
        transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`${s.card} border ${s.border} rounded-3xl w-full max-w-md
          shadow-2xl ${s.glow} overflow-hidden
          transition-all duration-300 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        {/* Gradient top bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${s.bar}`} />

        {/* Noise texture overlay */}
        <div className="relative p-6">

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            ✕
          </button>

          {/* Icon + badge */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shadow-inner flex-shrink-0">
              {s.icon}
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${s.badge}`}>
                {s.label}
              </span>
              {popup.title && (
                <p className="text-lg font-black text-white mt-1.5 leading-tight">
                  {popup.title}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 mb-4" />

          {/* Message */}
          <p className={`text-sm ${s.text} leading-relaxed mb-5`}>
            {popup.message}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                {popup.sentBy?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] text-white/30">Broadcast by</p>
                <p className="text-xs font-semibold text-white/70">{popup.sentBy}</p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${s.btn} shadow-lg transition-all active:scale-95`}
            >
              Got it
            </button>
          </div>

          {/* Timestamp */}
          <p className={`text-[10px] ${s.sub} mt-3 text-center`}>
            {popup.sentAt ? new Date(popup.sentAt).toLocaleString() : new Date().toLocaleString()}
          </p>

        </div>
      </div>
    </div>
  );
}
function GlobalIncomingCall() {
  const { socket, emit } = useSocket();
  const { user }         = useAuth();
  const navigate         = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('incoming-call', (data) => setIncomingCall(data));
    socket.on('call-cancelled', ({ callerId }) => {
      setIncomingCall(prev => prev?.callerId === callerId ? null : prev);
      toast('Caller cancelled the call', { icon: '📵', duration: 3000 });
    });
    return () => {
      socket.off('incoming-call');
      socket.off('call-cancelled');
    };
  }, [socket]);

  if (!incomingCall) return null;

  const handleAccept = () => {
    emit('accept-call', {
      callerId: incomingCall.callerId,
      roomId:   incomingCall.roomId,
      userId:   user._id,
    });
    setIncomingCall(null);
    navigate(`/room/${incomingCall.roomId}`);
  };

  const handleReject = () => {
    emit('reject-call', {
      callerId: incomingCall.callerId,
      userId:   user._id,
    });
    setIncomingCall(null);
  };

  return (
    <IncomingCall
      caller={incomingCall}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
}

function GlobalOutgoingCall() {
  const { socket, emit } = useSocket();
  const { user }         = useAuth();
  const navigate         = useNavigate();
  const [outgoingCall, setOutgoingCall] = useState(null);
  const timerRef        = useRef(null);
  const outgoingCallRef = useRef(null);

  useEffect(() => { outgoingCallRef.current = outgoingCall; }, [outgoingCall]);

  const handleCancel = useCallback((callOverride) => {
    const call = callOverride || outgoingCallRef.current;
    if (!call) return;
    clearTimeout(timerRef.current);
    emit('cancel-call', { receiverId: call.receiverId, callerId: user?._id });
    setOutgoingCall(null);
    outgoingCallRef.current = null;
    sessionStorage.removeItem('vmeet_calling');
    window.dispatchEvent(new CustomEvent('outgoing-call-cancelled'));
  }, [emit, user?._id]);

  useEffect(() => {
    if (!socket) return;

    socket.on('call-accepted', ({ roomId }) => {
      clearTimeout(timerRef.current);
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
      navigate(`/room/${roomId}`);
    });

    socket.on('call-rejected', () => {
      clearTimeout(timerRef.current);
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
      toast.error('Call was declined', { icon: '📵' });
    });

    socket.on('call-failed', ({ message }) => {
      clearTimeout(timerRef.current);
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
      toast.error(message);
    });

    socket.on('call-cancelled', () => {
      clearTimeout(timerRef.current);
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
    });

    const onStart = (e) => {
      const data = e.detail;
      setOutgoingCall(data);
      outgoingCallRef.current = data;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        toast('No answer', { icon: '⏱️', duration: 3000 });
        handleCancel(data);
      }, 30000);
    };

    window.addEventListener('outgoing-call-started', onStart);

    return () => {
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-failed');
      socket.off('call-cancelled');
      window.removeEventListener('outgoing-call-started', onStart);
    };
  }, [socket, navigate, handleCancel]);

  if (!outgoingCall) return null;

  return (
    <OutgoingCall
      receiver={{ username: outgoingCall.receiverName, avatar: outgoingCall.receiverAvatar }}
      onCancel={() => handleCancel()}
    />
  );
}

const JoinRedirect = () => {
  const { meetingCode } = useParams();
  return <Navigate to={`/room/${meetingCode}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <WebRTCProvider>
          <AudioCallProvider>
            <Router>
                <PiPProvider>          {/* ← ADD */}
              <Routes>
                {/* ─── Public ───────────────────────────────────────────── */}
                <Route path="/login"    element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* ─── App ──────────────────────────────────────────────── */}
                <Route path="/dashboard/*" element={
                  <ProtectedRoute><Dashboard /></ProtectedRoute>
                } />
                <Route path="/join/:meetingCode" element={
                  <ProtectedRoute><JoinRedirect /></ProtectedRoute>
                } />
                <Route path="/room/:roomId" element={
                  <ProtectedRoute><VideoRoom /></ProtectedRoute>
                } />
                <Route path="/user/:id" element={
                  <ProtectedRoute><UserProfilePage /></ProtectedRoute>
                } />

                {/* ─── Admin Panel ──────────────────────────────────────── */}
                <Route path="/super-admin-dashboard" element={
                  <AdminRoute><AdminLayout /></AdminRoute>
                }>
                  <Route index                element={<AdminDashboard />} />
                  <Route path="users"         element={<UsersManagement />} />
                  <Route path="messages"      element={<ChatMonitoring />} />
                  <Route path="calls"         element={<CallsMonitoring />} />
                  <Route path="rooms"         element={<RoomsManagement />} />
                  <Route path="reports"       element={<ReportsModeration />} />
                  <Route path="analytics"     element={<AnalyticsDashboard />} />
                  <Route path="health"        element={<SystemHealth />} />
                  <Route path="logs"          element={<AdminLogs />} />
                   <Route path="support"       element={<AdminSupportInbox />} /> 
                </Route>

                {/* ─── Fallback ─────────────────────────────────────────── */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>

              <GlobalIncomingCall />
              <GlobalOutgoingCall />
              <GlobalBroadcast />
              <IncomingAudioCall />
              <AudioCallUI />
                       <FloatingPiP />  
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background:   '#1e293b',
                    color:        '#fff',
                    borderRadius: '0.75rem',
                    padding:      '1rem',
                    fontSize:     '0.875rem',
                    fontWeight:   '500',
                  },
                  success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                  error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                }}
              />
              </PiPProvider> 
            </Router>
          </AudioCallProvider>
        </WebRTCProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;