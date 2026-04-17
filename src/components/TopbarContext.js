'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import Topbar from './Topbar';

const TopbarContext = createContext();

export function TopbarProvider({ children }) {
    const [profilePic, setProfilePic] = useState(null);

    useEffect(() => {
        const savedPic = localStorage.getItem('fnce_profile_pic');
        if (savedPic) setProfilePic(savedPic);
    }, []);

    return (
        <TopbarContext.Provider value={{ profilePic, setProfilePic }}>
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
