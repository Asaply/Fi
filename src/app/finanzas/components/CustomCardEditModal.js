// Edit modal for a custom summary card, optionally linked to a Meta.
// Extracted from src/app/finanzas/page.js; state and handlers stay in the page.
import { Check, Wallet } from 'lucide-react';
import CurrencyInput from '@/components/CurrencyInput';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';

export default function CustomCardEditModal({
    budgetPaid,
    budgets,
    customCardForm,
    featuredMetaId,
    formatCurrency,
    isEditingCustomCard,
    linkMeta,
    router,
    setCustomCardForm,
    setIsEditingCustomCard,
    setUserConfig,
}) {
    return (
        <Modal isOpen={isEditingCustomCard} onClose={() => setIsEditingCustomCard(false)} title="Editar tarjeta personalizada">
            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={async (e) => {
                e.preventDefault();
                const { data: { user } } = await supabase.auth.getUser();
                const newLabel = customCardForm.label.trim() || 'Por Cobrar';
                const newMonto = parseFloat(customCardForm.monto) || 0;
                const { error } = await supabase.from('user_config').upsert({
                    user_id: user.id,
                    concepto_custom_label: newLabel,
                    concepto_custom_total: newMonto,
                }, { onConflict: 'user_id' });
                if (!error) {
                    setUserConfig({ concepto_custom_label: newLabel, concepto_custom_total: newMonto });
                    setIsEditingCustomCard(false);
                } else {
                    console.error('Error saving user_config:', error?.message);
                }
            }}>
                {/* Vincular una meta de la sección Metas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Vincular una meta</label>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--text-primary)' }} onClick={() => router.push('/budgets')}>
                            Administrar metas
                        </button>
                    </div>
                    {budgets.length === 0 ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                            No tienes metas aún. Créalas en la sección Metas y aparecerán aquí para mostrarlas en esta tarjeta.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button type="button" onClick={() => linkMeta(null)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', background: !featuredMetaId ? 'rgba(255,255,255,0.08)' : 'transparent', border: `1px solid ${!featuredMetaId ? 'rgba(255,255,255,0.25)' : 'var(--border-color)'}`, color: 'var(--text-primary)', fontSize: '13px' }}>
                                <Wallet size={15} /> Concepto manual (sin meta)
                            </button>
                            {budgets.map(b => {
                                const sel = String(featuredMetaId) === String(b.id);
                                const paid = budgetPaid[b.id] || 0;
                                const tgt = Number(b.target_amount) || 0;
                                const pct = tgt > 0 ? Math.min(100, (paid / tgt) * 100) : 0;
                                return (
                                    <button key={b.id} type="button" onClick={() => linkMeta(b.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', background: sel ? `${b.color || '#fbbf24'}22` : 'transparent', border: `1px solid ${sel ? (b.color || '#fbbf24') : 'var(--border-color)'}`, color: 'var(--text-primary)' }}>
                                        <span style={{ fontSize: '16px', lineHeight: 1 }}>{b.icon || '🎯'}</span>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
                                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>{pct.toFixed(0)}% · {formatCurrency(paid)} de {formatCurrency(tgt)}</span>
                                        </span>
                                        {sel && <Check size={15} style={{ color: b.color || '#fbbf24' }} />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ height: '1px', background: 'var(--border-color)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: featuredMetaId ? 0.5 : 1 }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Nombre del concepto</label>
                    <input type="text" className="select-filter" style={{ width: '100%' }} placeholder="Ej: Ahorro, Por Cobrar, Meta..." value={customCardForm.label} onChange={e => setCustomCardForm(p => ({ ...p, label: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Monto</label>
                    <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={customCardForm.monto} onChange={e => setCustomCardForm(p => ({ ...p, monto: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsEditingCustomCard(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary">Guardar</button>
                </div>
            </form>
        </Modal>
    );
}
