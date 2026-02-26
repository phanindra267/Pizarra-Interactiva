const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

// Track online users per room: { roomId: { socketId: { userId, userName, cursor } } }
const roomUsers = {};
// Track session recordings: { roomId: [{ type, data, timestamp }] }
const sessionRecordings = {};

module.exports = (io) => {
    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth.token;

            // If no token in auth object, check cookies
            if (!token && socket.request.headers.cookie) {
                const cookies = cookie.parse(socket.request.headers.cookie);
                token = cookies.token;
            }

            if (!token) return next(new Error('Authentication error: No token provided'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');
            if (!user) return next(new Error('User not found'));
            socket.user = user;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 ${socket.user.name} connected (${socket.id})`);

        // ─── JOIN ROOM ───
        socket.on('join-room', async ({ roomId: rawRoomId }) => {
            try {
                const roomId = rawRoomId.toUpperCase();
                socket.join(roomId);
                const room = await Room.findOne({ roomId });
                if (!room) return socket.emit('error', { message: 'Room not found' });

                // Auto-add user as participant if not already in the room
                const existingParticipant = room.participants.find(p => p.user.toString() === socket.user._id.toString());
                if (!existingParticipant && room.host.toString() !== socket.user._id.toString()) {
                    room.participants.push({ user: socket.user._id, role: 'participant' });
                    await room.save();
                }

                // Determine role
                let role = 'observer';
                if (room.host.toString() === socket.user._id.toString()) {
                    role = 'host';
                } else {
                    const participant = room.participants.find(p => p.user.toString() === socket.user._id.toString());
                    if (participant) role = participant.role;
                }

                if (!roomUsers[roomId]) roomUsers[roomId] = {};
                roomUsers[roomId][socket.id] = {
                    userId: socket.user._id.toString(),
                    userName: socket.user.name,
                    avatar: socket.user.avatar,
                    role,
                    cursor: null
                };

                // Send current room state to the joiner
                socket.emit('room-state', {
                    canvasData: room.canvasData,
                    participants: Object.values(roomUsers[roomId]),
                    role // Tell user their own role
                });

                // Notify others
                socket.to(roomId).emit('user-joined', {
                    userId: socket.user._id.toString(),
                    userName: socket.user.name,
                    participants: Object.values(roomUsers[roomId])
                });

                // Load recent chat
                const messages = await Message.find({ roomId }).sort({ createdAt: -1 }).limit(50).lean();
                socket.emit('chat-history', messages.reverse());

                // Init recording
                if (!sessionRecordings[roomId]) sessionRecordings[roomId] = [];

                socket.currentRoom = roomId;
            } catch (err) {
                console.error('Socket join-room error:', err);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        // ─── DRAWING ───
        socket.on('draw', async ({ roomId, stroke }) => {
            const room = await Room.findOne({ roomId });
            if (!room || !room.isActive) return;

            // Check Drawing Permissions (RBAC)
            const role = roomUsers[roomId]?.[socket.id]?.role;
            if (role === 'observer') return;
            if (role === 'participant' && !room.drawingEnabled) return;

            socket.to(roomId).emit('draw', { stroke, userId: socket.user._id.toString(), userName: socket.user.name });
            // Record or Update
            if (sessionRecordings[roomId]) {
                const existing = sessionRecordings[roomId].find(r => r.type === 'draw' && r.data.id === stroke.id);
                if (existing) {
                    existing.data = stroke;
                } else {
                    sessionRecordings[roomId].push({ type: 'draw', data: stroke, userId: socket.user._id.toString(), timestamp: Date.now() });
                }
            }
        });

        socket.on('draw-delta', async ({ roomId, strokeId, point, tool, color, size }) => {
            const room = await Room.findOne({ roomId });
            if (!room || !room.isActive) return;

            // Check Drawing Permissions (RBAC)
            const role = roomUsers[roomId]?.[socket.id]?.role;
            if (role === 'observer') return;
            if (role === 'participant' && !room.drawingEnabled) return;

            socket.to(roomId).emit('draw-delta', { strokeId, point, tool, color, size, userId: socket.user._id.toString() });
            // Record delta in session
            if (sessionRecordings[roomId]) {
                const existing = sessionRecordings[roomId].find(r => r.type === 'draw' && r.data.id === strokeId);
                if (existing) {
                    existing.data.points.push(point);
                } else {
                    sessionRecordings[roomId].push({
                        type: 'draw',
                        data: { id: strokeId, tool, color, size, points: [point] },
                        userId: socket.user._id.toString(),
                        timestamp: Date.now()
                    });
                }
            }
        });

        socket.on('draw-batch', ({ roomId, strokes }) => {
            socket.to(roomId).emit('draw-batch', { strokes, userId: socket.user._id.toString() });
        });

        // ─── CURSOR ───
        socket.on('cursor-move', ({ roomId, x, y }) => {
            if (roomUsers[roomId] && roomUsers[roomId][socket.id]) {
                roomUsers[roomId][socket.id].cursor = { x, y };
            }
            socket.to(roomId).emit('cursor-move', {
                userId: socket.user._id.toString(),
                userName: socket.user.name,
                x, y
            });
        });

        // ─── UNDO / REDO ───
        socket.on('undo', ({ roomId, strokeId }) => {
            socket.to(roomId).emit('undo', { strokeId, userId: socket.user._id.toString() });
            if (sessionRecordings[roomId]) sessionRecordings[roomId].push({ type: 'undo', data: { strokeId }, timestamp: Date.now() });
        });

        socket.on('redo', ({ roomId, strokeId }) => {
            socket.to(roomId).emit('redo', { strokeId, userId: socket.user._id.toString() });
            if (sessionRecordings[roomId]) sessionRecordings[roomId].push({ type: 'redo', data: { strokeId }, timestamp: Date.now() });
        });

        // ─── CLEAR BOARD ───
        socket.on('clear-board', async ({ roomId }) => {
            const role = roomUsers[roomId]?.[socket.id]?.role;
            if (role !== 'host') return socket.emit('error', { message: 'Only host can clear' });

            io.to(roomId).emit('clear-board', { userId: socket.user._id.toString() });
            try {
                await Room.updateOne({ roomId }, { canvasData: { strokes: [], objects: [] } });
            } catch (err) { }
            if (sessionRecordings[roomId]) sessionRecordings[roomId].push({ type: 'clear', data: {}, timestamp: Date.now() });
        });

        // ─── CANVAS SAVE (auto-save) ───
        socket.on('save-canvas', async ({ roomId, canvasData }) => {
            try {
                await Room.updateOne({ roomId }, { canvasData });
            } catch (err) { }
        });

        // ─── CHAT ───
        socket.on('chat-message', async ({ roomId, text }) => {
            try {
                const msg = await Message.create({
                    roomId, user: socket.user._id,
                    userName: socket.user.name, text
                });
                io.to(roomId).emit('chat-message', {
                    _id: msg._id, roomId, text,
                    userName: socket.user.name,
                    userId: socket.user._id.toString(),
                    createdAt: msg.createdAt
                });
                if (sessionRecordings[roomId]) sessionRecordings[roomId].push({ type: 'chat', data: { text, userName: socket.user.name }, timestamp: Date.now() });
            } catch (err) {
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('typing', ({ roomId, isTyping }) => {
            socket.to(roomId).emit('typing', { userId: socket.user._id.toString(), userName: socket.user.name, isTyping });
        });

        socket.on('reaction', ({ roomId, messageId, emoji }) => {
            io.to(roomId).emit('reaction', { messageId, emoji, userId: socket.user._id.toString(), userName: socket.user.name });
        });

        // ─── FILE SHARED ───
        socket.on('file-shared', ({ roomId, file }) => {
            socket.to(roomId).emit('file-shared', { file, userName: socket.user.name });
        });

        // ─── WEBRTC SIGNALING ───
        socket.on('screen-offer', ({ roomId, offer, to }) => {
            io.to(to).emit('screen-offer', { offer, from: socket.id, userName: socket.user.name });
        });

        socket.on('screen-answer', ({ roomId, answer, to }) => {
            io.to(to).emit('screen-answer', { answer, from: socket.id });
        });

        socket.on('ice-candidate', ({ roomId, candidate, to }) => {
            io.to(to).emit('ice-candidate', { candidate, from: socket.id });
        });

        socket.on('screen-share-started', ({ roomId }) => {
            socket.to(roomId).emit('screen-share-started', { userId: socket.user._id.toString(), userName: socket.user.name, socketId: socket.id });
        });

        socket.on('screen-share-stopped', ({ roomId }) => {
            socket.to(roomId).emit('screen-share-stopped', { userId: socket.user._id.toString() });
        });

        // ─── SESSION RECORDING ───
        socket.on('get-recording', ({ roomId }) => {
            socket.emit('session-recording', { recording: sessionRecordings[roomId] || [] });
        });

        // ─── HOST CONTROLS (Live Updates) ───
        socket.on('room-update', async ({ roomId, isLocked, drawingEnabled }) => {
            const role = roomUsers[roomId]?.[socket.id]?.role;
            if (role !== 'host') return;

            socket.to(roomId).emit('room-settings-changed', { isLocked, drawingEnabled });
        });

        socket.on('kick-user', ({ roomId, userId }) => {
            const role = roomUsers[roomId]?.[socket.id]?.role;
            if (role !== 'host') return;

            // Find all sockets for this userId in this room
            Object.keys(roomUsers[roomId]).forEach(sid => {
                if (roomUsers[roomId][sid].userId === userId) {
                    io.to(sid).emit('kicked');
                    const s = io.sockets.sockets.get(sid);
                    if (s) s.leave(roomId);
                }
            });
        });

        // ─── LEAVE / DISCONNECT ───
        socket.on('leave-room', ({ roomId }) => {
            handleLeave(socket, roomId);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 ${socket.user.name} disconnected`);
            if (socket.currentRoom) handleLeave(socket, socket.currentRoom);
        });
    });

    function handleLeave(socket, roomId) {
        socket.leave(roomId);
        if (roomUsers[roomId]) {
            delete roomUsers[roomId][socket.id];
            const remaining = Object.values(roomUsers[roomId]);
            io.to(roomId).emit('user-left', {
                userId: socket.user._id.toString(),
                socketId: socket.id, // CRITICAL: For WebRTC cleanup
                userName: socket.user.name,
                participants: remaining
            });
            if (remaining.length === 0) {
                delete roomUsers[roomId];
                // Auto-clean recording after 1 hour
                setTimeout(() => { delete sessionRecordings[roomId]; }, 3600000);
            }
        }
    }
};
