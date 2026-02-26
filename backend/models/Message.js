const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    roomId: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: ['text', 'system', 'file'], default: 'text' },
    reactions: { type: Map, of: [String], default: {} }
}, { timestamps: true });

messageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
