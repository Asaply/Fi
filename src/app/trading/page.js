"use client";
import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, LineChart, Target, DollarSign, TrendingUp } from "lucide-react";
import Modal from "@/components/Modal";
import PLCalendar from "@/components/PLCalendar";
import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import "./Trading.css";
import { getFilter, setFilter } from '@/lib/filterMemory';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboarding } from '@/hooks/useOnboarding';

const TRADING_STEPS = [
    { target: '[data-tour="btn-nuevo-trade"]', title: 'Registra un trade', description: 'Agrega operaciones long o short. Cuando cierres la posición, FNCE calcula tu P&L automáticamente.', position: 'bottom' },
    { target: '[data-tour="card-winrate"]', title: 'Win Rate', description: 'Porcentaje de trades ganadores sobre el total de operaciones cerradas.', position: 'bottom' },
    { target: '[data-tour="pl-calendar"]', title: 'Calendario P&L', description: 'Vista día a día de tus resultados. Verde = día ganador, rojo = día perdedor.', position: 'top' },
];

const PERIODOS_TRAD = [
    { value: '1m', label: 'Este mes' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
    { value: '1y', label: 'Este año' },
];

function getFechaInicioTrad(periodo) {
    const now = new Date();
    switch (periodo) {
        case '1m': return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        case '3m': return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
        case '1y': return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        default:   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
}

export default function TradingPage() {
    const { isActive: tourActive, currentStep: tourStep, next: tourNext, complete: tourComplete, skip: tourSkip, resetTour } = useOnboarding('trading');
    const [operations, setOperations] = useState([]);
    const [periodo, setPeriodo] = useState('1m');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTrade, setEditingTrade] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        asset: "",
        type: "Long", // Long, Short
        lot_size: "",
        invested_amount: "",
        status: "Abierto", // Abierto, Cerrado
        outcome: "Pendiente", // Ganada, Perdida, Pendiente
        pnl: ""
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('trading_operations')
                .select('*')
                .eq('user_id', user?.id)
                .order('date', { ascending: false });

            if (error) {
                console.error("Error fetching trading operations:", error);
                setOperations([]);
            } else {
                const formattedData = (data || []).map(t => ({
                    ...t,
                    date: t.date ? new Date(t.date).toISOString().split('T')[0] : ''
                }));
                setOperations(formattedData);
            }
        } catch(err) {
            console.error("Fetch Exception", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const saved = getFilter('trading');
        if (saved) setPeriodo(saved);
    }, []);

    const openModal = (tradeToEdit = null) => {
        if (tradeToEdit) {
            setEditingTrade(tradeToEdit);
            setFormData({
                date: tradeToEdit.date,
                asset: tradeToEdit.asset,
                type: tradeToEdit.type || "Long",
                lot_size: tradeToEdit.lot_size.toString(),
                invested_amount: tradeToEdit.invested_amount.toString(),
                status: tradeToEdit.status,
                outcome: tradeToEdit.outcome,
                pnl: tradeToEdit.pnl ? tradeToEdit.pnl.toString() : ""
            });
        } else {
            setEditingTrade(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                asset: "",
                type: "Long",
                lot_size: "",
                invested_amount: "",
                status: "Abierto",
                outcome: "Pendiente",
                pnl: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        setItemToDelete(id);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            const { error } = await supabase
                .from('trading_operations')
                .delete()
                .eq('id', itemToDelete);

            if (error) {
                console.error("Error deleting trade:", error);
                alert("Hubo un error al eliminar el trade. ¿Creaste la tabla trading_operations en Supabase?");
            } else {
                setOperations(operations.filter(t => t.id !== itemToDelete));
            }
            setItemToDelete(null);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        const numericPnl = parseFloat(formData.pnl) || 0;
        let finalOutcome = formData.status === 'Abierto' ? 'Pendiente' : formData.outcome;
        
        // BUG 1 Fix: Sync outcome and PnL automatically
        if (formData.status === 'Cerrado') {
            if (numericPnl > 0) finalOutcome = 'Ganada';
            else if (numericPnl < 0) finalOutcome = 'Perdida';
        }

        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            date: formData.date,
            asset: formData.asset.toUpperCase(),
            type: formData.type,
            lot_size: parseFloat(formData.lot_size) || 0,
            invested_amount: parseFloat(formData.invested_amount) || 0,
            status: formData.status,
            outcome: finalOutcome,
            pnl: formData.status === 'Cerrado' ? numericPnl : 0,
            user_id: user?.id,
        };

        if (editingTrade) {
            const { data, error } = await supabase
                .from('trading_operations')
                .update(payload)
                .eq('id', editingTrade.id)
                .select();

            if (error) {
                console.error("Error updating trade:", error);
                alert("Hubo un error al actualizar. Verifica que la tabla exista.");
            } else if (data?.[0]) {
                const updated = operations.map(t => t.id === editingTrade.id ? data[0] : t);
                setOperations(updated.sort((a, b) => new Date(b.date) - new Date(a.date)));
            }
        } else {
            const { data, error } = await supabase
                .from('trading_operations')
                .insert([payload])
                .select();

            if (error) {
                console.error("Error creating trade:", error);
                alert("Hubo un error al crear. ¿Creaste la tabla trading_operations en Supabase con las columnas correctas?");
            } else if (data?.[0]) {
                const updated = [data[0], ...operations];
                setOperations(updated.sort((a, b) => new Date(b.date) - new Date(a.date)));
            }
        }

        setIsModalOpen(false);
    };

    const fechaInicioTrad = getFechaInicioTrad(periodo);
    const filteredOps = operations.filter(t => t.date >= fechaInicioTrad);

    const closedTrades = filteredOps.filter(t => t.status === "Cerrado");
    const totalPnL = closedTrades.reduce((acc, curr) => acc + (Number(curr.pnl) || 0), 0);
    const wonTrades = closedTrades.filter(t => Number(t.pnl) > 0).length;
    const lostTrades = closedTrades.filter(t => Number(t.pnl) < 0).length;
    const winRate = closedTrades.length > 0 ? ((wonTrades / closedTrades.length) * 100).toFixed(1) : 0;
    const openTradesCount = operations.filter(t => t.status === "Abierto").length;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    return (
        <div className="page-container">
            <OnboardingTour
                steps={TRADING_STEPS}
                isActive={tourActive}
                currentStep={tourStep}
                onNext={() => tourNext(TRADING_STEPS.length)}
                onComplete={tourComplete}
                onSkip={tourSkip}
            />
            <div className="trading-header page-header">
                <div className="trading-header-title">
                    <h1 className="page-title">Trading</h1>
                    <p className="page-subtitle">Registro y bitácora de operaciones</p>
                </div>
                <div className="page-actions">
                    <div className="time-filter-group">
                        {PERIODOS_TRAD.map(p => (
                            <button
                                key={p.value}
                                className={`time-filter-btn${periodo === p.value ? ' active' : ''}`}
                                onClick={() => { setFilter('trading', p.value); setPeriodo(p.value); }}
                            >{p.label}</button>
                        ))}
                    </div>
                    <button className="btn-primary" data-tour="btn-nuevo-trade" onClick={() => openModal()}>
                        <Plus size={15} />
                        <span>Nuevo Trade</span>
                    </button>
                </div>
            </div>

            <button onClick={resetTour} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: 0, marginBottom: '16px', display: 'block' }}>
                ¿Cómo usar esta sección?
            </button>

            {isLoading ? (
                <div className="summary-cards">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
            ) : (
                <>
                    <div className="summary-cards">
                        <div className="card summary-card glass">
                            <span className="summary-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <DollarSign size={16} /> Total P&L Realizado
                            </span>
                            <span className={`summary-amount ${totalPnL > 0 ? 'amount-positive' : totalPnL < 0 ? 'amount-negative' : 'amount-neutral'}`}>
                                {totalPnL > 0 ? '+' : ''}{formatCurrency(totalPnL)}
                            </span>
                            {totalPnL === 0 && closedTrades.length === 0 && (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Sin operaciones en este período</span>
                            )}
                        </div>
                        <div className="card summary-card" data-tour="card-winrate">
                            <span className="summary-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Target size={16} /> Win Rate (Cerradas)
                            </span>
                            <span className={`summary-amount ${Number(winRate) >= 60 ? 'amount-positive' : Number(winRate) >= 40 ? 'amount-warning' : closedTrades.length === 0 ? 'amount-neutral' : 'amount-negative'}`}>{winRate}%</span>
                            {closedTrades.length === 0 ? (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Sin operaciones en este período</span>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px', fontSize: '12px', marginTop: '4px' }}>
                                    <span style={{ color: "var(--success)" }}>W: {wonTrades}</span>
                                    <span style={{ color: "var(--danger)" }}>L: {lostTrades}</span>
                                    {closedTrades.length - wonTrades - lostTrades > 0 && (
                                        <span style={{ color: "var(--text-secondary)" }}>BE: {closedTrades.length - wonTrades - lostTrades}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="card summary-card">
                            <span className="summary-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <LineChart size={16} /> Trades Abiertos
                            </span>
                            <span className="summary-amount">{openTradesCount}</span>
                            {openTradesCount === 0 && (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Sin operaciones en este período</span>
                            )}
                        </div>
                    </div>

                    <div data-tour="pl-calendar">
                        <PLCalendar transactions={filteredOps} mode="trading" />
                    </div>

                    <div className="card table-section">
                        <div className="table-header">
                            <h2 className="summary-title" style={{ fontSize: "16px", color: "var(--text-primary)" }}>Historial de Operaciones</h2>
                        </div>
                        {filteredOps.length === 0 ? (
                            <EmptyState
                                icon={<TrendingUp size={48} />}
                                title="Sin trades en este período"
                                description="Agrega tu primer trade para empezar a rastrear tu rendimiento."
                                action={{ label: "+ Nuevo Trade", onClick: () => openModal() }}
                            />
                        ) : (
                        <div className="table-responsive" style={{ width: '100%', overflowX: 'auto' }}>
                            <table className="data-table" style={{ minWidth: '800px' }}>
                                <thead>
                                    <tr>
                                        <th>Fecha (Apertura)</th>
                                        <th>Activo / Par</th>
                                        <th>Tipo</th>
                                        <th>Lote</th>
                                        <th>Inversión</th>
                                        <th>Estado</th>
                                        <th>Resultado</th>
                                        <th>P&L</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOps.map(t => (
                                        <tr key={t.id}>
                                            <td>{t.date}</td>
                                            <td style={{ fontWeight: 600 }}>{t.asset}</td>
                                            <td>
                                                <span className={`badge ${t.type === 'Short' ? 'badge-perdida' : 'badge-ganada'}`} style={{ opacity: 0.8 }}>
                                                    {t.type || 'Long'}
                                                </span>
                                            </td>
                                            <td>{t.lot_size}</td>
                                            <td>{formatCurrency(t.invested_amount)}</td>
                                            <td>
                                                <span className={`badge badge-${t.status.toLowerCase()}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td>
                                                {t.outcome !== 'Pendiente' ? (
                                                   <span className={`badge badge-${t.outcome.toLowerCase()}`}>
                                                       {t.outcome}
                                                   </span>
                                                ) : <span className="badge badge-pendiente">-</span>}
                                            </td>
                                            <td className={
                                                t.status === 'Cerrado' ? (t.pnl > 0 ? 'amount-positive font-bold' : t.pnl < 0 ? 'amount-negative font-bold' : '') : ''
                                            }>
                                                {t.status === 'Cerrado' ? formatCurrency(t.pnl) : '--'}
                                            </td>
                                            <td>
                                                <div className="actions-cell">
                                                    <button className="btn-icon-sm" onClick={() => openModal(t)}><Edit2 size={16} /></button>
                                                    <button className="btn-icon-sm" onClick={() => handleDelete(t.id)}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        )}
                    </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingTrade ? 'Editar' : 'Registrar'} Trade`}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleFormSubmit}>
                    
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Fecha *</label>
                            <input type="date" className="select-filter" style={{ width: '100%' }} required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Activo (Ej. USD/CHF) *</label>
                            <input type="text" className="select-filter" placeholder="USD/CHF" style={{ width: '100%' }} required value={formData.asset} onChange={e => setFormData({ ...formData, asset: e.target.value })} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Tipo *</label>
                            <select className="select-filter" style={{ width: '100%' }} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="Long">Long</option>
                                <option value="Short">Short</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Monto Lote *</label>
                            <input type="number" step="0.01" className="select-filter" placeholder="0.1" style={{ width: '100%' }} required value={formData.lot_size} onChange={e => setFormData({ ...formData, lot_size: e.target.value })} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Dinero Invertido ($) *</label>
                            <input type="number" step="0.01" className="select-filter" placeholder="100.00" style={{ width: '100%' }} required value={formData.invested_amount} onChange={e => setFormData({ ...formData, invested_amount: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Status</label>
                            <select className="select-filter" style={{ width: '100%' }} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                <option value="Abierto">Abierto</option>
                                <option value="Cerrado">Cerrado</option>
                            </select>
                        </div>
                    </div>

                    {formData.status === 'Cerrado' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>P&L (Monto Ganado ó -Perdido) *</label>
                            <input type="number" step="any" className="select-filter" placeholder="Ej. 50.00 ó -20.00" style={{ width: '100%' }} required={formData.status === 'Cerrado'} value={formData.pnl} onChange={e => {
                                const val = e.target.value;
                                const num = parseFloat(val);
                                let newOutcome = formData.outcome;
                                if (!isNaN(num)) {
                                    if (num > 0) newOutcome = 'Ganada';
                                    else if (num < 0) newOutcome = 'Perdida';
                                }
                                setFormData({ ...formData, pnl: val, outcome: newOutcome });
                            }} />
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" style={{ background: "var(--brand-blue)", color: "#fff" }}>
                            Guardar Trade
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={itemToDelete !== null} onClose={() => setItemToDelete(null)} title="Confirmar Eliminación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>¿Estás seguro de que deseas eliminar este trade? Esta acción no se puede deshacer.</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setItemToDelete(null)}>
                            Cancelar
                        </button>
                        <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={confirmDelete}>
                            Eliminar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
