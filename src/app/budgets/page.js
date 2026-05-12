'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Check, Target } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';
import { toast } from 'sonner';
import './Budgets.css';

const COLORS = [
    { value: '#FF7A1A', label: 'Naranja' },
    { value: '#3b82f6', label: 'Azul' },
    { value: '#22c55e', label: 'Verde' },
    { value: '#a855f7', label: 'Violeta' },
    { value: '#ef4444', label: 'Rojo' },
    { value: '#06b6d4', label: 'Cian' },
    { value: '#f59e0b', label: 'Amarillo' },
    { value: '#ec4899', label: 'Rosa' },
];

const formatMXN = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (d) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';

export default function BudgetsPage() {
    const [budgets, setBudgets] = useState([]);
    const [payments, setPayments] = useState({}); // { budget_id: [payments] }
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({}); // { budget_id: bool }

    // Modals
    const [showNewBudget, setShowNewBudget] = useState(false);
    const [showPayment, setShowPayment] = useState(null); // budget object
    const [showDeleteBudget, setShowDeleteBudget] = useState(null);
    const [showDeletePayment, setShowDeletePayment] = useState(null); // { payment, budgetId }

    // Forms
    const [budgetForm, setBudgetForm] = useState({ name: '', target: '', color: '#FF7A1A', description: '' });
    const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const [{ data: bRows }, { data: pRows }] = await Promise.all([
            supabase.from('budgets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('budget_payments').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        ]);

        setBudgets(bRows || []);
        const byBudget = {};
        (pRows || []).forEach(p => {
            if (!byBudget[p.budget_id]) byBudget[p.budget_id] = [];
            byBudget[p.budget_id].push(p);
        });
        setPayments(byBudget);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    /* ── Create budget ── */
    const handleCreateBudget = async () => {
        if (!budgetForm.name.trim() || !budgetForm.target) return;
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('budgets').insert({
            user_id: user.id,
            name: budgetForm.name.trim(),
            target_amount: parseFloat(budgetForm.target),
            color: budgetForm.color,
            description: budgetForm.description.trim() || null,
        });
        setSaving(false);
        if (error) { toast.error('Error al crear el presupuesto.'); return; }
        toast.success('Presupuesto creado.');
        setShowNewBudget(false);
        setBudgetForm({ name: '', target: '', color: '#FF7A1A', description: '' });
        load();
    };

    /* ── Add payment ── */
    const handleAddPayment = async () => {
        if (!paymentForm.amount || !showPayment) return;
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('budget_payments').insert({
            budget_id: showPayment.id,
            user_id: user.id,
            amount: parseFloat(paymentForm.amount),
            date: paymentForm.date,
            note: paymentForm.note.trim() || null,
        });
        setSaving(false);
        if (error) { toast.error('Error al registrar el pago.'); return; }
        toast.success('Pago registrado.');
        setShowPayment(null);
        setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
        load();
    };

    /* ── Delete budget ── */
    const handleDeleteBudget = async () => {
        if (!showDeleteBudget) return;
        const { error } = await supabase.from('budgets').delete().eq('id', showDeleteBudget.id);
        if (error) { toast.error('Error al eliminar.'); return; }
        toast.success('Presupuesto eliminado.');
        setShowDeleteBudget(null);
        load();
    };

    /* ── Delete payment ── */
    const handleDeletePayment = async () => {
        if (!showDeletePayment) return;
        const { error } = await supabase.from('budget_payments').delete().eq('id', showDeletePayment.payment.id);
        if (error) { toast.error('Error al eliminar.'); return; }
        toast.success('Pago eliminado.');
        setShowDeletePayment(null);
        load();
    };

    const getPaid = (id) => (payments[id] || []).reduce((s, p) => s + Number(p.amount), 0);
    const getPct = (b) => Math.min(100, (getPaid(b.id) / b.target_amount) * 100);
    const isComplete = (b) => getPaid(b.id) >= b.target_amount;

    const active = budgets.filter(b => !isComplete(b));
    const completed = budgets.filter(b => isComplete(b));

    return (
        <div className="page-container budgets-page">
            {/* Header */}
            <div className="budgets-header">
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Presupuestos</h1>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Rastrea pagos hacia una meta financiera
                    </p>
                </div>
                <button className="btn-fin-primary" onClick={() => setShowNewBudget(true)}>
                    <Plus size={14} /> Nuevo
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2].map(i => <div key={i} className="skeleton card" style={{ height: '130px' }} />)}
                </div>
            ) : budgets.length === 0 ? (
                <div className="budgets-empty">
                    <Target size={40} strokeWidth={1.2} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-primary)' }}>Sin presupuestos</p>
                    <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Crea uno para rastrear pagos hacia una meta: deuda, ahorro, viaje…
                    </p>
                    <button className="btn-fin-primary" onClick={() => setShowNewBudget(true)}>
                        <Plus size={14} /> Crear presupuesto
                    </button>
                </div>
            ) : (
                <>
                    {active.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {active.map(b => (
                                <BudgetCard
                                    key={b.id}
                                    budget={b}
                                    payments={payments[b.id] || []}
                                    paid={getPaid(b.id)}
                                    pct={getPct(b)}
                                    expanded={!!expanded[b.id]}
                                    onToggle={() => setExpanded(e => ({ ...e, [b.id]: !e[b.id] }))}
                                    onPay={() => { setShowPayment(b); setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' }); }}
                                    onDelete={() => setShowDeleteBudget(b)}
                                    onDeletePayment={(p) => setShowDeletePayment({ payment: p, budgetId: b.id })}
                                />
                            ))}
                        </div>
                    )}

                    {completed.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ margin: '8px 0 0', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Check size={12} /> Completados
                            </p>
                            {completed.map(b => (
                                <BudgetCard
                                    key={b.id}
                                    budget={b}
                                    payments={payments[b.id] || []}
                                    paid={getPaid(b.id)}
                                    pct={100}
                                    complete
                                    expanded={!!expanded[b.id]}
                                    onToggle={() => setExpanded(e => ({ ...e, [b.id]: !e[b.id] }))}
                                    onPay={() => { setShowPayment(b); setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' }); }}
                                    onDelete={() => setShowDeleteBudget(b)}
                                    onDeletePayment={(p) => setShowDeletePayment({ payment: p, budgetId: b.id })}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── Modal: Nuevo presupuesto ── */}
            <Modal isOpen={showNewBudget} onClose={() => setShowNewBudget(false)} title="Nuevo presupuesto">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label className="form-label">Nombre *</label>
                        <input
                            className="form-input"
                            placeholder="Ej: Deuda de auto, Fondo de emergencia…"
                            value={budgetForm.name}
                            onChange={e => setBudgetForm(f => ({ ...f, name: e.target.value }))}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="form-label">Meta total *</label>
                        <input
                            className="form-input"
                            type="number"
                            placeholder="Ej: 120000"
                            value={budgetForm.target}
                            onChange={e => setBudgetForm(f => ({ ...f, target: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="form-label">Descripción (opcional)</label>
                        <input
                            className="form-input"
                            placeholder="Notas adicionales"
                            value={budgetForm.description}
                            onChange={e => setBudgetForm(f => ({ ...f, description: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="form-label">Color</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setBudgetForm(f => ({ ...f, color: c.value }))}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: c.value, border: 'none', cursor: 'pointer',
                                        outline: budgetForm.color === c.value ? `3px solid ${c.value}` : 'none',
                                        outlineOffset: '2px',
                                        transform: budgetForm.color === c.value ? 'scale(1.15)' : 'scale(1)',
                                        transition: 'all 0.15s',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button className="btn-fin-secondary" onClick={() => setShowNewBudget(false)}>Cancelar</button>
                        <button
                            className="btn-fin-primary"
                            onClick={handleCreateBudget}
                            disabled={saving || !budgetForm.name.trim() || !budgetForm.target}
                        >
                            {saving ? 'Guardando…' : 'Crear'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal: Agregar pago ── */}
            <Modal isOpen={!!showPayment} onClose={() => setShowPayment(null)} title={`Agregar pago · ${showPayment?.name || ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label className="form-label">Monto *</label>
                        <input
                            className="form-input"
                            type="number"
                            placeholder="Ej: 2500"
                            value={paymentForm.amount}
                            onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="form-label">Fecha</label>
                        <input
                            className="form-input"
                            type="date"
                            value={paymentForm.date}
                            onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="form-label">Nota (opcional)</label>
                        <input
                            className="form-input"
                            placeholder="Ej: Pago mensual mayo"
                            value={paymentForm.note}
                            onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn-fin-secondary" onClick={() => setShowPayment(null)}>Cancelar</button>
                        <button
                            className="btn-fin-primary"
                            onClick={handleAddPayment}
                            disabled={saving || !paymentForm.amount}
                        >
                            {saving ? 'Guardando…' : 'Registrar pago'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal: Confirmar eliminar presupuesto ── */}
            <Modal isOpen={!!showDeleteBudget} onClose={() => setShowDeleteBudget(null)} title="Eliminar presupuesto">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        Se eliminará <strong>"{showDeleteBudget?.name}"</strong> y todos sus pagos. Esta acción no se puede deshacer.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn-fin-secondary" onClick={() => setShowDeleteBudget(null)}>Cancelar</button>
                        <button className="btn-fin-primary" style={{ background: 'var(--danger)' }} onClick={handleDeleteBudget}>Eliminar</button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal: Confirmar eliminar pago ── */}
            <Modal isOpen={!!showDeletePayment} onClose={() => setShowDeletePayment(null)} title="Eliminar pago">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        Se eliminará el pago de <strong>{formatMXN(showDeletePayment?.payment?.amount)}</strong>. Esta acción no se puede deshacer.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn-fin-secondary" onClick={() => setShowDeletePayment(null)}>Cancelar</button>
                        <button className="btn-fin-primary" style={{ background: 'var(--danger)' }} onClick={handleDeletePayment}>Eliminar</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function BudgetCard({ budget, payments, paid, pct, complete, expanded, onToggle, onPay, onDelete, onDeletePayment }) {
    const remaining = Math.max(0, budget.target_amount - paid);
    const lastPayment = payments[0];
    const color = complete ? '#22c55e' : budget.color;

    return (
        <div className="budget-card card">
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {complete
                            ? <Check size={18} color={color} strokeWidth={2.5} />
                            : <Target size={18} color={color} strokeWidth={1.8} />
                        }
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{budget.name}</p>
                        {budget.description && <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{budget.description}</p>}
                    </div>
                </div>
                <button
                    onClick={onDelete}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Amounts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <div>
                    <span style={{ fontSize: '22px', fontWeight: 800, color, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                        {formatMXN(paid)}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        de {formatMXN(budget.target_amount)}
                    </span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color }}>
                    {pct.toFixed(1)}%
                </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.07)', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: '999px',
                    background: color,
                    width: `${pct}%`,
                    transition: 'width 0.6s cubic-bezier(0.34,1.1,0.64,1)',
                }} />
            </div>

            {/* Footer row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {!complete && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Falta <strong style={{ color: 'var(--text-secondary)' }}>{formatMXN(remaining)}</strong>
                        </span>
                    )}
                    {lastPayment && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Último: {formatDate(lastPayment.date)} · <strong style={{ color: 'var(--text-secondary)' }}>{formatMXN(lastPayment.amount)}</strong>
                        </span>
                    )}
                    {payments.length > 0 && (
                        <button
                            onClick={onToggle}
                            style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                            {payments.length} pagos {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                </div>
                <button className="btn-fin-secondary" onClick={onPay} style={{ fontSize: '12px', padding: '6px 12px' }}>
                    <Plus size={12} /> Pago
                </button>
            </div>

            {/* Payments list */}
            {expanded && payments.length > 0 && (
                <div style={{ marginTop: '14px', borderTop: '1px solid var(--bg-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {payments.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                            <div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatMXN(p.amount)}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{formatDate(p.date)}</span>
                                {p.note && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>· {p.note}</span>}
                            </div>
                            <button
                                onClick={() => onDeletePayment(p)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', opacity: 0.6 }}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
