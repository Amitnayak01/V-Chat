// client/src/components/Admin/AdminSidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, MessageSquare, Phone,
  Video, Flag, BarChart3, Activity, ScrollText,
 ChevronLeft, Shield, LogOut, Zap, Headphones, X,} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/super-admin-dashboard',           icon: LayoutDashboard, label: 'Dashboard',       exact: true },
  { to: '/super-admin-dashboard/users',     icon: Users,           label: 'Users' },
  { to: '/super-admin-dashboard/messages',  icon: MessageSquare,   label: 'Chat Monitor' },
  { to: '/super-admin-dashboard/calls',     icon: Phone,           label: 'Calls' },
  { to: '/super-admin-dashboard/rooms',     icon: Video,           label: 'Rooms' },
  { to: '/super-admin-dashboard/reports',   icon: Flag,            label: 'Reports' },
  { to: '/super-admin-dashboard/analytics', icon: BarChart3,       label: 'Analytics' },
  { to: '/super-admin-dashboard/health',    icon: Activity,        label: 'System Health' },
 { to: '/super-admin-dashboard/logs',      icon: ScrollText,  label: 'Admin Logs' },
  { to: '/super-admin-dashboard/support',   icon: Headphones,  label: 'Support' },
];

export default function AdminSidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Overlay on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:relative z-40 h-full flex flex-col
          bg-[#0d0d14] border-r border-white/5
          transition-all duration-300 ease-in-out
          ${open ? 'w-64 translate-x-0' : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'}
          overflow-hidden
        `}
      >
        {/* Logo */}
       <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {open && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white tracking-wide truncate">V-Meet Admin</p>
                <p className="text-[10px] text-violet-400 uppercase tracking-widest">{user?.role}</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all flex-shrink-0"
                title="Close sidebar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all duration-150 group
                 ${isActive
                   ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                   : 'text-white/50 hover:text-white hover:bg-white/5'
                 }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {open && <span className="font-medium truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: quick link back + logout */}
        <div className="border-t border-white/5 p-3 space-y-1">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <Zap className="w-4 h-4 flex-shrink-0" />
            {open && <span>Back to App</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {open && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}