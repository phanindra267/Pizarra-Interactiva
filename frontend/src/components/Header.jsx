import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon, BarChart2 } from 'lucide-react';
import { disconnectSocket } from '../hooks/useSocket';

export default function Header() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleLogout = () => {
        disconnectSocket();
        logout();
        navigate('/login');
    };

    return (
        <header className="app-header glass-panel">
            <Link to="/dashboard" className="logo hover-lift">
                <Hexagon size={24} className="logo-icon-svg" strokeWidth={2.5} />
                Pizarra Interactiva
            </Link>
            <div className="header-actions">
                <Link to="/analytics" className="btn btn-ghost btn-sm hover-lift press-scale" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BarChart2 size={16} /> Analytics</Link>
                <div
                    className={`theme-toggle ${theme} press-scale`}
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                />
                <div className="header-user hover-lift press-scale" onClick={handleLogout} title="Click to logout">
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} className="avatar" />
                    ) : (
                        <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</span>
                </div>
            </div>
        </header>
    );
}
