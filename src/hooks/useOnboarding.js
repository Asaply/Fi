'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'fnce_tours_completed';

export function useOnboarding(section) {
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        try {
            const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (!completed[section]) setIsActive(true);
        } catch { setIsActive(true); }
    }, [section]);

    function complete() {
        try {
            const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            completed[section] = true;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
        } catch {}
        setIsActive(false);
    }

    function reset() {
        try {
            const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            delete completed[section];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
        } catch {}
        setIsActive(true);
    }

    return { isActive, complete, skip: complete, reset };
}
