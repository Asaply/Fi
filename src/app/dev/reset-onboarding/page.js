'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ResetOnboardingPage() {
    const [status, setStatus] = useState('');
    const router = useRouter();

    async function handleReset() {
        setStatus('Resetting...');
        try {
            // Clear localStorage flags
            localStorage.removeItem('fnce_onboarding_v1');
            localStorage.removeItem('fnce_primary_use');

            // Clear Supabase user metadata
            const { error } = await supabase.auth.updateUser({
                data: { onboarded: false, subscription_status: null, subscription_source: null, subscription_expires_at: null },
            });

            if (error) throw error;
            setStatus('Done. Redirecting to onboarding...');
            setTimeout(() => router.push('/onboarding'), 800);
        } catch (err) {
            setStatus('Error: ' + err.message);
        }
    }

    async function handleResetPaywall() {
        setStatus('Resetting paywall only...');
        try {
            const { error } = await supabase.auth.updateUser({
                data: { subscription_status: null, subscription_source: null, subscription_expires_at: null },
            });
            if (error) throw error;
            setStatus('Paywall reset. Redirecting to paywall...');
            setTimeout(() => router.push('/paywall'), 800);
        } catch (err) {
            setStatus('Error: ' + err.message);
        }
    }

    return (
        <div style={{ padding: '40px', fontFamily: 'monospace', background: '#000', minHeight: '100vh', color: '#fff' }}>
            <h1 style={{ color: '#FF6600', marginBottom: '8px' }}>Dev: Reset Onboarding</h1>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '32px' }}>
                Limpia localStorage + Supabase metadata para probar el onboarding de nuevo.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px' }}>
                <button
                    onClick={handleReset}
                    style={{ padding: '12px 20px', background: '#FF6600', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                >
                    Reset completo → /onboarding
                </button>

                <button
                    onClick={handleResetPaywall}
                    style={{ padding: '12px 20px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                >
                    Solo reset paywall → /paywall
                </button>
            </div>

            {status && (
                <p style={{ marginTop: '24px', color: status.startsWith('Error') ? '#ef4444' : '#22c55e', fontSize: '14px' }}>
                    {status}
                </p>
            )}
        </div>
    );
}
