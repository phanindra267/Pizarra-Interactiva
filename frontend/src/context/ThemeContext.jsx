import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const auth = useAuth();
    const { user, token } = auth || {};
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Sync with backend if user is authenticated
        if (token && user && user.themePreference !== theme) {
            api.put('/auth/profile', { themePreference: theme }).catch(() => { });
        }
    }, [theme, token, user]);

    const toggleTheme = () => {
        // Prevent body transitions during switch for a cleaner look if desired
        // document.body.classList.add('theme-transitioning');
        setTheme(t => t === 'dark' ? 'light' : 'dark');
        // setTimeout(() => document.body.classList.remove('theme-transitioning'), 400);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;

