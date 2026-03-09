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

// ─── Admin Guard ─────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)                                       return <Navigate to="/login" replace />;
  if (!['admin', 'superadmin'].includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
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
                </Route>

                {/* ─── Fallback ─────────────────────────────────────────── */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>

              <GlobalIncomingCall />
              <GlobalOutgoingCall />
              <IncomingAudioCall />
              <AudioCallUI />

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
            </Router>
          </AudioCallProvider>
        </WebRTCProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;