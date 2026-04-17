'use client';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'fnce_tour_completed';

function getCompleted() {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function setCompleted(section) {
    if (typeof window === 'undefined') return;
    try {
        const current = getCompleted();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [section]: true }));
    } catch {}
}

function clearCompleted(section) {
    if (typeof window === 'undefined') return;
    try {
        const current = getCompleted();
        delete current[section];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {}
}

export function useOnboarding(section) {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const completed = getCompleted();
        if (!completed[section]) {
            setIsActive(true);
        }
    }, [section]);

    const next = useCallback((totalSteps) => {
        setCurrentStep(s => {
            if (s + 1 >= totalSteps) return s;
            return s + 1;
        });
    }, []);

    const complete = useCallback(() => {
        setCompleted(section);
        setIsActive(false);
        setCurrentStep(0);
    }, [section]);

    const skip = useCallback(() => {
        setCompleted(section);
        setIsActive(false);
        setCurrentStep(0);
    }, [section]);

    const resetTour = useCallback(() => {
        clearCompleted(section);
        setCurrentStep(0);
        setIsActive(true);
    }, [section]);

    return { isActive, currentStep, next, skip, complete, resetTour };
}
