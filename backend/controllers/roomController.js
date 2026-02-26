const Room = require('../models/Room');
const RoomVersion = require('../models/RoomVersion');
const Message = require('../models/Message');
const File = require('../models/File');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.createRoom = catchAsync(async (req, res, next) => {
    const { name, password, maxParticipants } = req.body;
    if (!name) return next(new AppError('Room name is required', 400));

    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const roomData = {
        roomId, name, host: req.user._id,
        participants: [{ user: req.user._id, role: 'host' }],
        maxParticipants: maxParticipants || 20
    };
    if (password) {
        if (password.length < 4) return next(new AppError('Password must be at least 4 characters', 400));
        roomData.password = await bcrypt.hash(password, 10);
    }
    const room = await Room.create(roomData);
    res.status(201).json({ room });
});

exports.getRooms = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    const rooms = await Room.find({
        isActive: true,
        $or: [
            { host: userId },
            { 'participants.user': userId }
        ]
    })
        .populate('host', 'name email avatar')
        .populate('participants.user', 'name email avatar')
        .sort({ updatedAt: -1 });
    res.json({ rooms });
});

exports.getRoom = catchAsync(async (req, res, next) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId })
        .populate('host', 'name email avatar')
        .populate('participants.user', 'name email avatar');
    if (!room) return next(new AppError('Room not found', 404));
    res.json({ room });
});

exports.joinRoom = catchAsync(async (req, res, next) => {
    const roomId = req.params.roomId.toUpperCase();
    const { password } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return next(new AppError('Room not found', 404));
    if (!room.isActive) return next(new AppError('Room is closed', 400));

    const alreadyIn = room.participants.find(p => p.user.toString() === req.user._id.toString());

    // Only enforce lock, capacity, and password for NEW participants
    if (!alreadyIn) {
        if (room.isLocked) return next(new AppError('Room is locked', 403));
        if (room.participants.length >= room.maxParticipants) return next(new AppError('Room is full', 400));

        if (room.password) {
            if (!password) return next(new AppError('Password required for this room', 401));
            const valid = await bcrypt.compare(password, room.password);
            if (!valid) return next(new AppError('Incorrect password', 401));
        }

        room.participants.push({ user: req.user._id, role: 'participant' });
        await room.save();
    }

    const populated = await Room.findOne({ roomId })
        .populate('host', 'name email avatar')
        .populate('participants.user', 'name email avatar');
    res.json({ room: populated });
});

exports.leaveRoom = catchAsync(async (req, res, next) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId });
    if (!room) return next(new AppError('Room not found', 404));
    room.participants = room.participants.filter(p => p.user.toString() !== req.user._id.toString());
    await room.save();
    res.json({ message: 'Left room' });
});

exports.updateRoom = catchAsync(async (req, res, next) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId });
    if (!room) return next(new AppError('Room not found', 404));
    if (room.host.toString() !== req.user._id.toString()) return next(new AppError('Only the host can modify room settings', 403));

    const { isLocked, drawingEnabled, name } = req.body;
    if (typeof isLocked === 'boolean') room.isLocked = isLocked;
    if (typeof drawingEnabled === 'boolean') room.drawingEnabled = drawingEnabled;
    if (name) room.name = name;
    await room.save();
    res.json({ room });
});

exports.removeParticipant = catchAsync(async (req, res, next) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId });
    if (!room) return next(new AppError('Room not found', 404));
    if (room.host.toString() !== req.user._id.toString()) return next(new AppError('Only the host can remove participants', 403));

    room.participants = room.participants.filter(p => p.user.toString() !== req.params.userId);
    await room.save();
    res.json({ room });
});

exports.saveVersion = catchAsync(async (req, res, next) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId });
    if (!room) return next(new AppError('Room not found', 404));

    const lastVersion = await RoomVersion.findOne({ roomId: room.roomId }).sort({ versionNumber: -1 });
    const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const version = await RoomVersion.create({
        room: room._id, roomId: room.roomId, versionNumber,
        canvasData: room.canvasData, createdBy: req.user._id,
        label: req.body.label || `Version ${versionNumber}`
    });
    res.status(201).json({ version });
});

exports.getVersions = catchAsync(async (req, res, next) => {
    const roomId = req.params.roomId.toUpperCase();
    const versions = await RoomVersion.find({ roomId })
        .populate('createdBy', 'name')
        .sort({ versionNumber: -1 }).limit(50);
    res.json({ versions });
});

exports.restoreVersion = catchAsync(async (req, res, next) => {
    const version = await RoomVersion.findById(req.params.versionId);
    if (!version) return next(new AppError('Version snapshot not found', 404));

    const room = await Room.findOne({ roomId: version.roomId });
    if (!room) return next(new AppError('Room not found', 404));
    if (room.host.toString() !== req.user._id.toString()) return next(new AppError('Only the host can restore snapshots', 403));

    room.canvasData = version.canvasData;
    await room.save();
    res.json({ room });
});

// ─── CASCADING HARD DELETE ───
exports.deleteRoom = catchAsync(async (req, res, next) => {
    const roomIdParam = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId: roomIdParam });
    if (!room) return next(new AppError('Room not found', 404));
    if (room.host.toString() !== req.user._id.toString()) {
        return next(new AppError('Only the host can delete this room', 403));
    }

    const roomId = room.roomId;

    // 1. Delete all files from storage + DB
    const files = await File.find({ roomId });
    for (const file of files) {
        const filePath = path.join(__dirname, '..', 'uploads', file.filename);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
        }
    }
    await File.deleteMany({ roomId });

    // 2. Delete all messages
    await Message.deleteMany({ roomId });

    // 3. Delete all version snapshots
    await RoomVersion.deleteMany({ roomId });

    // 4. Force-disconnect all active users via socket
    const { getIO } = require('../server');
    const io = getIO();
    if (io) {
        io.to(roomId).emit('room-deleted', { roomId, message: 'This room has been deleted by the host.' });
        // Force all sockets to leave the room
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
            s.leave(roomId);
        }
    }

    // 5. Delete the room itself
    await Room.findByIdAndDelete(room._id);

    res.json({ message: 'Room and all associated data have been permanently deleted' });
});
