'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const BASE_KEY = 'fnce_tours_completed';

// Returns a per-user storage key so each user gets their own tour state
async function getKey() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user ? `${BASE_KEY}_${user.id}` : BASE_KEY;
    } catch {
        return BASE_KEY;
    }
}

export function useOnboarding(section) {
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        getKey().then(key => {
            try {
                const completed = JSON.parse(localStorage.getItem(key) || '{}');
                if (!completed[section]) setIsActive(true);
            } catch {
                setIsActive(true);
            }
        });
    }, [section]);

    async function complete() {
        const key = await getKey();
        try {
            const completed = JSON.parse(localStorage.getItem(key) || '{}');
            completed[section] = true;
            localStorage.setItem(key, JSON.stringify(completed));
        } catch {}
        setIsActive(false);
    }

    async function reset() {
        const key = await getKey();
        try {
            const completed = JSON.parse(localStorage.getItem(key) || '{}');
            delete completed[section];
            localStorage.setItem(key, JSON.stringify(completed));
        } catch {}
        setIsActive(true);
    }

    return { isActive, complete, skip: complete, reset };
}
