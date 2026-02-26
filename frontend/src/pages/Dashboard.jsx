import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // room to delete
    const [roomName, setRoomName] = useState('');
    const [roomPassword, setRoomPassword] = useState('');
    const [joinId, setJoinId] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent'); // recent, name, participants
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    useEffect(() => {
        fetchRooms();
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const showToast = (message, type = 'success') => setToast({ message, type });

    const fetchRooms = async () => {
        try {
            const { data } = await api.get('/rooms');
            setRooms(data.rooms);
        } catch (err) {
            showToast('Failed to load rooms', 'error');
        } finally { setLoading(false); }
    };

    const createRoom = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const { data } = await api.post('/rooms', { name: roomName, password: roomPassword || undefined });
            setShowCreate(false);
            setRoomName(''); setRoomPassword('');
            showToast(`Room "${data.room.name}" created!`);
            navigate(`/room/${data.room.roomId}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create room');
        }
    };

    const joinRoom = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const { data } = await api.post(`/rooms/${joinId.toUpperCase()}/join`, { password: joinPassword || undefined });
            setShowJoin(false);
            setJoinId(''); setJoinPassword('');
            navigate(`/room/${data.room.roomId}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to join room');
        }
    };

    const enterRoom = async (roomId, hasPassword) => {
        try {
            await api.post(`/rooms/${roomId}/join`);
            navigate(`/room/${roomId}`);
        } catch (err) {
            const msg = err.response?.data?.message;
            if (msg === 'Password required for this room' || hasPassword) {
                setJoinId(roomId);
                setShowJoin(true);
                setError('This room requires a password.');
            } else {
                showToast(msg || 'Failed to enter room', 'error');
            }
        }
    };

    const leaveRoom = async (e, roomId, roomName) => {
        e.stopPropagation();
        try {
            await api.post(`/rooms/${roomId}/leave`);
            setRooms(prev => prev.filter(r => r.roomId !== roomId));
            showToast(`Left room "${roomName}"`);
        } catch (err) {
            showToast('Failed to leave room', 'error');
        }
    };

    const confirmDeleteRoom = (e, room) => {
        e.stopPropagation();
        setShowDeleteConfirm(room);
        setDeleteConfirmText('');
    };

    const deleteRoom = async () => {
        if (!showDeleteConfirm) return;
        const roomId = showDeleteConfirm.roomId;
        const name = showDeleteConfirm.name;
        try {
            await api.delete(`/rooms/${roomId}`);
            setRooms(prev => prev.filter(r => r.roomId !== roomId));
            setShowDeleteConfirm(null);
            setDeleteConfirmText('');
            showToast(`Room "${name}" permanently deleted`, 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to delete room', 'error');
        }
    };

    const copyRoomId = (e, roomId) => {
        e.stopPropagation();
        navigator.clipboard.writeText(roomId).then(() => {
            showToast(`Room ID "${roomId}" copied!`);
        }).catch(() => {
            showToast('Failed to copy', 'error');
        });
    };

    // ─── Filtering & Sorting ───
    const filteredRooms = rooms
        .filter(room => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return room.name.toLowerCase().includes(q) ||
                room.roomId.toLowerCase().includes(q) ||
                room.host?.name?.toLowerCase().includes(q);
        })
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'participants') return (b.participants?.length || 0) - (a.participants?.length || 0);
            return new Date(b.updatedAt) - new Date(a.updatedAt); // recent
        });

    const isHost = (room) => room.host?._id === user?._id || room.host === user?._id;
    const timeAgo = (date) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    return (
        <div className="page fade-in">
            {/* ── Toast Notification ── */}
            {toast && (
                <div className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>
                    <span>{toast.type === 'error' ? '❌' : '✅'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* ── Dashboard Header ── */}
            <div className="dashboard-header">
                <div>
                    <h1>Welcome, {user?.name} 👋</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {rooms.length} room{rooms.length !== 1 ? 's' : ''} • Create or join a whiteboard to start collaborating
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" onClick={() => setShowJoin(true)}>🔗 Join Room</button>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>✨ Create Room</button>
                </div>
            </div>

            {/* ── Search & Filter Bar ── */}
            {rooms.length > 0 && (
                <div className="search-bar-container">
                    <div className="search-input-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            className="input search-input"
                            placeholder="Search rooms by name, ID, or host..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
                        )}
                    </div>
                    <div className="sort-controls">
                        <label className="sort-label">Sort:</label>
                        {['recent', 'name', 'participants'].map(s => (
                            <button key={s} className={`btn btn-ghost btn-sm ${sortBy === s ? 'active' : ''}`}
                                onClick={() => setSortBy(s)}>
                                {s === 'recent' ? '🕐 Recent' : s === 'name' ? '🔤 Name' : '👥 People'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Room Grid ── */}
            {loading ? (
                <div className="loading-center"><div className="spinner"></div></div>
            ) : filteredRooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎨</div>
                    <h3>{searchQuery ? 'No rooms match your search' : 'No rooms yet'}</h3>
                    <p>{searchQuery ? 'Try a different search term' : 'Create your first whiteboard room to get started!'}</p>
                </div>
            ) : (
                <div className="rooms-grid">
                    {filteredRooms.map(room => (
                        <div key={room._id} className="card room-card" onClick={() => enterRoom(room.roomId, !!room.password)}>
                            {/* Badges */}
                            <div className="room-badges">
                                {isHost(room) && <span className="badge badge-accent">👑 Host</span>}
                                {room.participants?.length > 0 && (
                                    <span className="live-indicator">
                                        <span className="live-dot"></span>
                                        Live
                                    </span>
                                )}
                                {room.isLocked && <span className="badge badge-warning">🔒 Locked</span>}
                                {room.password && !room.isLocked && <span className="badge badge-warning">🔑</span>}
                            </div>

                            {/* Room Actions (stop propagation) */}
                            <div className="room-actions">
                                <button className="btn-icon-sm" title="Copy Room ID" onClick={e => copyRoomId(e, room.roomId)}>📋</button>
                                {!isHost(room) && (
                                    <button className="btn-icon-sm" title="Leave Room" onClick={e => leaveRoom(e, room.roomId, room.name)}>🚪</button>
                                )}
                                {isHost(room) && (
                                    <button className="btn-icon-sm btn-danger-icon" title="Delete Room" onClick={e => confirmDeleteRoom(e, room)}>🗑️</button>
                                )}
                            </div>

                            <div className="room-name">{room.name}</div>
                            <div className="room-meta">
                                <span>👤 {room.host?.name || 'Unknown'}</span>
                                <span>👥 {room.participants?.length || 0}</span>
                                <span>🕐 {timeAgo(room.updatedAt)}</span>
                            </div>
                            <div className="room-id" title="Click copy button to copy">
                                <span className="room-id-label">ID:</span> {room.roomId}
                            </div>
                            {room.participants?.length > 0 && (
                                <div className="room-participants">
                                    {room.participants.slice(0, 5).map((p, i) => (
                                        <div key={i} className="avatar" title={p.user?.name}>
                                            {p.user?.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                    ))}
                                    {room.participants.length > 5 && (
                                        <div className="avatar" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                            +{room.participants.length - 5}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Create Room Modal ── */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="card modal" onClick={e => e.stopPropagation()}>
                        <h2>✨ Create Room</h2>
                        {error && <div className="auth-error">{error}</div>}
                        <form onSubmit={createRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="input-group">
                                <label>Room Name</label>
                                <input className="input" placeholder="My Awesome Whiteboard"
                                    value={roomName} onChange={e => setRoomName(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>Password (optional)</label>
                                <input type="password" className="input" placeholder="Leave blank for public room"
                                    value={roomPassword} onChange={e => setRoomPassword(e.target.value)} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Room</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Join Room Modal ── */}
            {showJoin && (
                <div className="modal-overlay" onClick={() => setShowJoin(false)}>
                    <div className="card modal" onClick={e => e.stopPropagation()}>
                        <h2>🔗 Join Room</h2>
                        {error && <div className="auth-error">{error}</div>}
                        <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="input-group">
                                <label>Room ID</label>
                                <input className="input" placeholder="e.g. A1B2C3D4" style={{ fontFamily: 'monospace', letterSpacing: 2 }}
                                    value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())} required />
                            </div>
                            <div className="input-group">
                                <label>Password (if required)</label>
                                <input type="password" className="input" placeholder="Enter room password"
                                    value={joinPassword} onChange={e => setJoinPassword(e.target.value)} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowJoin(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Join Room</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="card modal modal-danger" onClick={e => e.stopPropagation()}>
                        <div className="delete-icon">🗑️</div>
                        <h2>Delete Room</h2>
                        <p className="delete-warning">
                            This will <strong>permanently delete</strong> the room <strong>"{showDeleteConfirm.name}"</strong> and all associated data:
                        </p>
                        <ul className="delete-list">
                            <li>All chat messages</li>
                            <li>All shared files & uploads</li>
                            <li>All version snapshots</li>
                            <li>All whiteboard data</li>
                            <li>Active users will be disconnected</li>
                        </ul>
                        <div className="input-group">
                            <label>Type <strong>{showDeleteConfirm.name}</strong> to confirm:</label>
                            <input
                                className="input input-danger"
                                placeholder={showDeleteConfirm.name}
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
                            <button
                                className="btn btn-danger"
                                disabled={deleteConfirmText !== showDeleteConfirm.name}
                                onClick={deleteRoom}
                            >
                                🗑️ Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
