import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import ExportOverlay from '../components/ExportOverlay';
import { Pencil, Brush, Eraser, Minus, Square, Circle, Type, StickyNote, Image as ImageIcon, Undo2, Redo2, Trash2, Video, VideoOff, Camera, Download, Link as LinkIcon, MessageSquare, ZoomIn, ZoomOut, Maximize, UserPlus, Users, Folder, Clock, Check, X, Lock, Unlock, PenOff, PenTool } from 'lucide-react';

const COLORS = ['#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#6c5ce7', '#a29bfe', '#fd79a8', '#00cec9', '#fdcb6e', '#2d3436', '#636e72'];
const TOOLS = [
    { id: 'pencil', icon: '✏️', label: 'Pencil' },
    { id: 'brush', icon: '🖌️', label: 'Brush' },
    { id: 'eraser', icon: '🧹', label: 'Eraser' },
    { id: 'line', icon: '📏', label: 'Line' },
    { id: 'rect', icon: '⬜', label: 'Rectangle' },
    { id: 'circle', icon: '⭕', label: 'Circle' },
    { id: 'text', icon: '📝', label: 'Text' },
    { id: 'sticky', icon: '📌', label: 'Sticky Note' },
    { id: 'image', icon: '🖼️', label: 'Image' }
];

export default function Whiteboard() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket, emit, on, off } = useSocket();

    // Canvas state
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const [tool, setTool] = useState('pencil');
    const [color, setColor] = useState('#ffffff');
    const [brushSize, setBrushSize] = useState(3);
    const [isDrawing, setIsDrawing] = useState(false);
    const [strokes, setStrokes] = useState([]);
    const [currentStroke, setCurrentStroke] = useState(null);
    const [undoStack, setUndoStack] = useState([]);

    // Transform state (Zoom & Pan)
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const lastTouchDistance = useRef(null);
    const lastTouchCenter = useRef(null);

    // Sidebar
    const [sidebarTab, setSidebarTab] = useState('chat');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Chat
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [typingUsers, setTypingUsers] = useState([]);
    const chatEndRef = useRef(null);

    // Participants / cursors
    const [participants, setParticipants] = useState([]);
    const [remoteCursors, setRemoteCursors] = useState({});

    // Files
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);

    // Versions
    const [versions, setVersions] = useState([]);

    // Video Grid / WebRTC
    const [localStream, setLocalStream] = useState(null);
    const [screenStream, setScreenStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const peerConnections = useRef({});
    const localVideoRef = useRef(null);

    // Session replay
    const [showReplay, setShowReplay] = useState(false);
    const [recording, setRecording] = useState([]);
    const [replayIndex, setReplayIndex] = useState(0);
    const [replaySpeed, setReplaySpeed] = useState(1);
    const [isReplaying, setIsReplaying] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const exportCanvasRef = useRef(null);

    // Room info
    const [roomInfo, setRoomInfo] = useState(null);
    const [myRole, setMyRole] = useState('participant');

    // Text/Sticky Editor state
    const [activeEditor, setActiveEditor] = useState(null);

    // Layout & UI State
    const [fillColor, setFillColor] = useState('transparent');
    const [opacity, setOpacity] = useState(100);
    const [gridEnabled, setGridEnabled] = useState(true);

    // Draggable Video State
    const [videoPos, setVideoPos] = useState({ x: 0, y: 0 });
    const [isDraggingVideo, setIsDraggingVideo] = useState(false);
    const videoDragOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setVideoPos({
            x: window.innerWidth / 2 - 100,
            y: window.innerHeight / 2 - 100
        });
    }, []);

    const handleVideoPointerDown = (e) => {
        e.stopPropagation();
        setIsDraggingVideo(true);
        videoDragOffset.current = {
            x: e.clientX - videoPos.x,
            y: e.clientY - videoPos.y
        };
    };

    const handleVideoPointerMove = (e) => {
        if (!isDraggingVideo) return;
        setVideoPos({
            x: e.clientX - videoDragOffset.current.x,
            y: e.clientY - videoDragOffset.current.y
        });
    };

    const handleVideoPointerUp = () => {
        setIsDraggingVideo(false);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctxRef.current = ctx;

        const resize = () => {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            ctx.putImageData(imageData, 0, 0);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            redrawAll();
        };
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (strokes.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [strokes]);

    useEffect(() => {
        if (!socket) return;
        emit('join-room', { roomId });

        const handlers = {
            'room-state': ({ canvasData, participants: p, role }) => {
                if (canvasData?.strokes) { setStrokes(canvasData.strokes); }
                setParticipants(p || []);
                if (role) setMyRole(role);
            },
            'user-joined': ({ userName, participants: p }) => {
                setParticipants(p || []);
                setMessages(prev => [...prev, { _id: Date.now(), text: `${userName} joined`, type: 'system', createdAt: new Date() }]);
            },
            'user-left': ({ userName, participants: p, socketId: leftSocketId, userId: leftUserId }) => {
                setParticipants(p || []);
                setMessages(prev => [...prev, { _id: Date.now(), text: `${userName} left`, type: 'system', createdAt: new Date() }]);
                const targetId = leftSocketId || leftUserId;
                if (peerConnections.current[targetId]) {
                    peerConnections.current[targetId].close();
                    delete peerConnections.current[targetId];
                }
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[targetId];
                    return next;
                });
            },
            'draw': ({ stroke }) => {
                setStrokes(prev => [...prev.filter(s => s.id !== stroke.id), stroke]);
            },
            'draw-delta': ({ strokeId, point, tool, color, size }) => {
                setStrokes(prev => {
                    const existing = prev.find(s => s.id === strokeId);
                    if (existing) {
                        return prev.map(s => s.id === strokeId ? { ...s, points: [...s.points, point] } : s);
                    } else {
                        return [...prev, { id: strokeId, tool, color, size, points: [point] }];
                    }
                });
            },
            'draw-batch': ({ strokes: newStrokes }) => {
                setStrokes(prev => [...prev, ...newStrokes]);
            },
            'cursor-move': ({ userId, userName, x, y }) => {
                setRemoteCursors(prev => ({ ...prev, [userId]: { userName, x, y } }));
            },
            'undo': ({ strokeId }) => {
                setStrokes(prev => prev.filter(s => s.id !== strokeId));
            },
            'redo': ({ stroke }) => {
                if (stroke) setStrokes(prev => [...prev, stroke]);
            },
            'clear-board': () => {
                setStrokes([]);
            },
            'chat-history': (msgs) => { setMessages(msgs); },
            'chat-message': (msg) => { setMessages(prev => [...prev, msg]); },
            'typing': ({ userName, isTyping }) => {
                setTypingUsers(prev => isTyping ? [...prev.filter(n => n !== userName), userName] : prev.filter(n => n !== userName));
            },
            'file-shared': ({ file }) => { setFiles(prev => [...prev, file]); },
            'screen-share-started': ({ userName, from }) => {
                setMessages(prev => [...prev, { _id: Date.now(), text: `${userName} started video/screen sharing`, type: 'system', createdAt: new Date() }]);
            },
            'screen-share-stopped': ({ from }) => {
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[from];
                    return next;
                });
            },
            'screen-offer': async ({ offer, from }) => {
                try {
                    const pc = createPeerConnection(from);
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    emit('screen-answer', { roomId, answer, to: from });
                } catch (err) { console.error('Signaling offer error:', err); }
            },
            'screen-answer': async ({ answer, from }) => {
                try {
                    const pc = peerConnections.current[from];
                    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) { console.error('Signaling answer error:', err); }
            },
            'ice-candidate': ({ candidate, from }) => {
                try {
                    const pc = peerConnections.current[from];
                    if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) { console.error('ICE error:', err); }
            },
            'room-settings-changed': ({ isLocked, drawingEnabled }) => {
                setRoomInfo(prev => prev ? { ...prev, isLocked, drawingEnabled } : prev);
            },
            'kicked': () => {
                alert('You have been removed from the room by the host.');
                navigate('/dashboard');
            },
            'session-recording': ({ recording: r }) => { setRecording(r || []); },
            'room-deleted': ({ message }) => {
                alert(message || 'This room has been deleted by the host.');
                navigate('/dashboard');
            }
        };

        Object.entries(handlers).forEach(([event, handler]) => on(event, handler));

        api.get(`/rooms/${roomId}`).then(({ data }) => setRoomInfo(data.room)).catch(() => { });
        api.get(`/files/${roomId}`).then(({ data }) => setFiles(data.files || [])).catch(() => { });
        api.get(`/rooms/${roomId}/versions`).then(({ data }) => setVersions(data.versions || [])).catch(() => { });

        return () => {
            Object.entries(handlers).forEach(([event, handler]) => off(event, handler));
            emit('leave-room', { roomId });
            if (localStream) localStream.getTracks().forEach(t => t.stop());
            if (screenStream) screenStream.getTracks().forEach(t => t.stop());
            Object.values(peerConnections.current).forEach(pc => pc.close());
        };
    }, [socket, roomId]);

    useEffect(() => { redrawAll(); }, [strokes]);

    const redrawAll = useCallback(() => {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.scale, transform.scale);

        strokes.forEach(stroke => drawStroke(ctx, stroke));
        if (isDrawing && currentStroke) drawStroke(ctx, currentStroke);

        ctx.restore();
    }, [strokes, transform, isDrawing, currentStroke]);

    const drawStroke = (ctx, stroke) => {
        if (!stroke || !stroke.points || stroke.points.length === 0) return;
        ctx.save();
        ctx.strokeStyle = stroke.color || '#ffffff';
        ctx.lineWidth = stroke.size || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = stroke.opacity !== undefined ? stroke.opacity / 100 : 1;
        ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';

        if (stroke.tool === 'line') {
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            const last = stroke.points[stroke.points.length - 1];
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
        } else if (stroke.tool === 'rect') {
            const p0 = stroke.points[0];
            const pN = stroke.points[stroke.points.length - 1];
            if (stroke.fillColor && stroke.fillColor !== 'transparent') {
                ctx.fillStyle = stroke.fillColor;
                ctx.fillRect(p0.x, p0.y, pN.x - p0.x, pN.y - p0.y);
            }
            ctx.strokeRect(p0.x, p0.y, pN.x - p0.x, pN.y - p0.y);
        } else if (stroke.tool === 'circle') {
            const p0 = stroke.points[0];
            const pN = stroke.points[stroke.points.length - 1];
            const rx = Math.abs(pN.x - p0.x) / 2;
            const ry = Math.abs(pN.y - p0.y) / 2;
            ctx.beginPath();
            ctx.ellipse(p0.x + (pN.x - p0.x) / 2, p0.y + (pN.y - p0.y) / 2, rx, ry, 0, 0, 2 * Math.PI);
            if (stroke.fillColor && stroke.fillColor !== 'transparent') {
                ctx.fillStyle = stroke.fillColor;
                ctx.fill();
            }
            ctx.stroke();
        } else if (stroke.tool === 'text' && stroke.text) {
            ctx.font = `${stroke.size * 5}px Inter, sans-serif`;
            ctx.fillStyle = stroke.color;
            ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
        } else if (stroke.tool === 'sticky' && stroke.text) {
            const p = stroke.points[0];
            ctx.fillStyle = '#fdcb6e';
            ctx.fillRect(p.x, p.y, 160, 120);
            ctx.fillStyle = '#2d3436';
            ctx.font = '14px Inter, sans-serif';
            const lines = stroke.text.match(/.{1,20}/g) || [stroke.text];
            lines.forEach((line, i) => ctx.fillText(line, p.x + 10, p.y + 25 + i * 20));
        } else if (stroke.tool === 'image' && stroke.image) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = stroke.image;
            const renderImg = () => {
                if (!ctx) return;
                const width = stroke.width || img.width || 300;
                const height = stroke.height || img.height || 200;
                ctx.drawImage(img, stroke.points[0].x, stroke.points[0].y, width, height);
            };
            if (img.complete) renderImg(); else img.onload = renderImg;
        } else {
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            ctx.stroke();
        }
        ctx.restore();
    };

    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left - transform.x) / transform.scale,
            y: (clientY - rect.top - transform.y) / transform.scale
        };
    };

    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            lastTouchDistance.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            lastTouchCenter.current = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
            setIsDrawing(false);
        } else if (e.touches.length === 1) startDrawing(e);
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && lastTouchDistance.current) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
            const scaleFactor = distance / lastTouchDistance.current;
            const newScale = Math.min(Math.max(transform.scale * scaleFactor, 0.1), 10);
            const dx = center.x - lastTouchCenter.current.x;
            const dy = center.y - lastTouchCenter.current.y;
            setTransform(prev => ({ scale: newScale, x: prev.x + dx, y: prev.y + dy }));
            lastTouchDistance.current = distance;
            lastTouchCenter.current = center;
        } else if (e.touches.length === 1) handleMouseMove(e);
    };

    const startDrawing = (e) => {
        if (myRole === 'observer') return;
        if (myRole === 'participant' && roomInfo && !roomInfo.drawingEnabled) return;
        if (activeEditor) return;

        if (tool === 'image') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (ie) => {
                const file = ie.target.files[ie.target.files.length - 1];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const { data } = await api.post(`/files/${roomId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                    const pos = getPos(e);
                    const stroke = { id: `${Date.now()}-${Math.random()}`, tool: 'image', points: [pos], image: data.file.url, userId: user._id };
                    setStrokes(prev => [...prev, stroke]);
                    emit('draw', { roomId, stroke });
                } catch (err) { alert('Image upload failed'); }
            };
            input.click();
            return;
        }

        if (tool === 'text' || tool === 'sticky') {
            const pos = getPos(e);
            setActiveEditor({ ...pos, value: '', tool });
            return;
        }
        setIsDrawing(true);
        const pos = getPos(e);
        const stroke = { id: `${Date.now()}-${Math.random()}`, tool, color, size: brushSize, fillColor, opacity, points: [pos], userId: user._id };
        setCurrentStroke(stroke);
    };

    const handleEditorSubmit = (value) => {
        if (value.trim() && activeEditor) {
            const stroke = { id: `${Date.now()}-${Math.random()}`, tool: activeEditor.tool, color, size: brushSize, points: [{ x: activeEditor.x, y: activeEditor.y }], text: value.trim(), userId: user._id };
            setStrokes(prev => [...prev, stroke]);
            emit('draw', { roomId, stroke });
        }
        setActiveEditor(null);
    };

    const draw = (e) => {
        if (activeEditor || !isDrawing || !currentStroke) return;
        const pos = getPos(e);
        setCurrentStroke(prev => ({ ...prev, points: [...prev.points, pos] }));
        if (['pencil', 'brush', 'eraser'].includes(tool)) {
            emit('draw-delta', { roomId, strokeId: currentStroke.id, point: pos, tool, color: tool === 'eraser' ? '#000' : color, size: brushSize });
        }
    };

    const endDrawing = () => {
        if (activeEditor || !isDrawing || !currentStroke) return;
        setIsDrawing(false);
        const finalStroke = { ...currentStroke };
        setStrokes(prev => [...prev, finalStroke]);
        setUndoStack([]);
        emit('draw', { roomId, stroke: finalStroke });
        setCurrentStroke(null);
    };

    const lastCursorEmit = useRef(0);
    const handleMouseMove = (e) => {
        const pos = getPos(e);
        const now = Date.now();
        if (now - lastCursorEmit.current > 50) {
            emit('cursor-move', { roomId, x: pos.x, y: pos.y });
            lastCursorEmit.current = now;
        }
        if (isDrawing) draw(e);
    };

    const handleUndo = () => {
        if (strokes.length === 0) return;
        const myStrokes = strokes.filter(s => s.userId === user._id);
        if (myStrokes.length === 0) return;
        const last = myStrokes[myStrokes.length - 1];
        setUndoStack(prev => [...prev, last]);
        setStrokes(prev => prev.filter(s => s.id !== last.id));
        emit('undo', { roomId, strokeId: last.id });
    };

    const handleRedo = () => {
        if (undoStack.length === 0) return;
        const stroke = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        setStrokes(prev => [...prev, stroke]);
        emit('redo', { roomId, strokeId: stroke.id });
    };

    const handleClearBoard = () => {
        if (myRole !== 'host') return alert('Only the host can clear the board');
        if (window.confirm('Clear the entire board?')) {
            emit('clear-board', { roomId });
            setStrokes([]);
        }
    };

    const handleToggleLock = async () => {
        const newLocked = !roomInfo.isLocked;
        try {
            await api.put(`/rooms/${roomId}`, { isLocked: newLocked });
            setRoomInfo(prev => ({ ...prev, isLocked: newLocked }));
            emit('room-update', { roomId, isLocked: newLocked, drawingEnabled: roomInfo.drawingEnabled });
        } catch (err) { alert('Failed to toggle lock'); }
    };

    const handleToggleDrawing = async () => {
        const newEnabled = !roomInfo.drawingEnabled;
        try {
            await api.put(`/rooms/${roomId}`, { drawingEnabled: newEnabled });
            setRoomInfo(prev => ({ ...prev, drawingEnabled: newEnabled }));
            emit('room-update', { roomId, isLocked: roomInfo.isLocked, drawingEnabled: newEnabled });
        } catch (err) { alert('Failed to toggle drawing'); }
    };

    const handleKick = (userId) => {
        if (!window.confirm('Remove this participant?')) return;
        emit('kick-user', { roomId, userId });
    };

    const exportCanvas = (format) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `whiteboard-${roomId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (strokes.length > 0 && socket?.connected) {
                emit('save-canvas', { roomId, canvasData: { strokes, objects: [] } });
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [strokes, roomId, socket?.connected]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        emit('chat-message', { roomId, text: chatInput.trim() });
        setChatInput('');
        emit('typing', { roomId, isTyping: false });
    };

    const handleTyping = (e) => {
        setChatInput(e.target.value);
        emit('typing', { roomId, isTyping: e.target.value.length > 0 });
    };

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await api.post(`/files/${roomId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setFiles(prev => [...prev, data.file]);
            emit('file-shared', { roomId, file: data.file });
        } catch (err) { alert('Upload failed'); }
    };

    const createPeerConnection = (targetId) => {
        if (peerConnections.current[targetId]) return peerConnections.current[targetId];
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.onicecandidate = (e) => { if (e.candidate) emit('ice-candidate', { roomId, candidate: e.candidate, to: targetId }); };
        pc.ontrack = (e) => { setRemoteStreams(prev => ({ ...prev, [targetId]: e.streams[0] })); };
        if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        peerConnections.current[targetId] = pc;
        return pc;
    };

    const toggleVideo = async () => {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            setLocalStream(null);
            Object.values(peerConnections.current).forEach(pc => pc.getSenders().forEach(sender => pc.removeTrack(sender)));
            emit('screen-share-stopped', { roomId });
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
                emit('screen-share-started', { roomId });
                participants.forEach(p => {
                    if (p.userId !== user._id) {
                        const pc = createPeerConnection(p.socketId || p.userId);
                        stream.getTracks().forEach(track => pc.addTrack(track, stream));
                        pc.createOffer().then(o => { pc.setLocalDescription(o); emit('screen-offer', { roomId, offer: o, to: p.socketId || p.userId }); });
                    }
                });
            } catch (err) { alert('Could not access camera'); }
        }
    };

    const saveVersion = async () => {
        try {
            emit('save-canvas', { roomId, canvasData: { strokes, objects: [] } });
            const { data } = await api.post(`/rooms/${roomId}/versions`, { label: `Snapshot ${versions.length + 1}` });
            setVersions(prev => [data.version, ...prev]);
        } catch (err) { }
    };

    const restoreVersion = async (versionId) => {
        if (!window.confirm('Restore this version?')) return;
        try {
            const { data } = await api.post(`/rooms/${roomId}/versions/${versionId}/restore`);
            if (data.room?.canvasData?.strokes) {
                setStrokes(data.room.canvasData.strokes);
                emit('clear-board', { roomId });
                data.room.canvasData.strokes.forEach(s => emit('draw', { roomId, stroke: s }));
            }
        } catch (err) { }
    };

    const handleExportMP4 = async () => {
        if (recording.length === 0) emit('get-recording', { roomId });
        await new Promise(r => setTimeout(r, 1000));
        if (recording.length === 0) return alert('No recording data');
        setIsExporting(true);
        const canvas = exportCanvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = canvasRef.current.width;
        canvas.height = canvasRef.current.height;
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `whiteboard-session.webm`;
            a.click();
            setIsExporting(false);
        };
        recorder.start();
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < recording.length; i++) {
            const event = recording[i];
            if (event.type === 'draw') drawStroke(ctx, event.data);
            else if (event.type === 'clear') { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillRect(0, 0, canvas.width, canvas.height); }
            setExportProgress(Math.round(((i + 1) / recording.length) * 100));
            if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
        }
        recorder.stop();
    };

    const cursorColors = ['#ff6b6b', '#6bcb77', '#4d96ff', '#fdcb6e', '#a29bfe', '#fd79a8', '#00cec9'];
    const getCursorColor = (userId) => cursorColors[userId.charCodeAt(0) % cursorColors.length];

    const handleWheel = (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const scaleFactor = Math.exp(wheel * zoomIntensity);
        const newScale = Math.min(Math.max(transform.scale * scaleFactor, 0.05), 20);
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setTransform(prev => ({ scale: newScale, x: mouseX - (mouseX - prev.x) * (newScale / prev.scale), y: mouseY - (mouseY - prev.y) * (newScale / prev.scale) }));
    };

    const RemoteVideo = ({ stream, userName }) => {
        const videoRef = useRef(null);
        useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);
        return (
            <div className="video-item remote">
                <video autoPlay playsInline ref={videoRef} />
                <div className="user-label">{userName}</div>
            </div>
        );
    };

    return (
        <div className="whiteboard-page">
            <div className="wb-top-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Room: {roomInfo?.roomId || roomId}</span>
                    <div className="participant-avatars" style={{ display: 'flex', gap: -8 }}>
                        {participants.slice(0, 3).map(p => (
                            <div key={p.userId} className="avatar" style={{ background: getCursorColor(p.userId || ''), width: 28, height: 28, fontSize: '0.75rem', marginLeft: '-8px', border: '2px solid var(--bg-card)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {p.userName?.charAt(0).toUpperCase() || '?'}
                            </div>
                        ))}
                        {participants.length > 3 && <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.75rem', marginLeft: '-8px', border: '2px solid var(--bg-card)', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{participants.length - 3}</div>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); }}><LinkIcon size={16} /> Share</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => exportCanvas('png')}><Download size={16} /> Export</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSidebarOpen(!sidebarOpen)}><MessageSquare size={16} /> Chat</button>
                </div>
            </div>

            <div className="wb-main-content">
                {myRole !== 'observer' && (
                    <div className="wb-left-sidebar">
                        {TOOLS.map(t => (
                            <button key={t.id} className={`tool-btn ${tool === t.id ? 'active' : ''}`} onClick={() => setTool(t.id)} title={t.label}>{t.icon}</button>
                        ))}
                        <div style={{ width: 32, height: 1, background: 'var(--border-color)', margin: '8px 0' }} />
                        <button className="tool-btn" onClick={handleUndo} title="Undo"><Undo2 size={20} /></button>
                        <button className="tool-btn" onClick={handleRedo} title="Redo"><Redo2 size={20} /></button>
                        {myRole === 'host' && <button className="tool-btn" onClick={handleClearBoard} title="Clear Board"><Trash2 size={20} /></button>}
                        <button className="tool-btn" onClick={toggleVideo} title={localStream ? 'Stop video' : 'Start video'} style={localStream ? { color: 'var(--accent-primary)' } : {}}>{localStream ? <VideoOff size={20} /> : <Video size={20} />}</button>
                    </div>
                )}

                <div className="wb-center-canvas" style={{
                    backgroundImage: gridEnabled ? 'radial-gradient(circle at 1px 1px, var(--border-color) 1.5px, transparent 0)' : 'none',
                    backgroundSize: '32px 32px'
                }}>
                    <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={handleMouseMove} onMouseUp={endDrawing} onMouseLeave={endDrawing} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={endDrawing} onWheel={handleWheel} style={{ cursor: tool === 'text' || tool === 'sticky' ? 'text' : 'crosshair' }} />
                    {activeEditor && (
                        <div className={`floating-editor-container ${activeEditor.tool}`} style={{ left: activeEditor.x * transform.scale + transform.x, top: activeEditor.y * transform.scale + transform.y, transform: `scale(${transform.scale})`, transformOrigin: 'top left' }}>
                            {activeEditor.tool === 'text' ? <input autoFocus className="text-tool-input" style={{ color, fontSize: brushSize * 5 }} onBlur={(e) => handleEditorSubmit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleEditorSubmit(e.target.value); if (e.key === 'Escape') setActiveEditor(null); }} /> : <textarea autoFocus className="sticky-tool-input" onBlur={(e) => handleEditorSubmit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setActiveEditor(null); }} />}
                        </div>
                    )}
                    {Object.entries(remoteCursors).map(([userId, { userName, x, y }]) => (
                        <div key={userId} className="remote-cursor" style={{ transform: `translate(${x * transform.scale + transform.x}px, ${y * transform.scale + transform.y}px)` }}>
                            <svg className="cursor-arrow" viewBox="0 0 16 20" fill={getCursorColor(userId)}><path d="M0 0L16 12L8 12L12 20L8 18L4 12L0 16Z" /></svg>
                            <span className="cursor-label" style={{ background: getCursorColor(userId) }}>{userName}</span>
                        </div>
                    ))}
                    <div className="wb-bottom-bar">
                        <button className="btn btn-ghost btn-sm" onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}>Reset Zoom ({(transform.scale * 100).toFixed(0)}%)</button>
                        <button className={`btn btn-ghost btn-sm ${gridEnabled ? 'active' : ''}`} onClick={() => setGridEnabled(!gridEnabled)}>Grid</button>
                    </div>
                    <div className="video-grid draggable" onPointerDown={handleVideoPointerDown} onPointerMove={handleVideoPointerMove} onPointerUp={handleVideoPointerUp} onPointerLeave={handleVideoPointerUp} style={{ left: videoPos.x, top: videoPos.y, position: 'absolute', cursor: isDraggingVideo ? 'grabbing' : 'grab' }}>
                        {localStream && <div className="video-item local"><video autoPlay playsInline muted ref={el => { if (el) el.srcObject = localStream; }} /><div className="user-label">You (Camera)</div></div>}
                        {screenStream && <div className="video-item local screen"><video autoPlay playsInline muted ref={el => { if (el) el.srcObject = screenStream; }} /><div className="user-label">You (Screen)</div></div>}
                        {Object.entries(remoteStreams).map(([socketId, s]) => <RemoteVideo key={socketId} stream={s} userName={participants.find(p => p.userId === socketId || p.socketId === socketId)?.userName || 'Remote'} />)}
                    </div>
                </div>

                {myRole !== 'observer' && (
                    <div className="wb-right-panel" style={{ padding: 16 }}>
                        <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Properties</h4>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Stroke Color</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {COLORS.map(c => <div key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }} />)}
                            </div>
                            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ marginTop: 8, width: '100%', height: 32, cursor: 'pointer', background: 'transparent', border: 'none' }} />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fill Color</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <div onClick={() => setFillColor('transparent')} style={{ width: 24, height: 24, borderRadius: '50%', background: 'transparent', cursor: 'pointer', border: fillColor === 'transparent' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}><PenOff size={16} /></div>
                                {COLORS.map(c => <div key={c} onClick={() => setFillColor(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: fillColor === c ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }} />)}
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Stroke Width ({brushSize}px)</label>
                            <input type="range" min="1" max="50" value={brushSize} onChange={e => setBrushSize(+e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Opacity ({opacity}%)</label>
                            <input type="range" min="10" max="100" value={opacity} onChange={e => setOpacity(+e.target.value)} style={{ width: '100%' }} />
                        </div>
                    </div>
                )}

                <div className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`} style={{ position: 'absolute', right: 0, height: '100%', zIndex: 100 }}>
                    <div className="sidebar-tabs">
                        <button className={`sidebar-tab ${sidebarTab === 'chat' ? 'active' : ''}`} onClick={() => setSidebarTab('chat')}><MessageSquare size={20} /></button>
                        <button className={`sidebar-tab ${sidebarTab === 'people' ? 'active' : ''}`} onClick={() => setSidebarTab('people')}><Users size={20} /></button>
                        <button className={`sidebar-tab ${sidebarTab === 'files' ? 'active' : ''}`} onClick={() => setSidebarTab('files')}><Folder size={20} /></button>
                        <button className={`sidebar-tab ${sidebarTab === 'history' ? 'active' : ''}`} onClick={() => setSidebarTab('history')}><Clock size={20} /></button>
                        <button className="sidebar-tab" onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
                    </div>
                    <div className="sidebar-content">
                        {sidebarTab === 'chat' && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="chat-messages" style={{ flex: 1, overflowY: 'auto' }}>
                                    {messages.map((msg, i) => (
                                        <div key={msg._id || i} className={`chat-message ${msg.type === 'system' ? 'system' : ''}`}>
                                            {msg.type === 'system' ? <div className="msg-text">{msg.text}</div> : (
                                                <><div className="msg-header"><span className="msg-user">{msg.userName}</span><span className="msg-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><div className="msg-text">{msg.text}</div></>
                                            )}
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                                {typingUsers.length > 0 && <div className="typing-indicator">{typingUsers.join(', ')} typing...</div>}
                                <form className="chat-input-area" onSubmit={sendMessage}>
                                    <input className="input" placeholder="Type a message..." value={chatInput} onChange={handleTyping} />
                                    <button type="submit" className="btn btn-primary btn-sm">Send</button>
                                </form>
                            </div>
                        )}
                        {sidebarTab === 'people' && (
                            <div className="participant-list">
                                <div className="section-header"><span>{participants.length} online</span>{myRole === 'host' && <div className="host-controls-mini"><button className={`btn-icon-sm ${roomInfo?.isLocked ? 'active' : ''}`} onClick={handleToggleLock} title="Toggle Lock"><Lock size={16} /></button><button className={`btn-icon-sm ${roomInfo?.drawingEnabled ? 'active' : ''}`} onClick={handleToggleDrawing} title="Toggle Drawing"><Pencil size={16} /></button></div>}</div>
                                {participants.map((p, i) => (
                                    <div key={i} className="participant-item">
                                        <div className="avatar" style={{ background: getCursorColor(p.userId || '') }}>{p.userName?.charAt(0).toUpperCase() || '?'}</div>
                                        <div className="info"><div className="name">{p.userName}{p.userId === user._id ? ' (you)' : ''}</div><div className="role">{p.role === 'host' ? 'Host' : 'Participant'}</div></div>
                                        {myRole === 'host' && p.userId !== user._id && <button className="kick-btn" onClick={() => handleKick(p.userId)} title="Kick"><UserX size={16} /></button>}
                                        <div className="online-dot" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {sidebarTab === 'files' && (
                            <div>
                                <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}><p>📂 Click or drag to upload</p><p style={{ fontSize: '0.75rem', marginTop: 4 }}>Images, PDFs up to 10MB</p></div>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,.pdf" />
                                <div className="file-list">{files.map((f, i) => <a key={f._id || i} href={f.url} target="_blank" rel="noopener noreferrer" className="file-item"><div className="file-icon">{f.mimeType?.startsWith('image') ? '🖼️' : '📄'}</div><div className="file-info"><div className="file-name">{f.originalName || f.filename}</div><div className="file-meta">{f.uploaderName}</div></div></a>)}</div>
                            </div>
                        )}
                        {sidebarTab === 'history' && (
                            <div><button className="btn btn-secondary btn-sm" onClick={saveVersion} style={{ marginBottom: 16, width: '100%' }}>📸 Save Snapshot</button><div className="version-list">{versions.map((v, i) => <div key={v._id || i} className="version-item"><div className="version-info"><div className="version-label">{v.label || `Version ${v.versionNumber}`}</div><div className="version-meta">{v.createdBy?.name}</div></div><button className="btn btn-ghost btn-sm" onClick={() => restoreVersion(v._id)}>Restore</button></div>)}</div></div>
                        )}
                    </div>
                </div>
            </div>
            <canvas ref={exportCanvasRef} style={{ display: 'none' }} />
            {isExporting && <ExportOverlay progress={exportProgress} total={recording.length} />}
        </div>
    );
};
