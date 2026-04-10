"use client";
import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, LineChart, Target, DollarSign } from "lucide-react";
import Modal from "@/components/Modal";
import PLCalendar from "@/components/PLCalendar";
import { supabase } from "@/lib/supabaseClient";
import "./Trading.css";

export default function TradingPage() {
    const [operations, setOperations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTrade, setEditingTrade] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        asset: "",
        lot_size: "",
        invested_amount: "",
        status: "Abierto", // Abierto, Cerrado
        outcome: "Pendiente", // Ganada, Perdida, Pendiente
        pnl: ""
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Test table exists by query, if not use mock or handle error
            const { data, error } = await supabase.from('trading_operations').select('*').order('date', { ascending: false });
            
            if (error) {
                console.error("Error fetching trading operations:", error);
                // Fallback to empty array if table doesn't exist yet
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

    const openModal = (tradeToEdit = null) => {
        if (tradeToEdit) {
            setEditingTrade(tradeToEdit);
            setFormData({
                date: tradeToEdit.date,
                asset: tradeToEdit.asset,
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
        
        const payload = {
            date: formData.date,
            asset: formData.asset.toUpperCase(),
            lot_size: parseFloat(formData.lot_size) || 0,
            invested_amount: parseFloat(formData.invested_amount) || 0,
            status: formData.status,
            outcome: formData.status === 'Abierto' ? 'Pendiente' : formData.outcome,
            pnl: formData.status === 'Cerrado' ? (parseFloat(formData.pnl) || 0) : 0
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

    const closedTrades = operations.filter(t => t.status === "Cerrado");
    const totalPnL = closedTrades.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
    const wonTrades = closedTrades.filter(t => t.outcome === "Ganada").length;
    const lostTrades = closedTrades.filter(t => t.outcome === "Perdida").length;
    const winRate = closedTrades.length > 0 ? ((wonTrades / closedTrades.length) * 100).toFixed(1) : 0;
    const openTradesCount = operations.filter(t => t.status === "Abierto").length;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="page-container">
            <div className="trading-header">
                <div>
                    <h1 className="page-title">Trading</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>Registro y bitácora de operaciones</p>
                </div>
                <div className="filters-group">
                    <button className="btn-primary icon-btn glass" onClick={() => openModal()} style={{ background: "rgba(10, 132, 255, 0.1)", color: "#0A84FF" }}>
                        <Plus size={16} />
                        <span>Nuevo Trade</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Cargando operaciones...</div>
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
                        </div>
                        <div className="card summary-card">
                            <span className="summary-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Target size={16} /> Win Rate (Cerradas)
                            </span>
                            <span className="summary-amount amount-neutral">{winRate}%</span>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', marginTop: '4px' }}>
                                <span style={{ color: "var(--success)" }}>W: {wonTrades}</span>
                                <span style={{ color: "var(--danger)" }}>L: {lostTrades}</span>
                            </div>
                        </div>
                        <div className="card summary-card">
                            <span className="summary-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <LineChart size={16} /> Trades Abiertos
                            </span>
                            <span className="summary-amount">{openTradesCount}</span>
                        </div>
                    </div>

                    <PLCalendar transactions={operations} mode="trading" />

                    <div className="card table-section">
                        <div className="table-header">
                            <h2 className="summary-title" style={{ fontSize: "16px", color: "var(--text-primary)" }}>Historial de Operaciones</h2>
                        </div>
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha (Apertura)</th>
                                        <th>Activo / Par</th>
                                        <th>Lote</th>
                                        <th>Inversión</th>
                                        <th>Estado</th>
                                        <th>Resultado</th>
                                        <th>P&L</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operations.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No hay operaciones registradas aún.</td>
                                        </tr>
                                    ) : operations.map(t => (
                                        <tr key={t.id}>
                                            <td>{t.date}</td>
                                            <td style={{ fontWeight: 600 }}>{t.asset}</td>
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
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', opacity: formData.status === 'Abierto' ? 0.5 : 1, pointerEvents: formData.status === 'Abierto' ? 'none' : 'auto' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Resultado (Solo Cerrado)</label>
                            <select className="select-filter" style={{ width: '100%' }} value={formData.outcome} onChange={e => setFormData({ ...formData, outcome: e.target.value })}>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Ganada">Ganada</option>
                                <option value="Perdida">Perdida</option>
                            </select>
                        </div>
                    </div>

                    {formData.status === 'Cerrado' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>P&L (Monto Ganado ó -Perdido) *</label>
                            <input type="number" step="0.01" className="select-filter" placeholder="Ej. 50.00 ó -20.00" style={{ width: '100%' }} required={formData.status === 'Cerrado'} value={formData.pnl} onChange={e => setFormData({ ...formData, pnl: e.target.value })} />
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
