import express from 'express';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Room from '../models/Room.js';
import DirectMessage from '../models/DirectMessage.js';
import AdminLog from '../models/AdminLog.js';
import Report from '../models/Report.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// ─── Helper: log admin action ─────────────────────────────────────────────────
const logAction = async (adminUser, action, targetUser = null, details = '', metadata = {}) => {
  try {
    await AdminLog.create({
      adminId: adminUser._id,
      adminUsername: adminUser.username,
      action,
      targetUser: targetUser?._id || null,
      targetUsername: targetUser?.username || null,
      details,
      metadata
    });
  } catch (err) {
    console.error('AdminLog error:', err);
  }
};

// ─── Helper: emit socket event ────────────────────────────────────────────────
const emitAdmin = (req, event, data) => {
  const io = req.app.get('io');
  if (io) io.emit(event, data);
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/dashboard
// ══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [
      totalUsers, onlineUsers, bannedUsers,
      totalMessages, totalRooms, activeRooms,
      pendingReports, totalDMs
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'online' }),
      User.countDocuments({ isBanned: true }),
      Message.countDocuments(),
      Room.countDocuments(),
      Room.countDocuments({ isActive: true }),
      Report.countDocuments({ status: 'pending' }),
      DirectMessage.countDocuments()
    ]);

    // User growth – last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Messages per hour – last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messagesPerHour = await Message.aggregate([
      { $match: { createdAt: { $gte: oneDayAgo } } },
      { $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Recent signups
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username avatar status createdAt role isBanned');

    res.json({
      success: true,
      stats: {
        totalUsers, onlineUsers, bannedUsers,
        totalMessages, totalRooms, activeRooms,
        pendingReports, totalDMs
      },
      charts: { userGrowth, messagesPerHour },
      recentUsers
    });
  } catch (err) {
    console.error('admin/dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users
// ══════════════════════════════════════════════════════════════════════════════
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } }
      ];
    }
    if (role)   query.role = role;
    if (status === 'banned') query.isBanned = true;
    else if (status === 'online')  query.status = 'online';
    else if (status === 'offline') query.status = 'offline';

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/ban-user/:id
// ══════════════════════════════════════════════════════════════════════════════
router.put('/ban-user/:id', adminAuth, async (req, res) => {
  try {
    const { reason = 'Violation of terms of service' } = req.body;
    const target = await User.findById(req.params.id).select('-password');
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if (target.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot ban a superadmin' });
    }

    const isBanning = !target.isBanned;
    target.isBanned = isBanning;
    target.bannedAt = isBanning ? new Date() : null;
    target.bannedBy = isBanning ? req.user._id : null;
    target.banReason = isBanning ? reason : '';
    await target.save();

    await logAction(req.user, isBanning ? 'ban_user' : 'unban_user', target, reason);

    // Force disconnect if banning
    if (isBanning && target.socketId) {
      emitAdmin(req, 'admin:user-banned', { userId: target._id.toString(), reason });
    }

    res.json({ success: true, message: `User ${isBanning ? 'banned' : 'unbanned'} successfully`, user: target });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/delete-user/:id
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/delete-user/:id', adminAuth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot delete a superadmin' });
    }

    await logAction(req.user, 'delete_user', target, `User ${target.username} deleted`);
    emitAdmin(req, 'admin:user-deleted', { userId: target._id.toString() });

    await User.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ sender: req.params.id });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/promote-user/:id
// ══════════════════════════════════════════════════════════════════════════════
router.put('/promote-user/:id', adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Use user or admin.' });
    }

    // Only superadmin can promote to admin
    if (role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only superadmin can promote to admin' });
    }

    const target = await User.findByIdAndUpdate(
      req.params.id, { role }, { new: true }
    ).select('-password');

    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    await logAction(req.user, role === 'admin' ? 'promote_user' : 'demote_user', target, `Role changed to ${role}`);

    res.json({ success: true, message: `User role updated to ${role}`, user: target });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/mute-user/:id
// ══════════════════════════════════════════════════════════════════════════════
router.put('/mute-user/:id', adminAuth, async (req, res) => {
  try {
    const { durationMinutes = 60 } = req.body;
    const target = await User.findById(req.params.id).select('-password');
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    const isMuting = !target.isMuted;
    target.isMuted = isMuting;
    target.mutedUntil = isMuting ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;
    target.mutedBy = isMuting ? req.user._id : null;
    await target.save();

    await logAction(req.user, isMuting ? 'mute_user' : 'unmute_user', target,
      isMuting ? `Muted for ${durationMinutes} minutes` : 'Unmuted');

    emitAdmin(req, 'admin:user-muted', {
      userId: target._id.toString(),
      isMuted: isMuting,
      mutedUntil: target.mutedUntil
    });

    res.json({ success: true, message: `User ${isMuting ? 'muted' : 'unmuted'}`, user: target });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/messages
// ══════════════════════════════════════════════════════════════════════════════
router.get('/messages', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 30, roomId = '', search = '' } = req.query;
    const query = {};
    if (roomId) query.roomId = roomId;
    if (search) query.content = { $regex: search, $options: 'i' };

    const total = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .populate('sender', 'username avatar role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, messages, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/delete-message/:id
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/delete-message/:id', adminAuth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    await logAction(req.user, 'delete_message', null, `Message in room ${msg.roomId} deleted`, { content: msg.content });

    emitAdmin(req, 'admin:message-deleted', { messageId: msg._id.toString(), roomId: msg.roomId });

    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/rooms
// ══════════════════════════════════════════════════════════════════════════════
router.get('/rooms', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, active = '' } = req.query;
    const query = {};
    if (active === 'true')  query.isActive = true;
    if (active === 'false') query.isActive = false;

    const total = await Room.countDocuments(query);
    const rooms = await Room.find(query)
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, rooms, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/delete-room/:roomId
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/delete-room/:roomId', adminAuth, async (req, res) => {
  try {
    const room = await Room.findOneAndUpdate(
      { roomId: req.params.roomId },
      { isActive: false, endedAt: new Date() },
      { new: true }
    );
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    await logAction(req.user, 'delete_room', null, `Room ${req.params.roomId} terminated`);
    emitAdmin(req, 'admin:room-terminated', { roomId: req.params.roomId });

    res.json({ success: true, message: 'Room terminated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system-stats
// ══════════════════════════════════════════════════════════════════════════════
router.get('/system-stats', adminAuth, async (req, res) => {
  try {
    const [
      totalUsers, onlineUsers, adminCount,
      totalMessages, totalRooms, activeRooms,
      bannedUsers, mutedUsers, pendingReports, totalReports,
      newUsersToday, messagesLast24h
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'online' }),
      User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
      Message.countDocuments(),
      Room.countDocuments(),
      Room.countDocuments({ isActive: true }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ isMuted: true }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } }),
      Message.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } })
    ]);

    // 30-day growth charts
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [userGrowth30, messageActivity30] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      Message.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    // Role breakdown
    const roleBreakdown = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers, onlineUsers, adminCount,
        totalMessages, totalRooms, activeRooms,
        bannedUsers, mutedUsers, pendingReports,
        totalReports, newUsersToday, messagesLast24h,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      },
      charts: { userGrowth30, messageActivity30, roleBreakdown }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/broadcast
// ══════════════════════════════════════════════════════════════════════════════
router.post('/broadcast', adminAuth, async (req, res) => {
  try {
    const { message, title = 'System Announcement', type = 'info' } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const io = req.app.get('io');
    if (io) {
      io.emit('admin:broadcast', {
        title,
        message,
        type,        // info | warning | danger | success
        sentBy: req.user.username,
        sentAt: new Date().toISOString()
      });
    }

    await logAction(req.user, 'broadcast', null, message, { title, type });

    res.json({ success: true, message: 'Broadcast sent to all connected users' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/reports
// ══════════════════════════════════════════════════════════════════════════════
router.get('/reports', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending', type = '' } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type)   query.type = type;

    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate('reportedBy', 'username avatar')
      .populate('targetUser', 'username avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, reports, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/resolve-report/:id
// ══════════════════════════════════════════════════════════════════════════════
router.put('/resolve-report/:id', adminAuth, async (req, res) => {
  try {
    const { status = 'resolved', resolution = '' } = req.body;
    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, resolution, resolvedBy: req.user._id, resolvedAt: new Date() },
      { new: true }
    ).populate('reportedBy', 'username').populate('targetUser', 'username');

    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    await logAction(req.user, 'resolve_report', null, `Report ${status}: ${resolution}`, { reportId: report._id });

    res.json({ success: true, message: `Report ${status}`, report });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/submit-report  (for regular users to submit reports)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/submit-report', async (req, res) => {
  try {
    const { reportedBy, reportedByUsername, type, targetUser, targetMessage, targetRoom, targetRoomId, reason, description } = req.body;

    const report = await Report.create({
      reportedBy, reportedByUsername, type,
      targetUser: targetUser || null,
      targetMessage: targetMessage || null,
      targetRoom: targetRoom || null,
      targetRoomId: targetRoomId || null,
      reason, description
    });

    // Notify all admins
    const io = req.app.get('io');
    if (io) io.emit('admin:new-report', { report });

    res.status(201).json({ success: true, message: 'Report submitted', report });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/logs
// ══════════════════════════════════════════════════════════════════════════════
router.get('/logs', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 30, action = '', adminId = '' } = req.query;
    const query = {};
    if (action)  query.action = action;
    if (adminId) query.adminId = adminId;

    const total = await AdminLog.countDocuments(query);
    const logs = await AdminLog.find(query)
      .populate('adminId', 'username avatar')
      .populate('targetUser', 'username')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;