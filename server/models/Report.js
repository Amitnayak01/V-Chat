import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedByUsername: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['user', 'message', 'room'],
    required: true
  },
  // Target references (only one will be set based on type)
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  targetMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  targetRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },
  targetRoomId: {
    type: String,
    default: null
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'spam', 'harassment', 'inappropriate_content',
      'hate_speech', 'misinformation', 'other'
    ]
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolution: {
    type: String,
    default: ''
  }
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ type: 1, status: 1 });

const Report = mongoose.model('Report', reportSchema);
export default Report;