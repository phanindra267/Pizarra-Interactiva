const File = require('../models/File');
const path = require('path');
const fs = require('fs');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.uploadFile = catchAsync(async (req, res, next) => {
    if (!req.file) return next(new AppError('No file uploaded', 400));
    const { roomId } = req.params;

    const fileUrl = `/uploads/${req.file.filename}`;

    const fileDoc = await File.create({
        roomId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        uploadedBy: req.user._id,
        uploaderName: req.user.name
    });

    res.status(201).json({ file: fileDoc });
});

exports.getFiles = catchAsync(async (req, res, next) => {
    const files = await File.find({ roomId: req.params.roomId })
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 });
    res.json({ files });
});

exports.deleteFile = catchAsync(async (req, res, next) => {
    const file = await File.findById(req.params.fileId);
    if (!file) return next(new AppError('File not found', 404));

    const filePath = path.join(__dirname, '..', 'uploads', file.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    await File.findByIdAndDelete(req.params.fileId);
    res.json({ message: 'File deleted' });
});
