import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminUsername: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'ban_user', 'unban_user', 'delete_user', 'promote_user', 'demote_user',
      'mute_user', 'unmute_user', 'delete_message', 'delete_room',
      'end_call', 'broadcast', 'resolve_report', 'dismiss_report',
      'remove_user_from_room', 'view_dashboard'
    ]
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  targetUsername: {
    type: String,
    default: null
  },
  details: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

adminLogSchema.index({ adminId: 1, timestamp: -1 });
adminLogSchema.index({ action: 1 });
adminLogSchema.index({ timestamp: -1 });

const AdminLog = mongoose.model('AdminLog', adminLogSchema);
export default AdminLog;