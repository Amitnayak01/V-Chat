import express from 'express';
import { protect } from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import SupportTicket from '../models/SupportTicket.js';
import AdminLog from '../models/AdminLog.js';

const router = express.Router();

/* ── User: Create ticket ─────────────────────────────────────────────── */
router.post('/tickets', protect, async (req, res) => {
  try {
    const { category, subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject and message required' });

    const ticket = await SupportTicket.create({
      user: req.user._id,
      category: category || 'general',
      subject,
      messages: [{
        sender:     req.user._id,
        senderRole: req.user.role || 'user',
        content:    message,
        readByUser: true,
      }],
      unreadAdmin: 1,
      lastMessageAt: new Date(),
    });

    await ticket.populate('user', 'username avatar');

    // Notify admins via socket
    const io = req.app.get('io');
    io.emit('support:new-ticket', {
      ticketId:   ticket.ticketId,
      subject:    ticket.subject,
      category:   ticket.category,
      username:   req.user.username,
      avatar:     req.user.avatar,
      _id:        ticket._id,
      createdAt:  ticket.createdAt,
    });

    res.json({ success: true, ticket });
  } catch (err) {
    console.error('[Support] create ticket:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── User: Get my tickets ────────────────────────────────────────────── */
router.get('/tickets/my', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .select('-messages')
      .sort({ lastMessageAt: -1 })
      .lean();
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── User: Get ticket messages ───────────────────────────────────────── */
router.get('/tickets/:id', protect, async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('messages.sender', 'username avatar role');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Mark all admin messages as read
    ticket.messages.forEach(m => {
      if (m.senderRole !== 'user') m.readByUser = true;
    });
    ticket.unreadUser = 0;
    await ticket.save();

    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── User: Send message in ticket ────────────────────────────────────── */
router.post('/tickets/:id/messages', protect, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Message required' });

    const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user._id });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.status === 'closed') return res.status(400).json({ success: false, message: 'Ticket is closed' });

    const msg = {
      sender:     req.user._id,
      senderRole: req.user.role || 'user',
      content:    content.trim(),
      readByUser: true,
    };

    ticket.messages.push(msg);
    ticket.unreadAdmin += 1;
    ticket.lastMessageAt = new Date();
    if (ticket.status === 'resolved') ticket.status = 'in_progress';
    await ticket.save();
    await ticket.populate('messages.sender', 'username avatar role');

    const newMsg = ticket.messages[ticket.messages.length - 1];

    const io = req.app.get('io');
    io.emit('support:new-message', {
      ticketId:   ticket._id,
      ticketCode: ticket.ticketId,
      message:    newMsg,
      fromUser:   true,
    });

    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════════════
   ADMIN ROUTES
══════════════════════════════════════════════════════════════════════ */

/* ── Admin: Get all tickets ──────────────────────────────────────────── */
router.get('/admin/tickets', adminAuth, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('user', 'username avatar')
        .populate('assignedTo', 'username avatar')
        .select('-messages')
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    res.json({ success: true, tickets, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── Admin: Get ticket with messages ─────────────────────────────────── */
router.get('/admin/tickets/:id', adminAuth, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user', 'username avatar role')
      .populate('assignedTo', 'username avatar')
      .populate('messages.sender', 'username avatar role');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Mark all user messages as read by admin
    ticket.messages.forEach(m => {
      if (m.senderRole === 'user') m.readByAdmin = true;
    });
    ticket.unreadAdmin = 0;
    await ticket.save();

    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── Admin: Reply to ticket ──────────────────────────────────────────── */
router.post('/admin/tickets/:id/reply', adminAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content required' });

    const ticket = await SupportTicket.findById(req.params.id).populate('user', '_id username');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const msg = {
      sender:      req.user._id,
      senderRole:  req.user.role,
      content:     content.trim(),
      readByAdmin: true,
    };

    ticket.messages.push(msg);
    ticket.unreadUser += 1;
    ticket.lastMessageAt = new Date();
    if (ticket.status === 'open') ticket.status = 'in_progress';
    if (!ticket.assignedTo) ticket.assignedTo = req.user._id;
    await ticket.save();
    await ticket.populate('messages.sender', 'username avatar role');

    const newMsg = ticket.messages[ticket.messages.length - 1];

    const io = req.app.get('io');
    // Notify the user
    io.to(`user:${ticket.user._id}`).emit('support:new-message', {
      ticketId:   ticket._id,
      ticketCode: ticket.ticketId,
      message:    newMsg,
      fromAdmin:  true,
    });

    await AdminLog.create({
      adminId:       req.user._id,
      adminUsername: req.user.username,
      action:        'send_broadcast',
      details:       `Replied to support ticket ${ticket.ticketId}`,
    });

    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── Admin: Update ticket status ─────────────────────────────────────── */
router.put('/admin/tickets/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, priority } = req.body;
    const ticket = await SupportTicket.findById(req.params.id).populate('user', '_id');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (status) {
      ticket.status = status;
      if (status === 'resolved') { ticket.resolvedAt = new Date(); ticket.resolvedBy = req.user._id; }
    }
    if (priority) ticket.priority = priority;
    await ticket.save();

    const io = req.app.get('io');
    io.to(`user:${ticket.user._id}`).emit('support:ticket-updated', {
      ticketId: ticket._id,
      status:   ticket.status,
      priority: ticket.priority,
    });

    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── Admin: Stats ────────────────────────────────────────────────────── */
router.get('/admin/support-stats', adminAuth, async (req, res) => {
  try {
    const [open, inProgress, resolved, closed, total, unread] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: 'resolved' }),
      SupportTicket.countDocuments({ status: 'closed' }),
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ unreadAdmin: { $gt: 0 } }),
    ]);
    res.json({ success: true, stats: { open, inProgress, resolved, closed, total, unread } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;