'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Topbar from './Topbar';

const TopbarContext = createContext();

export function TopbarProvider({ children }) {
    const [profilePic, setProfilePicState] = useState(null);
    const [theme, setTheme] = useState('dark');
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUserId(user.id);
                try {
                    const savedPic = localStorage.getItem(`fnce_profile_pic_${user.id}`);
                    if (savedPic) setProfilePicState(savedPic);
                } catch (_) {}
            }
        });
        try {
            const savedTheme = localStorage.getItem('fnce-theme') || 'dark';
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } catch (_) {}
    }, []);

    const setProfilePic = (pic) => {
        setProfilePicState(pic);
        if (userId) {
            try { localStorage.setItem(`fnce_profile_pic_${userId}`, pic); } catch (_) {}
        }
    };

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
