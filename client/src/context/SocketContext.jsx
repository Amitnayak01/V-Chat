import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import IncomingCall from '../components/Dashboard/IncomingCall';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};

const SOCKET_URL  = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const SESSION_KEY = 'vmeet_current_room';

// ─── Room session helpers (survive page refresh, cleared on tab close) ────────

export const saveRoomSession = (roomId, userId, username, avatar) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, userId, username, avatar }));
  } catch (_) {}
};

export const loadRoomSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
};

export const clearRoomSession = () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const SocketProvider = ({ children }) => {
  const [socket,       setSocket]       = useState(null);
  const [connected,    setConnected]    = useState(false);
  const [onlineUsers,  setOnlineUsers]  = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);

  const { user, isAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const newSocket = io(SOCKET_URL, {
      transports:           ['websocket', 'polling'],
      reconnection:         true,
      reconnectionAttempts: Infinity,
      reconnectionDelay:    500,
      reconnectionDelayMax: 3000,
    });

    socketRef.current = newSocket;

    // ── connect (fires on first connect AND after each reconnect) ──────────
    newSocket.on('connect', () => {
      console.log('✅ Socket connected', newSocket.id);
      setConnected(true);

      // setSocket FIRST so React re-renders and VideoRoom Effect 3
      // re-registers all handlers before the server responds.
      setSocket(newSocket);

      // Delay user-online by one frame so React has committed the
      // re-render and socket handlers are registered before the server
      // fires user-reconnected / room-rejoin-ack back at us.
      requestAnimationFrame(() => {
        newSocket.emit('user-online', user._id);
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connect_error:', err.message);
      setConnected(false);
    });

    // Keep-alive ping — prevents Render free tier from dropping idle sockets
    const keepAlive = setInterval(() => {
      if (newSocket.connected) newSocket.emit('ping');
    }, 20000);

    // ── online-users-list ──────────────────────────────────────────────────
    newSocket.on('online-users-list', ({ users }) => {
      setOnlineUsers(users.filter(id => id !== user._id));
    });

    // ── Global incoming call — lives here so it works on ANY page ──────────
    newSocket.on('incoming-call', (data) => {
      setIncomingCall(data);
    });

    newSocket.on('call-cancelled', ({ callerId }) => {
      setIncomingCall(prev => prev?.callerId === callerId ? null : prev);
    });

    // ── individual status changes ──────────────────────────────────────────
    newSocket.on('user-status-change', ({ userId, status }) => {
      if (userId === user._id) return;
      setOnlineUsers(prev =>
        status === 'online'
          ? prev.includes(userId) ? prev : [...prev, userId]
          : prev.filter(id => id !== userId)
      );
    });

    return () => {
      clearInterval(keepAlive);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user]);

  // ── stable helpers ─────────────────────────────────────────────────────────

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, cb) => {
    if (socketRef.current) socketRef.current.on(event, cb);
  }, []);

  const off = useCallback((event, cb) => {
    if (socketRef.current) socketRef.current.off(event, cb);
  }, []);

  // ── room session wrappers ──────────────────────────────────────────────────

  const setCurrentRoom = useCallback((roomId, username, avatar) => {
    if (user) saveRoomSession(roomId, user._id, username, avatar);
  }, [user]);

  const clearCurrentRoom = useCallback(() => {
    clearRoomSession();
  }, []);

  // ── Global incoming call accept / reject ───────────────────────────────────

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall || !user) return;
    emit('accept-call', {
      callerId: incomingCall.callerId,
      roomId:   incomingCall.roomId,
      userId:   user._id,
    });
    navigate(`/room/${incomingCall.roomId}`, {
      replace: true,
      state:   { returnTo: window.location.pathname },
    });
    setIncomingCall(null);
  }, [incomingCall, emit, navigate, user]);

  const handleRejectCall = useCallback(() => {
    if (!incomingCall || !user) return;
    emit('reject-call', { callerId: incomingCall.callerId, userId: user._id });
    setIncomingCall(null);
  }, [incomingCall, emit, user]);

  return (
    <>
      {incomingCall && (
        <IncomingCall
          caller={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
      <SocketContext.Provider value={{
        socket,
        connected,
        onlineUsers,
        emit,
        on,
        off,
        setCurrentRoom,
        clearCurrentRoom,
        incomingCall,
        setIncomingCall,
      }}>
        {children}
      </SocketContext.Provider>
    </>
  );
};