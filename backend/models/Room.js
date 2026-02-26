const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['host', 'participant', 'observer'], default: 'participant' },
        joinedAt: { type: Date, default: Date.now }
    }],
    isLocked: { type: Boolean, default: false },
    password: { type: String, default: '' },
    maxParticipants: { type: Number, default: 20 },
    canvasData: { type: Object, default: { strokes: [], objects: [] } },
    drawingEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    tags: [{ type: String }]
}, { timestamps: true });

roomSchema.index({ host: 1 });

module.exports = mongoose.model('Room', roomSchema);
