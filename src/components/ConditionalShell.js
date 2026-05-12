'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import PinLock from './PinLock';
import AppTutorial from './AppTutorial';
import { TopbarProvider, TopbarLayout } from './TopbarContext';
import { isPinEnabled, isUnlocked, lockSession } from '@/lib/pinAuth';

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

export default function ConditionalShell({ children }) {
    const pathname = usePathname();
    const [authChecked, setAuthChecked] = useState(false);
    const [locked, setLocked] = useState(false);
    const inactivityTimer = useRef(null);

    const lock = useCallback(() => {
        if (isPinEnabled()) {
            lockSession();
            setLocked(true);
        }
    }, []);

    const resetTimer = useCallback(() => {
        if (!isPinEnabled()) return;
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(lock, INACTIVITY_MS);
    }, [lock]);

    useEffect(() => {
        if (isPinEnabled() && !isUnlocked()) {
            setLocked(true);
        }
        setAuthChecked(true);
    }, []);

    // Inactivity tracking — only when PIN is enabled and app is unlocked
    useEffect(() => {
        if (!authChecked || locked || !isPinEnabled()) return;

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
        resetTimer(); // start timer immediately

        return () => {
            events.forEach(e => window.removeEventListener(e, resetTimer));
            clearTimeout(inactivityTimer.current);
        };
    }, [authChecked, locked, resetTimer]);

    // Public routes — no shell
    if (pathname === '/login' || pathname === '/' || pathname === '/onboarding' ||
        pathname === '/terms' || pathname === '/privacy' ||
        pathname.startsWith('/analyze') || pathname.startsWith('/auth/') ||
        pathname.startsWith('/paywall')) {
        return <>{children}</>;
    }

    if (!authChecked) return null;

    if (locked) {
        return <PinLock onUnlock={() => setLocked(false)} />;
    }

    return (
        <div className="app-layout">
            <TopbarProvider>
                <Sidebar />
                <TopbarLayout>{children}</TopbarLayout>
                <BottomNav />
                <AppTutorial />
            </TopbarProvider>
        </div>
    );
}
