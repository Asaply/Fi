'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import Topbar from './Topbar';

const TopbarContext = createContext();

export function TopbarProvider({ children }) {
    const [profilePic, setProfilePic] = useState(null);
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        try {
            const savedPic = localStorage.getItem('fnce_profile_pic');
            if (savedPic) setProfilePic(savedPic);

            const savedTheme = localStorage.getItem('fnce-theme') || 'dark';
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } catch (_) {}
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        try { localStorage.setItem('fnce-theme', newTheme); } catch (_) {}
    };

    return (
        <TopbarContext.Provider value={{ profilePic, setProfilePic, theme, toggleTheme }}>
            {children}
        </TopbarContext.Provider>
    );
}

export function useTopbar() {
    return useContext(TopbarContext);
}

export function TopbarLayout({ children }) {
    return (
        <div className="main-area">
            <Topbar />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
