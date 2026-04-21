"use client";
import { useState, useEffect } from "react";
import { Plus, Calendar, Mail, Phone, Link as LinkIcon, Edit2, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import "./Clientes.css";

const COLUMNS = [
    { id: "prospecto", title: "Prospecto" },
    { id: "propuesta", title: "Propuesta enviada" },
    { id: "desarrollo", title: "En desarrollo" },
    { id: "entregado", title: "Entregado" },
    { id: "mantenimiento", title: "Mantenimiento" }
];

export default function ClientesPage() {
    const [clients, setClients] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [draggedItem, setDraggedItem] = useState(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [clientsRes, txRes] = await Promise.all([
                supabase.from('clients').select('*').order('created_at', { ascending: false }),
                supabase.from('transactions').select('client, amount, type')
            ]);

            if (clientsRes.error) console.error("Error fetching clients:", clientsRes.error);
            else {
                const formattedData = (clientsRes.data || []).map(c => ({
                    ...c,
                    startDate: c.start_date,
                    contactPerson: c.contact_person,
                    total_price: c.total_price || 0
                }));
                setClients(formattedData);
            }

            if (txRes.error) console.error("Error fetching transactions:", txRes.error);
            else setTransactions(txRes.data || []);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Calculate how much has been paid for a given client name
    const getPaidAmount = (clientName) => {
        if (!clientName) return 0;
        return transactions
            .filter(t => t.type === 'Ingreso' && t.client?.toLowerCase() === clientName.toLowerCase())
            .reduce((sum, t) => sum + (t.amount || 0), 0);
    };

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        service: "",
        total_price: "",
        startDate: new Date().toISOString().split('T')[0],
        contactPerson: "",
        phone: "",
        email: "",
        status: "prospecto",
        notes: ""
    });

    const openModal = (client = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name || "",
                service: client.service || "",
                total_price: client.total_price || "",
                startDate: client.startDate || new Date().toISOString().split('T')[0],
                contactPerson: client.contactPerson || "",
                phone: client.phone || "",
                email: client.email || "",
                status: client.status || "prospecto",
                notes: client.notes || ""
            });
        } else {
            setEditingClient(null);
            setFormData({
                name: "",
                service: "",
                total_price: "",
                startDate: new Date().toISOString().split('T')[0],
                contactPerson: "",
                phone: "",
                email: "",
                status: "prospecto",
                notes: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleDragStart = (e, client) => {
        setDraggedItem(client);
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => { e.target.classList.add("dragging"); }, 0);
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove("dragging");
        setDraggedItem(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add("drag-over");
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove("drag-over");
    };

    const handleDrop = async (e, status) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-over");

        if (draggedItem && draggedItem.status !== status) {
            setClients(clients.map(c => c.id === draggedItem.id ? { ...c, status } : c));
            const { error } = await supabase.from('clients').update({ status }).eq('id', draggedItem.id);
            if (error) { console.error("Error updating status:", error); fetchData(); }
        }
    };

    const [itemToDelete, setItemToDelete] = useState(null);

    const handleDelete = (id) => { setItemToDelete(id); };

    const confirmDelete = async () => {
        if (itemToDelete) {
            const { error } = await supabase.from('clients').delete().eq('id', itemToDelete);
            if (error) {
                console.error("Error deleting client:", error);
                toast.error("Error al eliminar el cliente.");
            } else {
                setClients(clients.filter(c => c.id !== itemToDelete));
            }
            setItemToDelete(null);
            setIsModalOpen(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.service) {
            toast.error("Por favor ingresa al menos el nombre y el servicio.");
            return;
        }

        const payload = {
            name: formData.name,
            service: formData.service,
            total_price: parseFloat(formData.total_price) || 0,
            start_date: formData.startDate,
            status: formData.status,
            notes: formData.notes,
            email: formData.email,
            phone: formData.phone,
            contact_person: formData.contactPerson
        };

        if (editingClient) {
            const { data, error } = await supabase.from('clients').update(payload).eq('id', editingClient.id).select();
            if (error) { console.error("Error updating client:", error); toast.error("Error al actualizar el cliente."); }
            else if (data?.[0]) {
                const formatted = { ...data[0], startDate: data[0].start_date, contactPerson: data[0].contact_person, total_price: data[0].total_price || 0 };
                setClients(clients.map(c => c.id === editingClient.id ? formatted : c));
            }
        } else {
            const { data, error } = await supabase.from('clients').insert([payload]).select();
            if (error) { console.error("Error creating client:", error); toast.error("Error al crear el cliente."); }
            else if (data?.[0]) {
                const formatted = { ...data[0], startDate: data[0].start_date, contactPerson: data[0].contact_person, total_price: data[0].total_price || 0 };
                setClients([formatted, ...clients]);
            }
        }

        setIsModalOpen(false);
    };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

    return (
        <div className="page-container clientes-page">
            <div className="finanzas-header">
                <h1 className="page-title">Clientes</h1>
                <button className="btn-primary icon-btn glass" onClick={() => openModal(null)}>
                    <Plus size={16} />
                    <span>Nuevo Cliente</span>
                </button>
            </div>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Cargando clientes...</div>
            ) : (
                <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '20px', display: 'flex' }}>
                    <div className="kanban-board" style={{ minWidth: 'max-content' }}>
                        {COLUMNS.map(col => {
                        const colClients = clients.filter(c => c.status === col.id);
                        return (
                            <div
                                key={col.id}
                                className="kanban-column"
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, col.id)}
                            >
                                <div className="column-header">
                                    <span className="column-title">{col.title}</span>
                                    <span className="column-count">{colClients.length}</span>
                                </div>
                                <div className="kanban-cards">
                                    {colClients.map(client => {
                                        const paid = getPaidAmount(client.name);
                                        const total = client.total_price || 0;
                                        const pending = Math.max(total - paid, 0);
                                        const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
                                        return (
                                            <div
                                                key={client.id}
                                                className="client-card"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, client)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => openModal(client)}
                                            >
                                                <div className="card-header">
                                                    <span className="client-name">{client.name}</span>
                                                </div>
                                                <div className="service-type" style={{ marginBottom: "8px" }}>{client.service}</div>

                                                {total > 0 && (
                                                    <div style={{ marginBottom: "10px" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                                                            <span style={{ color: "var(--success)" }}>{formatCurrency(paid)} cobrado</span>
                                                            <span>{formatCurrency(total)}</span>
                                                        </div>
                                                        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "99px", height: "5px", overflow: "hidden" }}>
                                                            <div style={{ width: `${pct}%`, height: "100%", background: pending > 0 ? "var(--accent)" : "var(--success)", borderRadius: "99px", transition: "width 0.4s ease" }} />
                                                        </div>
                                                        {pending > 0 && (
                                                            <div style={{ fontSize: "11px", color: "var(--warning, #f5a623)", marginTop: "4px", fontWeight: 600 }}>
                                                                Pendiente: {formatCurrency(pending)}
                                                            </div>
                                                        )}
                                                        {pending === 0 && total > 0 && (
                                                            <div style={{ fontSize: "11px", color: "var(--success)", marginTop: "4px", fontWeight: 600 }}>
                                                                ✓ Pagado completo
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="card-footer">
                                                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                        <Calendar size={12} /> {client.startDate}
                                                    </div>
                                                    <div className="profile-icon" style={{ width: "20px", height: "20px", fontSize: "10px" }}>
                                                        {client.contactPerson ? client.contactPerson.charAt(0) : <Phone size={10} />}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClient ? "Editar Cliente" : "Nuevo Cliente"}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} onSubmit={handleFormSubmit}>
                    <div className="detail-grid">
                        <div className="detail-item">
                            <span className="detail-label">Nombre de la Empresa *</span>
                            <input type="text" className="select-filter" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Tipo de Servicio *</span>
                            <input type="text" className="select-filter" required value={formData.service} onChange={e => setFormData({ ...formData, service: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Precio Total del Proyecto (MXN)</span>
                            <input type="number" className="select-filter" placeholder="0.00" step="0.01" min="0" value={formData.total_price} onChange={e => setFormData({ ...formData, total_price: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Fecha de Inicio</span>
                            <input type="date" className="select-filter" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--border-color)' }}></div>

                    <div className="detail-grid">
                        <div className="detail-item">
                            <span className="detail-label">Contacto (Persona)</span>
                            <input type="text" className="select-filter" value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Teléfono</span>
                            <input type="text" className="select-filter" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Email</span>
                            <input type="email" className="select-filter" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Estado</span>
                            <select className="select-filter" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                        <span className="detail-label">Notas</span>
                        <textarea className="notes-area" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        {editingClient ? (
                            <button type="button" className="btn-icon-sm" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }} onClick={() => handleDelete(editingClient.id)}>
                                <Trash2 size={16} /> Eliminar
                            </button>
                        ) : <div></div>}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsModalOpen(false)}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primary">Guardar Cliente</button>
                        </div>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={itemToDelete !== null} onClose={() => setItemToDelete(null)} title="Confirmar Eliminación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.</p>
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
