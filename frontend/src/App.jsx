import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Whiteboard from './pages/Whiteboard';
import Analytics from './pages/Analytics';
import GoogleCallback from './pages/GoogleCallback';
import Header from './components/Header';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;
    return user ? children : <Navigate to="/login" />;
}

function GuestRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;
    return !user ? children : <Navigate to="/dashboard" />;
}

function AppRoutes() {
    const { user } = useAuth();
    return (
        <>
            {user && <Header />}
            <Routes>
                <Route path="/" element={<GuestRoute><Landing /></GuestRoute>} />
                <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/room/:roomId" element={<ProtectedRoute><Whiteboard /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/auth/success" element={<GoogleCallback />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <AppRoutes />
                </BrowserRouter>
            </ThemeProvider>
        </AuthProvider>
    );
}
