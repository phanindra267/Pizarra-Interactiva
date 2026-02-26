import { Link } from 'react-router-dom';

export default function Landing() {
    return (
        <div className="landing fade-in">
            <header className="app-header glass-panel">
                <div className="logo hover-lift">
                    <span className="logo-icon">⬡</span>
                    Pizarra Interactiva
                </div>
                <div className="header-actions">
                    <Link to="/login" className="btn btn-ghost btn-sm hover-lift press-scale">Sign In</Link>
                    <Link to="/register" className="btn btn-primary btn-sm hover-lift press-scale">Get Started</Link>
                </div>
            </header>

            <section className="landing-hero slide-up">
                <div className="landing-badge">
                    <span>New</span> Matrix Zoom & MP4 Export
                </div>
                <h1>
                    Collaborate without<br />
                    <span className="gradient-text">Boundaries</span>
                </h1>
                <p className="subtitle">
                    The enterprise-grade real-time whiteboard for high-performance teams.
                    Built-in analytics, secure OAuth 2.0, and high-fidelity synchronization.
                </p>
                <div className="landing-cta">
                    <Link to="/register" className="btn btn-primary btn-lg hover-lift press-scale">Start for Free</Link>
                    <Link to="/login" className="btn btn-secondary btn-lg hover-lift press-scale">Live Demo</Link>
                </div>
            </section>

            <section className="landing-features">
                <div className="feature-card">
                    <div className="feature-icon">🎨</div>
                    <h3>Advanced Drawing Tools</h3>
                    <p>Pencil, brush, shapes, text, sticky notes, and eraser with customizable colors and sizes.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">⚡</div>
                    <h3>Real-Time Sync</h3>
                    <p>Ultra-low latency drawing synchronization with live cursors and presence indicators.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">💬</div>
                    <h3>Live Chat</h3>
                    <p>Built-in messaging with typing indicators, emoji reactions, and message history.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">📺</div>
                    <h3>Screen Sharing</h3>
                    <p>WebRTC-powered screen sharing with multi-peer support and host controls.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">🕐</div>
                    <h3>Version History</h3>
                    <p>Auto-save snapshots with one-click restore. Never lose your work again.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">📊</div>
                    <h3>Analytics Dashboard</h3>
                    <p>Monitor active rooms, user engagement, and platform metrics in real time.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">🔒</div>
                    <h3>Enterprise Security</h3>
                    <p>JWT auth, role-based access, encrypted rooms, rate limiting, and XSS protection.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">🎬</div>
                    <h3>Session Replay</h3>
                    <p>Record and replay entire whiteboard sessions with timeline control and speed adjustment.</p>
                </div>
            </section>
        </div>
    );
}
