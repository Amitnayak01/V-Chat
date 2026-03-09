// client/src/components/Admin/UsersManagement.jsx
import { useState, useEffect, useCallback } from 'react';
import { Search, UserX, UserCheck, Trash2, Shield, ShieldOff, VolumeX, Volume2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import adminAPI from '../../utils/adminApi';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const ROLE_COLORS = { user: 'text-white/40', admin: 'text-violet-400', superadmin: 'text-fuchsia-400' };
const STATUS_COLORS = { online: 'bg-emerald-500', offline: 'bg-white/20', away: 'bg-yellow-500', busy: 'bg-red-500' };

export default function UsersManagement() {
  const { user: adminUser } = useAuth();
  const [users, setUsers]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const [confirmModal, setConfirmModal] = useState(null);
  // { type: 'ban'|'delete'|'promote'|'mute', user: {...}, extra: {} }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers({ page, limit: 15, search, role: roleFilter, status: statusFilter });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  // Debounce search
  useEffect(() => { const t = setTimeout(fetchUsers, 400); return () => clearTimeout(t); }, [search]); // eslint-disable-line

  const handleAction = async () => {
    if (!confirmModal) return;
    const { type, user: target, extra } = confirmModal;
    setActionLoading(target._id);
    try {
      if (type === 'ban') {
        await adminAPI.banUser(target._id, extra?.reason || 'Violation');
        toast.success(`User ${target.isBanned ? 'unbanned' : 'banned'}`);
      } else if (type === 'delete') {
        await adminAPI.deleteUser(target._id);
        toast.success('User deleted');
      } else if (type === 'promote') {
        await adminAPI.promoteUser(target._id, extra.role);
        toast.success(`Role set to ${extra.role}`);
      } else if (type === 'mute') {
        await adminAPI.muteUser(target._id, extra?.minutes || 60);
        toast.success(`User ${target.isMuted ? 'unmuted' : 'muted'}`);
      }
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users Management</h1>
          <p className="text-sm text-white/30 mt-0.5">{total.toLocaleString()} total users</p>
        </div>
        <button onClick={fetchUsers} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 flex items-center gap-2 bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search username or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-white placeholder-white/30 focus:outline-none w-full"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none"
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-white/30 font-medium px-4 py-3 uppercase tracking-wider">User</th>
                  <th className="text-left text-xs text-white/30 font-medium px-4 py-3 uppercase tracking-wider">Role</th>
                  <th className="text-left text-xs text-white/30 font-medium px-4 py-3 uppercase tracking-wider">Status</th>
                  <th className="text-left text-xs text-white/30 font-medium px-4 py-3 uppercase tracking-wider">Joined</th>
                  <th className="text-right text-xs text-white/30 font-medium px-4 py-3 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <img
                            src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                            className="w-8 h-8 rounded-full"
                            alt={u.username}
                          />
                          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#0d0d14] ${STATUS_COLORS[u.status] || 'bg-white/20'}`} />
                        </div>
                        <div>
                          <p className="text-white/80 font-medium">{u.username}</p>
                          <p className="text-white/30 text-xs">{u.email || '—'}</p>
                        </div>
                        {u.isBanned && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">Banned</span>}
                        {u.isMuted  && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">Muted</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs capitalize ${u.isBanned ? 'text-red-400' : 'text-white/40'}`}>
                        {u.isBanned ? 'banned' : u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/30">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Can't act on yourself or superadmin */}
                        {u._id !== adminUser?._id && u.role !== 'superadmin' && (
                          <>
                            {/* Ban/Unban */}
                            <button
                              onClick={() => setConfirmModal({ type: 'ban', user: u, extra: {} })}
                              disabled={actionLoading === u._id}
                              className={`p-1.5 rounded-lg transition-all ${u.isBanned ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-red-400 hover:bg-red-500/10'}`}
                              title={u.isBanned ? 'Unban' : 'Ban'}
                            >
                              {u.isBanned ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>

                            {/* Mute/Unmute */}
                            <button
                              onClick={() => setConfirmModal({ type: 'mute', user: u, extra: { minutes: 60 } })}
                              disabled={actionLoading === u._id}
                              className={`p-1.5 rounded-lg transition-all ${u.isMuted ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-orange-400 hover:bg-orange-500/10'}`}
                              title={u.isMuted ? 'Unmute' : 'Mute 1h'}
                            >
                              {u.isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                            </button>

                            {/* Promote (superadmin only) */}
                            {adminUser?.role === 'superadmin' && u.role !== 'admin' && (
                              <button
                                onClick={() => setConfirmModal({ type: 'promote', user: u, extra: { role: 'admin' } })}
                                className="p-1.5 rounded-lg text-violet-400 hover:bg-violet-500/10 transition-all"
                                title="Promote to Admin"
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {adminUser?.role === 'superadmin' && u.role === 'admin' && (
                              <button
                                onClick={() => setConfirmModal({ type: 'promote', user: u, extra: { role: 'user' } })}
                                className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 transition-all"
                                title="Demote to User"
                              >
                                <ShieldOff className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => setConfirmModal({ type: 'delete', user: u, extra: {} })}
                              disabled={actionLoading === u._id}
                              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {u._id === adminUser?._id && <span className="text-xs text-white/20">You</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-white/20 py-12 text-sm">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#13131e] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 capitalize">
              {confirmModal.type === 'ban' && (confirmModal.user.isBanned ? 'Unban' : 'Ban')} 
              {confirmModal.type === 'delete' && 'Delete'} 
              {confirmModal.type === 'promote' && `Set role to ${confirmModal.extra?.role}`}
              {confirmModal.type === 'mute' && (confirmModal.user.isMuted ? 'Unmute' : 'Mute')} User
            </h3>
            <p className="text-sm text-white/50 mb-5">
              Are you sure you want to {confirmModal.type} <strong className="text-white/80">{confirmModal.user.username}</strong>?
              {confirmModal.type === 'delete' && ' This cannot be undone.'}
            </p>

            {/* Ban reason input */}
            {confirmModal.type === 'ban' && !confirmModal.user.isBanned && (
              <input
                type="text"
                placeholder="Ban reason (optional)"
                className="w-full mb-4 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
                onChange={e => setConfirmModal(p => ({ ...p, extra: { reason: e.target.value } }))}
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-all
                  ${confirmModal.type === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-violet-600 hover:bg-violet-500'}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}