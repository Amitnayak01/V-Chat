// client/src/components/Admin/AdminLayout.jsx
import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import AdminSidebar from './AdminSidebar';
import AdminNavbar from './AdminNavbar';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [broadcast, setBroadcast] = useState(null);

  // Guard: only admin/superadmin
  useEffect(() => {
    if (user && !['admin', 'superadmin'].includes(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Listen for admin socket events and surface them as toasts
  useEffect(() => {
    if (!socket) return;

    socket.on('admin:broadcast', (data) => {
      setBroadcast(data);
      const icons = { info: 'ℹ️', warning: '⚠️', danger: '🚨', success: '✅' };
      toast(data.message, { icon: icons[data.type] || 'ℹ️', duration: 6000 });
    });

    socket.on('admin:new-report', () => {
      toast('📋 New user report submitted', { duration: 4000 });
    });

    return () => {
      socket.off('admin:broadcast');
      socket.off('admin:new-report');
    };
  }, [socket]);

  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-0' : 'ml-0'}`}>
        <AdminNavbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

        <main className="flex-1 overflow-y-auto p-6 bg-[#0a0a0f]">
          <Outlet />
        </main>
      </div>

      {/* Broadcast banner */}
      {broadcast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-3 border
            ${broadcast.type === 'danger'  ? 'bg-red-950 border-red-500 text-red-200' :
              broadcast.type === 'warning' ? 'bg-yellow-950 border-yellow-500 text-yellow-200' :
              broadcast.type === 'success' ? 'bg-green-950 border-green-500 text-green-200' :
                                             'bg-blue-950 border-blue-500 text-blue-200'}`}
        >
          <span>📢 {broadcast.title}: {broadcast.message}</span>
          <button onClick={() => setBroadcast(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
    </div>
  );
}