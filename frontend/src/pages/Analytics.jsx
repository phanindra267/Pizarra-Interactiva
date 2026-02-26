import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Analytics() {
    const [stats, setStats] = useState(null);
    const [recentRooms, setRecentRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/analytics').then(({ data }) => {
            setStats(data.stats);
            setRecentRooms(data.recentRooms || []);
        }).catch(() => { }).finally(() => setLoading(false));
    }, []);

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (loading) return <div className="page"><div className="loading-center"><div className="spinner"></div></div></div>;

    const maxActivity = stats?.roomActivity ? Math.max(...stats.roomActivity.map(a => a.count), 1) : 1;

    return (
        <div className="page fade-in">
            <div className="analytics-header">
                <h1>📊 Analytics Dashboard</h1>
                <p>Platform-wide metrics and activity overview</p>
            </div>

            <div className="stats-grid">
                <div className="card stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats?.totalUsers || 0}</div>
                    <div className="stat-label">Total Users</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-icon">🟢</div>
                    <div className="stat-value">{stats?.activeRooms || 0}</div>
                    <div className="stat-label">Active Rooms</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-icon">💬</div>
                    <div className="stat-value">{stats?.totalMessages || 0}</div>
                    <div className="stat-label">Total Messages</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-icon">☁️</div>
                    <div className="stat-value">{formatSize(stats?.totalStorage)}</div>
                    <div className="stat-label">Local Storage</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-value">{stats?.avgParticipants?.toFixed(1) || 0}</div>
                    <div className="stat-label">Avg Participants</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-icon">🏠</div>
                    <div className="stat-value">{stats?.totalRooms || 0}</div>
                    <div className="stat-label">Total Rooms</div>
                </div>
            </div>

            <div className="analytics-section">
                <div className="card activity-card">
                    <h3>📈 Room Activity (Last 30 Days)</h3>
                    <div className="activity-chart">
                        {stats?.roomActivity?.map((a, i) => (
                            <div key={i} className="chart-bar-container">
                                <div className="chart-bar" style={{ height: `${(a.count / maxActivity) * 100}%` }}>
                                    <span className="bar-tooltip">{a.count} rooms on {a._id}</span>
                                </div>
                                <span className="bar-label">{a._id.split('-').slice(1).join('/')}</span>
                            </div>
                        ))}
                        {(!stats?.roomActivity || stats.roomActivity.length === 0) && (
                            <div style={{ padding: 40, color: 'var(--text-muted)' }}>No recent activity</div>
                        )}
                    </div>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3>Recent Active Rooms</h3>
                    </div>
                    {recentRooms.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No rooms yet</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="recent-rooms-table">
                                <thead>
                                    <tr><th>Room Name</th><th>Host</th><th>Participants</th><th>Status</th><th>Updated</th></tr>
                                </thead>
                                <tbody>
                                    {recentRooms.map(r => (
                                        <tr key={r._id}>
                                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                                            <td>{r.host?.name || '—'}</td>
                                            <td>{r.participants?.length || 0}</td>
                                            <td><span className={`badge ${r.isLocked ? 'badge-warning' : 'badge-success'}`}>{r.isLocked ? 'Locked' : 'Open'}</span></td>
                                            <td style={{ color: 'var(--text-muted)' }}>{new Date(r.updatedAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
