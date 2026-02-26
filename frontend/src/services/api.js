import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
});

// Auto-refresh on 401
api.interceptors.response.use(
    res => res,
    async error => {
        const originalRequest = error.config;
        const url = originalRequest.url;

        // Don't intercept 401s for login, register, or refresh itself
        const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
            originalRequest._retry = true;
            try {
                // Refresh request will automatically send HTTP-only refreshToken cookie
                await axios.post('/api/auth/refresh', {}, { withCredentials: true });
                return api(originalRequest);
            } catch (err) {
                // If refresh fails, just reject. The UI/Router will handle it.
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
