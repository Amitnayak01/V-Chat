import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, UserPlus, Clock, Check } from 'lucide-react';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

const InviteParticipantsModal = ({ isOpen, onClose, onInvite, currentParticipantIds = [] }) => {
  const [contacts,  setContacts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [invited,   setInvited]   = useState(new Set());
const { socket } = useSocket();

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/contacts');
      if (res.data.success) setContacts(res.data.contacts);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) { fetchContacts(); setInvited(new Set()); setSearch(''); }
  }, [isOpen, fetchContacts]);

useEffect(() => {
  if (!socket || !isOpen) return;

  // Reset "Sent" → "Invite" on reject
  const onRejected = ({ inviteeId }) => {
    if (inviteeId) {
      setInvited(prev => {
        const next = new Set(prev);
        next.delete(inviteeId);
        return next;
      });
    }
  };

  // Reset "Sent" → "Invite" on failure (user offline etc.)
  const onFailed = ({ inviteeId }) => {
    if (inviteeId) {
      setInvited(prev => {
        const next = new Set(prev);
        next.delete(inviteeId);
        return next;
      });
    }
  };

  socket.on('invite-rejected', onRejected);
  socket.on('invite-failed',   onFailed);

  return () => {
    socket.off('invite-rejected', onRejected);
    socket.off('invite-failed',   onFailed);
  };
}, [socket, isOpen]);

  const filtered = contacts.filter(c =>
    c.username?.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = (contact) => {
    if (invited.has(contact._id)) return;
    onInvite(contact);
    setInvited(prev => new Set([...prev, contact._id]));
  };

  const isInCall = (id) => currentParticipantIds.includes(id?.toString());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.92, y: 16  }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: 'linear-gradient(160deg,#0d1b33,#081020)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base leading-tight">Add to Call</h3>
                  <p className="text-white/40 text-xs">Invite a contact to join</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search contacts…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none border border-white/10 focus:border-green-500/50 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/8 mx-4" />

            {/* List */}
            <div className="overflow-y-auto px-3 py-2" style={{ maxHeight: 320 }}>
              {loading && (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Users className="w-8 h-8 text-white/20" />
                  <p className="text-white/30 text-sm">No contacts found</p>
                </div>
              )}

              {!loading && filtered.map(contact => {
                const alreadyIn  = isInCall(contact._id);
                const wasSent    = invited.has(contact._id);

                return (
                  <div
                    key={contact._id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-white/5 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username}`}
                        alt={contact.username}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username}`; }}
                      />
                      {alreadyIn && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-[#081020] flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{contact.username}</p>
                      {alreadyIn && <p className="text-green-400 text-xs">Already in call</p>}
                    </div>

                    {/* Button */}
                    {alreadyIn ? (
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20">
                        In call
                      </span>
                    ) : wasSent ? (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-white/40 bg-white/5 border border-white/10">
                        <Clock className="w-3 h-3" /> Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvite(contact)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-green-500/20 hover:bg-green-500/35 border border-green-500/30 transition-all active:scale-95"
                      >
                        <UserPlus className="w-3 h-3" />
                        Invite
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-4" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InviteParticipantsModal;