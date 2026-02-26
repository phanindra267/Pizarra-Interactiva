const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    roomId: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploaderName: { type: String, required: true }
}, { timestamps: true });

fileSchema.index({ roomId: 1 });

module.exports = mongoose.model('File', fileSchema);
