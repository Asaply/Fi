import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PENDING_ANALYSIS_KEY, analysisToTransactionRows } from '@/lib/pendingAnalysis';

/**
 * Saves the free analysis done at /analyze (before signup) into the
 * authenticated user's transactions, then clears it from sessionStorage.
 * @param {string|null|undefined} userId
 * @param {(count: number) => void} [onClaimed] called after a successful insert
 */
export function useClaimPendingAnalysis(userId, onClaimed) {
    const onClaimedRef = useRef(onClaimed);
    onClaimedRef.current = onClaimed;

    useEffect(() => {
        if (!userId) return;

        const raw = sessionStorage.getItem(PENDING_ANALYSIS_KEY);
        if (!raw) return;
        // Take it before the async insert so a double mount can't insert twice.
        sessionStorage.removeItem(PENDING_ANALYSIS_KEY);

        let analysis;
        try {
            analysis = JSON.parse(raw);
        } catch {
            return;
        }

        const rows = analysisToTransactionRows(analysis, userId);
        if (rows.length === 0) return;

        supabase.from('transactions').insert(rows).then(({ error }) => {
            if (error) {
                console.error('[useClaimPendingAnalysis]', error);
                sessionStorage.setItem(PENDING_ANALYSIS_KEY, raw);
                return;
            }
            onClaimedRef.current?.(rows.length);
        });
    }, [userId]);
}
