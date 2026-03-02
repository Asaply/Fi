"use client";
import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { supabase } from "@/lib/supabaseClient";
import "./Finanzas.css";

const MOCK_DATA = [
    { id: 1, date: "2026-02-15", client: "Acme Corp", concept: "Desarrollo Web (50%)", type: "Ingreso", amount: 45000 },
    { id: 2, date: "2026-02-18", client: "N/A", concept: "Suscripción Vercel", type: "Egreso", amount: 400 },
    { id: 3, date: "2026-02-20", client: "TechFlow", concept: "Mantenimiento Mensual", type: "Ingreso", amount: 12000 },
    { id: 4, date: "2026-02-25", client: "N/A", concept: "Pago Diseñador Freelance", type: "Egreso", amount: 15000 },
];

export default function FinanzasPage() {
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchTransactions = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error("Error fetching transactions:", error);
        } else {
            const formattedData = data.map(t => ({
                ...t,
                // Ensure date format is correct for inputs (YYYY-MM-DD)
                date: t.date ? new Date(t.date).toISOString().split('T')[0] : ''
            }));
            setTransactions(formattedData || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTransactions();
    }, []);
    const [modalType, setModalType] = useState("Ingreso"); // Ingreso or Egreso
    const [editingTransaction, setEditingTransaction] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        client: "",
        concept: "",
        amount: ""
    });

    const totalIngresos = transactions.filter(t => t.type === "Ingreso").reduce((acc, curr) => acc + curr.amount, 0);
    const totalEgresos = transactions.filter(t => t.type === "Egreso").reduce((acc, curr) => acc + curr.amount, 0);
    const gananciaNeta = totalIngresos - totalEgresos;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const openModal = (type, transactionToEdit = null) => {
        setModalType(type);
        if (transactionToEdit) {
            setEditingTransaction(transactionToEdit);
            setFormData({
                date: transactionToEdit.date,
                client: transactionToEdit.client === 'N/A' ? '' : transactionToEdit.client,
                concept: transactionToEdit.concept,
                amount: transactionToEdit.amount.toString()
            });
        } else {
            setEditingTransaction(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                client: "",
                concept: "",
                amount: ""
            });
        }
        setIsModalOpen(true);
    };

    const [itemToDelete, setItemToDelete] = useState(null);

    const handleDelete = (id) => {
        setItemToDelete(id);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', itemToDelete);

            if (error) {
                console.error("Error deleting transaction:", error);
                alert("Hubo un error al eliminar la transacción.");
            } else {
                setTransactions(transactions.filter(t => t.id !== itemToDelete));
            }
            setItemToDelete(null);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.concept || !formData.amount || !formData.date) {
            alert("Por favor completa los campos requeridos.");
            return;
        }

        const payload = {
            date: formData.date,
            client: formData.client || "N/A",
            concept: formData.concept,
            type: modalType,
            amount: parseFloat(formData.amount)
        };

        if (editingTransaction) {
            const { data, error } = await supabase
                .from('transactions')
                .update(payload)
                .eq('id', editingTransaction.id)
                .select();

            if (error) {
                console.error("Error updating transaction:", error);
                alert("Hubo un error al actualizar.");
            } else if (data?.[0]) {
                const updated = transactions.map(t => t.id === editingTransaction.id ? data[0] : t);
                setTransactions(updated.sort((a, b) => new Date(b.date) - new Date(a.date)));
            }
        } else {
            const { data, error } = await supabase
                .from('transactions')
                .insert([payload])
                .select();

            if (error) {
                console.error("Error creating transaction:", error);
                alert("Hubo un error al crear.");
            } else if (data?.[0]) {
                const updated = [data[0], ...transactions];
                setTransactions(updated.sort((a, b) => new Date(b.date) - new Date(a.date)));
            }
        }

        setIsModalOpen(false);
    };

    const getLast3MonthsData = () => {
        const data = [];
        const today = new Date();
        for (let i = 2; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);

            const monthData = {
                label: d.toLocaleString('es-MX', { month: 'short' }),
                ingresos: 0,
                egresos: 0,
            };

            transactions.forEach(t => {
                const [tYear, tMonth] = t.date.split('-');
                if (parseInt(tYear) === d.getFullYear() && parseInt(tMonth) === d.getMonth() + 1) {
                    if (t.type === 'Ingreso') monthData.ingresos += t.amount;
                    if (t.type === 'Egreso') monthData.egresos += t.amount;
                }
            });

            data.push(monthData);
        }
        return data;
    };

    const chartData = getLast3MonthsData();
    const maxAmount = Math.max(...chartData.flatMap(d => [d.ingresos, d.egresos]), 100);

    return (
        <div className="page-container">
            <div className="finanzas-header">
                <h1 className="page-title">Finanzas</h1>
                <div className="filters-group">
                    <button className="btn-primary icon-btn glass" onClick={() => openModal("Ingreso")} style={{ background: "rgba(52, 199, 89, 0.1)", color: "var(--success)" }}>
                        <ArrowUpRight size={16} />
                        <span>Ingreso</span>
                    </button>
                    <button className="btn-primary icon-btn glass" onClick={() => openModal("Egreso")} style={{ background: "rgba(255, 59, 48, 0.1)", color: "var(--danger)" }}>
                        <ArrowDownRight size={16} />
                        <span>Egreso</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Cargando finanzas...</div>
            ) : (
                <>
                    <div className="summary-cards">
                        <div className="card summary-card">
                            <span className="summary-title">Total Ingresos</span>
                            <span className="summary-amount amount-positive">{formatCurrency(totalIngresos)}</span>
                        </div>
                        <div className="card summary-card">
                            <span className="summary-title">Total Egresos</span>
                            <span className="summary-amount amount-negative">{formatCurrency(totalEgresos)}</span>
                        </div>
                        <div className="card summary-card glass">
                            <span className="summary-title">Ganancia Neta</span>
                            <span className="summary-amount">{formatCurrency(gananciaNeta)}</span>
                        </div>
                    </div>

                    <div className="card chart-section">
                        <span className="summary-title">Ingresos vs Egresos (Últimos 3 meses)</span>
                        <div className="chart-placeholder">
                            {chartData.map((data, index) => {
                                const incomeHeight = Math.max((data.ingresos / maxAmount) * 180, data.ingresos > 0 ? 10 : 0);
                                const expenseHeight = Math.max((data.egresos / maxAmount) * 180, data.egresos > 0 ? 10 : 0);
                                return (
                                    <div className="bar-group" key={index} title={`${data.label}: Ingresos ${formatCurrency(data.ingresos)} | Egresos ${formatCurrency(data.egresos)}`}>
                                        <div className="bar bar-income" style={{ height: `${incomeHeight}px` }}></div>
                                        <div className="bar bar-expense" style={{ height: `${expenseHeight}px` }}></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="card table-section">
                        <div className="table-header">
                            <h2 className="summary-title" style={{ fontSize: "16px", color: "var(--text-primary)" }}>Transacciones Recientes</h2>
                            <div className="filters-group">
                                <select className="select-filter">
                                    <option>Febrero 2026</option>
                                    <option>Enero 2026</option>
                                </select>
                                <select className="select-filter">
                                    <option>Todos los clientes</option>
                                    <option>Acme Corp</option>
                                    <option>TechFlow</option>
                                </select>
                            </div>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cliente</th>
                                    <th>Concepto</th>
                                    <th>Tipo</th>
                                    <th>Monto</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.id}>
                                        <td>{t.date}</td>
                                        <td>{t.client}</td>
                                        <td>{t.concept}</td>
                                        <td>
                                            <span className={`badge badge-${t.type.toLowerCase()}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className={t.type === 'Ingreso' ? 'amount-positive' : 'amount-negative'}>
                                            {formatCurrency(t.amount)}
                                        </td>
                                        <td>
                                            <div className="actions-cell">
                                                <button className="btn-icon-sm" onClick={() => openModal(t.type, t)}><Edit2 size={16} /></button>
                                                <button className="btn-icon-sm" onClick={() => handleDelete(t.id)}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingTransaction ? 'Editar' : 'Registrar Nuevo'} ${modalType}`}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleFormSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Fecha *</label>
                        <input type="date" className="select-filter" style={{ width: '100%' }} required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Cliente (Opcional)</label>
                        <input type="text" className="select-filter" placeholder="Nombre del cliente" style={{ width: '100%' }} value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Concepto *</label>
                        <input type="text" className="select-filter" placeholder="Ej. Pago inicial proyecto web" style={{ width: '100%' }} required value={formData.concept} onChange={e => setFormData({ ...formData, concept: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Monto *</label>
                        <input type="number" className="select-filter" placeholder="0.00" step="0.01" style={{ width: '100%' }} required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary">
                            Guardar Transacción
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={itemToDelete !== null} onClose={() => setItemToDelete(null)} title="Confirmar Eliminación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.</p>
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
