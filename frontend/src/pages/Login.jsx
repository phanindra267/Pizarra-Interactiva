import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

        setError('');
        setLoading(true);

        try {
            await login(email.trim(), password);
            navigate('/dashboard');
        } catch (err) {
            if (err.response) {
                setError(err.response.data?.message || 'Invalid credentials');
            } else {
                setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        if (loading) return;

        setError('');
        setLoading(true);

        try {
            // 👇 Change these credentials to your demo account
            await login('demo@dealer.com', 'demo123');
            navigate('/dashboard');
        } catch (err) {
            setError('Demo login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card card">
                <div className="logo-large">
                    <Hexagon size={32} className="logo-icon-svg" strokeWidth={2} />
                    Pizarra Interactiva
                </div>

                <h1>Welcome Back 👋</h1>
                <p>Sign in to continue to your whiteboard</p>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => {
                                setEmail(e.target.value);
                                if (error) setError('');
                            }}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="input"
                            placeholder="Enter your password"
                            value={password}
                            onChange={e => {
                                setPassword(e.target.value);
                                if (error) setError('');
                            }}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary hover-lift press-scale"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    {/* 🚀 Demo Account Button */}
                    <button
                        type="button"
                        className="btn btn-secondary hover-lift press-scale"
                        style={{ width: '100%', marginTop: '10px' }}
                        onClick={handleDemoLogin}
                        disabled={loading}
                    >
                        🚀 Try Demo Dealer Account
                    </button>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        margin: '20px 0'
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                    </div>

                    <a
                        href="/api/auth/google"
                        className="btn btn-google hover-lift press-scale"
                        style={{ width: '100%' }}
                    >
                        <img
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            alt="Google"
                        />
                        Continue with Google
                    </a>
                </form>

                <div className="auth-link">
                    Don't have an account? <Link to="/register">Create one</Link>
                </div>
            </div>
        </div>
    );
}
