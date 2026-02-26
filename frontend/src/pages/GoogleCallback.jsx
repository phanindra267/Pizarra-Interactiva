import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GoogleCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        // The backend has already set the HTTP-only cookies.
        // We just need a short delay to ensure cookies are processed before navigating.
        const timer = setTimeout(() => {
            navigate('/dashboard');
        }, 1500);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
                <h2>Securing your session...</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Please wait while we authenticate you with Google.</p>
            </div>
        </div>
    );
}
