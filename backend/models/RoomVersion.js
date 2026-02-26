const mongoose = require('mongoose');

const roomVersionSchema = new mongoose.Schema({
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomId: { type: String, required: true },
    versionNumber: { type: Number, required: true },
    canvasData: { type: Object, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    label: { type: String, default: '' }
}, { timestamps: true });

roomVersionSchema.index({ roomId: 1, versionNumber: -1 });

module.exports = mongoose.model('RoomVersion', roomVersionSchema);
