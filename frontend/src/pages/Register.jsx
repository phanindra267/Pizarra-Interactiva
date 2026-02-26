import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await register(name, email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <div className="auth-card card">
                <div className="logo-large">
                    <Hexagon size={32} className="logo-icon-svg" strokeWidth={2} />
                    Pizarra Interactiva
                </div>
                <h1>Create Account</h1>
                <p>Start collaborating on whiteboards in real time</p>
                {error && <div className="auth-error">{error}</div>}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Full Name</label>
                        <input type="text" className="input" placeholder="John Doe"
                            value={name} onChange={e => setName(e.target.value)} required minLength={2} />
                    </div>
                    <div className="input-group">
                        <label>Email</label>
                        <input type="email" className="input" placeholder="you@example.com"
                            value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input type="password" className="input" placeholder="At least 6 characters"
                            value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                    </div>
                    <button type="submit" className="btn btn-primary hover-lift press-scale" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                    </div>
                    <a href="/api/auth/google" className="btn btn-google hover-lift press-scale" style={{ width: '100%' }}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                        Continue with Google
                    </a>
                </form>
                <div className="auth-link">
                    Already have an account? <Link to="/login">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
