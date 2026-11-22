'use client';
import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export function useTheme() {
    return useContext(ThemeContext);
}

export default function Providers({ children }) {
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        let active = true;
        let saved = null;
        try { saved = localStorage.getItem('unstuck-theme'); } catch { /* Theme remains usable when storage is blocked. */ }
        const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initial = saved || document.documentElement.dataset.theme || preferred;
        document.documentElement.dataset.theme = initial;
        queueMicrotask(() => { if (active) setTheme(initial); });
        return () => { active = false; };
    }, []);

    const value = useMemo(() => ({
        theme,
        toggleTheme() {
            setTheme((current) => {
                const next = current === 'dark' ? 'light' : 'dark';
                try { localStorage.setItem('unstuck-theme', next); } catch { /* Keep the in-memory preference for this visit. */ }
                document.documentElement.dataset.theme = next;
                return next;
            });
        },
    }), [theme]);

    return <ThemeContext.Provider value={value}><SessionProvider>{children}</SessionProvider></ThemeContext.Provider>;
}
