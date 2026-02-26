import { useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

let socketInstance = null;

export function useSocket() {
    const socketRef = useRef(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;
        if (!socketInstance) {
            socketInstance = io('/', {
                transports: ['websocket', 'polling'],
                withCredentials: true,
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10
            });
        }
        socketRef.current = socketInstance;

        return () => {
            // Don't disconnect on unmount
        };
    }, [user]);

    const emit = useCallback((event, data) => {
        if (socketRef.current) socketRef.current.emit(event, data);
    }, []);

    const on = useCallback((event, handler) => {
        if (socketRef.current) socketRef.current.on(event, handler);
    }, []);

    const off = useCallback((event, handler) => {
        if (socketRef.current) socketRef.current.off(event, handler);
    }, []);

    return { socket: socketRef.current, emit, on, off };
}

export function disconnectSocket() {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
}
