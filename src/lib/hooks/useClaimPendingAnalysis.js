import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Claims the pending free analysis from sessionStorage and inserts it into
 * the transactions table for the given authenticated user.
 * Clears sessionStorage on success.
 * @param {string|null|undefined} userId
 */
export function useClaimPendingAnalysis(userId) {
    useEffect(() => {
        if (!userId) return;

        async function claim() {
            const raw = sessionStorage.getItem('nva_pending_analysis');
            if (!raw) return;

            let analysisData;
            try {
                analysisData = JSON.parse(raw);
            } catch {
                return;
            }

            const transactions = analysisData?.transactions;
            if (!Array.isArray(transactions) || transactions.length === 0) return;

            const rows = transactions.map(tx => ({
                fecha: tx.fecha,
                concepto: tx.concepto,
                monto: Number(tx.monto) || 0,
                tipo: tx.tipo,
                categoria: tx.categoria || 'Otros',
                banco: tx.banco || analysisData.bank || 'Desconocido',
                user_id: userId,
                imported_from: 'free_analysis',
            })).filter(r => r.monto > 0 && r.fecha);

            if (rows.length === 0) return;

            const { error } = await supabase.from('transactions').insert(rows);
            if (!error) {
                sessionStorage.removeItem('nva_pending_analysis');
            } else {
                console.error('[useClaimPendingAnalysis]', error);
            }
        }

        claim();
    }, [userId]);
}
