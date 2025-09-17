import { useState, useEffect, useCallback } from 'react';
import { type Session } from '../types';

const SESSION_STORAGE_KEY = 'defscribe-sessionHistory';

export const useSessionHistory = () => {
    const [sessions, setSessions] = useState<Session[]>(() => {
        try {
            const saved = localStorage.getItem(SESSION_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            console.warn("Could not parse session history from localStorage.");
            return [];
        }
    });

    useEffect(() => {
        try {
            // Prune old sessions if storage is getting full, keeping the 20 most recent.
            const sessionsToSave = sessions.slice(0, 20);
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionsToSave));
        } catch (e) {
            console.error("Failed to save sessions to localStorage", e);
        }
    }, [sessions]);

    const saveSession = useCallback((session: Session) => {
        setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)]);
    }, []);

    const deleteSession = useCallback((sessionId: string) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
    }, []);

    const getSession = useCallback((sessionId: string): Session | null => {
        return sessions.find(s => s.id === sessionId) || null;
    }, [sessions]);

    return { sessions, saveSession, deleteSession, getSession };
};
