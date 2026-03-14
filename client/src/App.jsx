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
import { MinimizedCallProvider } from './context/MinimizedCallContext';
import FloatingCallWindow from './components/VideoCall/FloatingCallWindow';
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
import PrivacyPolicy from './components/Common/PrivacyPolicy';

// ─── SoundEngine ──────────────────────────────────────────────────────────────
import { SoundEngine }       from './utils/SoundEngine';
import { readSoundSettings } from './hooks/useSoundSettings';

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
import AdminSupportInbox   from './components/Admin/AdminSupportInbox';

// ─── Admin Guard ─────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)                                        return <Navigate to="/login"     replace />;
  if (!['admin', 'superadmin'].includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// ─── Global Message Sound ─────────────────────────────────────────────────────
// Plays notification sound for incoming DMs from anywhere in the app.
// ChatWindow suppresses the sound while that conversation is open — this
// component handles every other case (other tabs, background, etc.)
function GlobalMessageSound() {
  const { socket }   = useSocket();
  const { user }     = useAuth();
  // Track which conversation is currently open so we don't double-play
  const activeConvRef = useRef(null);

  // ChatWindow signals the active conversation via a custom event
  useEffect(() => {
    const onOpen  = (e) => { activeConvRef.current = e.detail?.conversationId ?? null; };
    const onClose = ()  => { activeConvRef.current = null; };
    window.addEventListener('chat-window-opened', onOpen);
    window.addEventListener('chat-window-closed', onClose);
    return () => {
      window.removeEventListener('chat-window-opened', onOpen);
      window.removeEventListener('chat-window-closed', onClose);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMsg = (message) => {
      const senderId = message?.sender?._id ?? message?.sender;
      const isFromOther = senderId && String(senderId) !== String(user?._id);
      if (!isFromOther) return;

      // Skip if the receiver currently has this conversation open
      if (activeConvRef.current && activeConvRef.current === message?.conversationId) return;

      const s = readSoundSettings();
      SoundEngine.playMessageTone(s.messages.tone, s.messages.volume);
      SoundEngine.vibrate([100]);
    };

    socket.on('new-direct-message', handleNewMsg);
    return () => socket.off('new-direct-message', handleNewMsg);
  }, [socket, user]);

  return null;
}

// ─── Global Broadcast ────────────────────────────────────────────────────────
function GlobalBroadcast() {
  const { socket } = useSocket();
  const [popup,   setPopup]   = useState(null);
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
    danger: {
      overlay: 'from-red-950/80 to-black/80',
      card:    'bg-gradient-to-br from-red-900 to-red-950',
      border:  'border-red-400/30',
      glow:    'shadow-red-500/20',
      bar:     'from-red-400 to-red-600',
      badge:   'bg-red-500/30 text-red-300 border-red-400/30',
      btn:     'from-red-500 to-red-700 hover:from-red-400 hover:to-red-600',
      text:    'text-red-100',
      sub:     'text-red-300/70',
      icon:    '🚨',
      label:   'URGENT ALERT',
    },
    warning: {
      overlay: 'from-yellow-950/80 to-black/80',
      card:    'bg-gradient-to-br from-yellow-900 to-amber-950',
      border:  'border-yellow-400/30',
      glow:    'shadow-yellow-500/20',
      bar:     'from-yellow-400 to-amber-600',
      badge:   'bg-yellow-500/30 text-yellow-300 border-yellow-400/30',
      btn:     'from-yellow-500 to-amber-700 hover:from-yellow-400 hover:to-amber-600',
      text:    'text-yellow-100',
      sub:     'text-yellow-300/70',
      icon:    '⚠️',
      label:   'WARNING',
    },
    success: {
      overlay: 'from-emerald-950/80 to-black/80',
      card:    'bg-gradient-to-br from-emerald-900 to-emerald-950',
      border:  'border-emerald-400/30',
      glow:    'shadow-emerald-500/20',
      bar:     'from-emerald-400 to-emerald-600',
      badge:   'bg-emerald-500/30 text-emerald-300 border-emerald-400/30',
      btn:     'from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600',
      text:    'text-emerald-100',
      sub:     'text-emerald-300/70',
      icon:    '✅',
      label:   'ANNOUNCEMENT',
    },
    info: {
      overlay: 'from-violet-950/80 to-black/80',
      card:    'bg-gradient-to-br from-violet-900 to-indigo-950',
      border:  'border-violet-400/30',
      glow:    'shadow-violet-500/20',
      bar:     'from-violet-400 to-indigo-600',
      badge:   'bg-violet-500/30 text-violet-300 border-violet-400/30',
      btn:     'from-violet-500 to-indigo-700 hover:from-violet-400 hover:to-indigo-600',
      text:    'text-violet-100',
      sub:     'text-violet-300/70',
      icon:    '📢',
      label:   'SYSTEM NOTICE',
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
        <div className={`h-1.5 w-full bg-gradient-to-r ${s.bar}`} />
        <div className="relative p-6">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            ✕
          </button>
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
          <div className="h-px bg-white/10 mb-4" />
          <p className={`text-sm ${s.text} leading-relaxed mb-5`}>{popup.message}</p>
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
          <p className={`text-[10px] ${s.sub} mt-3 text-center`}>
            {popup.sentAt ? new Date(popup.sentAt).toLocaleString() : new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Global Incoming Call ─────────────────────────────────────────────────────
function GlobalIncomingCall() {
  const { socket, emit } = useSocket();
  const { user }         = useAuth();
  const navigate         = useNavigate();

  const [incomingCall, setIncomingCall] = useState(null);
  const [countdown,    setCountdown]    = useState(30);

  const timerRef    = useRef(null);   // auto-dismiss timeout
  const intervalRef = useRef(null);   // countdown tick

  const clearTimers = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('incoming-call', (data) => {
      clearTimers();
      setIncomingCall(data);
      setCountdown(30);

      // Tick down every second
      intervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(intervalRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);

      // Auto-dismiss after 30 s
      timerRef.current = setTimeout(() => {
        clearInterval(intervalRef.current);
        // ── Stop ringtone + vibration on timeout ──
        SoundEngine.stopVideoCallTone();
        setIncomingCall(null);
      }, 30000);
    });

    socket.on('call-cancelled', ({ callerId }) => {
      clearTimers();
      // ── Stop ringtone + vibration when caller cancels ──
      SoundEngine.stopVideoCallTone();
      setIncomingCall(prev => prev?.callerId === callerId ? null : prev);
      toast('Caller cancelled the call', { icon: '📵', duration: 3000 });
    });

    return () => {
      clearTimers();
      socket.off('incoming-call');
      socket.off('call-cancelled');
    };
  }, [socket, clearTimers]);

  if (!incomingCall) return null;

  const handleAccept = () => {
    clearTimers();
    // ── Stop ringtone + vibration on accept ──
    SoundEngine.stopVideoCallTone();
    emit('accept-call', {
      callerId: incomingCall.callerId,
      roomId:   incomingCall.roomId,
      userId:   user._id,
    });
    setIncomingCall(null);
    navigate(`/room/${incomingCall.roomId}`);
  };

  const handleReject = () => {
    clearTimers();
    // ── Stop ringtone + vibration on reject ──
    SoundEngine.stopVideoCallTone();
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
      countdown={countdown}
    />
  );
}

// ─── Global Outgoing Call ─────────────────────────────────────────────────────
function GlobalOutgoingCall() {
  const { socket, emit } = useSocket();
  const { user }         = useAuth();
  const navigate         = useNavigate();

  const [outgoingCall, setOutgoingCall] = useState(null);
  const [countdown,    setCountdown]    = useState(30);

  const timerRef        = useRef(null);
  const intervalRef     = useRef(null);
  const outgoingCallRef = useRef(null);

  useEffect(() => { outgoingCallRef.current = outgoingCall; }, [outgoingCall]);

  const clearTimers = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
  }, []);

  const handleCancel = useCallback((callOverride) => {
    const call = callOverride || outgoingCallRef.current;
    if (!call) return;
    clearTimers();
    // ── Stop ringtone + vibration when caller cancels ──
    SoundEngine.stopVideoCallTone();
    emit('cancel-call', { receiverId: call.receiverId, callerId: user?._id });
    setOutgoingCall(null);
    outgoingCallRef.current = null;
    sessionStorage.removeItem('vmeet_calling');
    window.dispatchEvent(new CustomEvent('outgoing-call-cancelled'));
  }, [emit, user?._id, clearTimers]);

  useEffect(() => {
    if (!socket) return;

    socket.on('call-accepted', ({ roomId }) => {
      clearTimers();
      // ── Stop ringtone + vibration when call is accepted ──
      SoundEngine.stopVideoCallTone();
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
      navigate(`/room/${roomId}`);
    });

    socket.on('call-rejected', () => {
      clearTimers();
      // ── Stop ringtone + vibration when call is rejected ──
      SoundEngine.stopVideoCallTone();
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
      toast.error('Call was declined', { icon: '📵' });
    });

    socket.on('call-failed', ({ message }) => {
      clearTimers();
      // ── Stop ringtone + vibration on failure ──
      SoundEngine.stopVideoCallTone();
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
      toast.error(message);
    });

    socket.on('call-cancelled', () => {
      clearTimers();
      // ── Stop ringtone + vibration when cancelled ──
      SoundEngine.stopVideoCallTone();
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      sessionStorage.removeItem('vmeet_calling');
    });

    const onStart = (e) => {
      const data = e.detail;
      clearTimers();
      setOutgoingCall(data);
      outgoingCallRef.current = data;
      setCountdown(30);

      // Tick down every second
      intervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(intervalRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);

      // Auto-cancel after 30 s
      timerRef.current = setTimeout(() => {
        toast('No answer', { icon: '⏱️', duration: 3000 });
        handleCancel(data);
      }, 30000);
    };

    window.addEventListener('outgoing-call-started', onStart);

    return () => {
      clearTimers();
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-failed');
      socket.off('call-cancelled');
      window.removeEventListener('outgoing-call-started', onStart);
    };
  }, [socket, navigate, handleCancel, clearTimers]);

  if (!outgoingCall) return null;

  return (
    <OutgoingCall
      receiver={{ username: outgoingCall.receiverName, avatar: outgoingCall.receiverAvatar }}
      onCancel={() => handleCancel()}
      countdown={countdown}
    />
  );
}

// ─── Global Video Invite ──────────────────────────────────────────────────────
function GlobalVideoInvite() {
  const { socket, emit } = useSocket();
  const { user }         = useAuth();
  const navigate         = useNavigate();
  const activeInvites    = useRef(new Map()); // roomId → intervalId

  useEffect(() => {
    if (!socket) return;

    socket.on('incoming-video-invite', ({ roomId, inviterId, inviterName, inviterAvatar }) => {
      let countdown = 30;
      const toastId = `invite-${roomId}`;

      if (activeInvites.current.has(roomId)) {
        clearInterval(activeInvites.current.get(roomId));
        activeInvites.current.delete(roomId);
      }

      const renderToast = (t, seconds) => (
        <div style={{
          background:    'linear-gradient(135deg, #0f1923 0%, #0d1520 100%)',
          border:        '1px solid rgba(255,255,255,0.08)',
          borderRadius:  '20px',
          padding:       '0',
          width:         '300px',
          overflow:      'hidden',
          boxShadow:     '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          opacity:       t.visible ? 1 : 0,
          transform:     t.visible ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.95)',
          transition:    'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #22c55e, #16a34a, #10b981)', borderRadius: '20px 20px 0 0' }} />
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  position: 'absolute', inset: '-4px', borderRadius: '50%',
                  background: 'conic-gradient(#22c55e ' + (seconds / 30 * 360) + 'deg, rgba(255,255,255,0.08) 0deg)',
                  transition: 'background 1s linear',
                }} />
                <div style={{ position: 'absolute', inset: '-1px', borderRadius: '50%', background: '#0f1923' }} />
                <img
                  src={inviterAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inviterName}`}
                  alt={inviterName}
                  style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', position: 'relative', zIndex: 1, display: 'block' }}
                  onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${inviterName}`; }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inviterName}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                  📹 Invites you to a video call
                </p>
              </div>
              <div style={{
                flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                background: seconds <= 10 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${seconds <= 10 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                color: seconds <= 10 ? '#f87171' : 'rgba(255,255,255,0.4)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {seconds}
              </div>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  clearInterval(activeInvites.current.get(roomId));
                  activeInvites.current.delete(roomId);
                  toast.dismiss(toastId);
                  emit('video-invite-accepted', { roomId, inviterId, acceptorId: user._id, acceptorName: user.username });
                  navigate(`/room/${roomId}`);
                }}
                style={{ flex: 1, padding: '9px 0', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.35)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
              >
                Join Now
              </button>
              <button
                onClick={() => {
                  clearInterval(activeInvites.current.get(roomId));
                  activeInvites.current.delete(roomId);
                  toast.dismiss(toastId);
                  emit('video-invite-rejected', { inviterId, rejectorName: user.username, inviteeId: user._id });
                }}
                style={{ flex: 1, padding: '9px 0', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.target.style.background = 'rgba(239,68,68,0.2)'; }}
                onMouseLeave={e => { e.target.style.background = 'rgba(239,68,68,0.1)'; }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      );

      toast((t) => renderToast(t, countdown), {
        duration: 30000, id: toastId,
        style: { background: 'transparent', boxShadow: 'none', padding: 0, maxWidth: '320px' },
      });

      const intervalId = setInterval(() => {
        countdown -= 1;
        if (countdown <= 0) {
          clearInterval(intervalId);
          activeInvites.current.delete(roomId);
          toast.dismiss(toastId);
          return;
        }
        toast((t) => renderToast(t, countdown), {
          duration: (countdown * 1000) + 500, id: toastId,
          style: { background: 'transparent', boxShadow: 'none', padding: 0, maxWidth: '320px' },
        });
      }, 1000);

      activeInvites.current.set(roomId, intervalId);
    });

    socket.on('invite-cancelled', ({ roomId: cancelledRoomId }) => {
      if (activeInvites.current.has(cancelledRoomId)) {
        clearInterval(activeInvites.current.get(cancelledRoomId));
        activeInvites.current.delete(cancelledRoomId);
      }
      toast.dismiss(`invite-${cancelledRoomId}`);
      toast('Invite was cancelled', { icon: '❌', duration: 3000 });
    });

    socket.on('invite-accepted', ({ acceptorName }) => {
      toast.success(`${acceptorName} joined the call!`);
    });
    socket.on('invite-rejected', ({ rejectorName }) => {
      toast(`${rejectorName} declined the invite`, { icon: '❌' });
    });
    socket.on('invite-failed', ({ message }) => {
      toast.error(message ?? 'Could not send invite');
    });

    return () => {
      activeInvites.current.forEach(id => clearInterval(id));
      activeInvites.current.clear();
      socket.off('incoming-video-invite');
      socket.off('invite-cancelled');
      socket.off('invite-accepted');
      socket.off('invite-rejected');
      socket.off('invite-failed');
    };
  }, [socket, emit, navigate, user]);

  return null;
}

// ─── Join Redirect ────────────────────────────────────────────────────────────
const JoinRedirect = () => {
  const { meetingCode } = useParams();
  return <Navigate to={`/room/${meetingCode}`} replace />;
};

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <WebRTCProvider>
          <AudioCallProvider>
            <MinimizedCallProvider>
              <Router>
                <Routes>
                  {/* ─── Public ─────────────────────────────────────────── */}
                  <Route path="/login"    element={<Login />} />
                  <Route path="/register" element={<Register />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />  {/* ← ADD THIS */}

                  {/* ─── App ────────────────────────────────────────────── */}
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

                  {/* ─── Admin Panel ────────────────────────────────────── */}
                  <Route path="/super-admin-dashboard" element={
                    <AdminRoute><AdminLayout /></AdminRoute>
                  }>
                    <Route index              element={<AdminDashboard />} />
                    <Route path="users"       element={<UsersManagement />} />
                    <Route path="messages"    element={<ChatMonitoring />} />
                    <Route path="calls"       element={<CallsMonitoring />} />
                    <Route path="rooms"       element={<RoomsManagement />} />
                    <Route path="reports"     element={<ReportsModeration />} />
                    <Route path="analytics"   element={<AnalyticsDashboard />} />
                    <Route path="health"      element={<SystemHealth />} />
                    <Route path="logs"        element={<AdminLogs />} />
                    <Route path="support"     element={<AdminSupportInbox />} />
                  </Route>

                  {/* ─── Fallback ────────────────────────────────────────── */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>

                <GlobalIncomingCall />
                <GlobalOutgoingCall />
                <GlobalBroadcast />
                <GlobalVideoInvite />
                <GlobalMessageSound />
                <IncomingAudioCall />
                <AudioCallUI />
                <FloatingCallWindow />
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
            </MinimizedCallProvider>
          </AudioCallProvider>
        </WebRTCProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;