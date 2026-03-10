import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema({
  sender:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  content:    { type: String, required: true, maxlength: 2000 },
  readByAdmin:{ type: Boolean, default: false },
  readByUser: { type: Boolean, default: false },
}, { timestamps: true });

const supportTicketSchema = new mongoose.Schema({
  ticketId:   { type: String, unique: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  category: {
    type: String,
    enum: ['bug', 'account', 'chat', 'call', 'general'],
    default: 'general',
  },
  subject:  { type: String, required: true, maxlength: 200 },
  status:   { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  messages: [supportMessageSchema],
  unreadAdmin: { type: Number, default: 0 },
  unreadUser:  { type: Number, default: 0 },
  resolvedAt:  { type: Date, default: null },
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Auto-generate ticketId
supportTicketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model('SupportTicket').countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

supportTicketSchema.index({ user: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, lastMessageAt: -1 });

export default mongoose.model('SupportTicket', supportTicketSchema);