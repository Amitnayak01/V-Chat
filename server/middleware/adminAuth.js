import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ─── Verify JWT + admin/superadmin role ───────────────────────────────────────
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId || decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'Account is banned' });
    }

    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    req.user = user;
    req.adminId = user._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    console.error('adminAuth error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

// ─── Superadmin only (for destructive actions) ────────────────────────────────
export const superAdminAuth = async (req, res, next) => {
  await adminAuth(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Superadmin access required' });
    }
    next();
  });
};

export default adminAuth;