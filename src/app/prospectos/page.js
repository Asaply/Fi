"use client";
import { useState } from "react";
import { Plus, UserPlus, Mail, Phone, Clock, Target, ArrowRight, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import "./Prospectos.css";

const STAGES = [
    { id: "nuevo", title: "Nuevo", color: "#86868b" },
    { id: "contactado", title: "Contactado", color: "#0071e3" },
    { id: "negociacion", title: "En negociación", color: "#ff9f0a" },
    { id: "ganado", title: "Ganado", color: "#34c759" },
    { id: "perdido", title: "Perdido", color: "#ff3b30" }
];

const INITIAL_PROSPECTS = [
    { id: 1, name: "María González", company: "Boutique MG", source: "Instagram", service: "Ecommerce", budget: "35000", probability: 30, date: "2026-02-26", stage: "nuevo", notes: "Preguntó por precios de Shopify en DM" },
    { id: 2, name: "Roberto Sánchez", company: "Consultoría RS", source: "Referido", service: "Web Corporativa", budget: "20000", probability: 70, date: "2026-02-22", stage: "contactado", notes: "Tuvimos llamada de 15 min. Le enviaré propuesta el lunes." },
    { id: 3, name: "Patricia López", company: "Restaurante El Mar", source: "Website", service: "Branding + Web", budget: "60000", probability: 90, date: "2026-02-15", stage: "negociacion", notes: "Están decidiendo entre nosotros y otra agencia. Pidieron descuento del 5%." }
];

export default function ProspectosPage() {
    const [prospects, setProspects] = useLocalStorage("antigravity_prospects", INITIAL_PROSPECTS);
    const [draggedItem, setDraggedItem] = useState(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProspect, setEditingProspect] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        company: "",
        source: "Instagram",
        service: "",
        budget: "",
        probability: 50,
        date: new Date().toISOString().split('T')[0],
        stage: "nuevo",
        notes: ""
    });

    const getStageColor = (stageId) => STAGES.find(s => s.id === stageId)?.color || "#86868b";

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const openModal = (prospect = null) => {
        if (prospect) {
            setEditingProspect(prospect);
            setFormData({ ...prospect });
        } else {
            setEditingProspect(null);
            setFormData({
                name: "",
                company: "",
                source: "Instagram",
                service: "",
                budget: "",
                probability: 50,
                date: new Date().toISOString().split('T')[0],
                stage: "nuevo",
                notes: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleDragStart = (e, prospect) => {
        setDraggedItem(prospect);
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => {
            e.target.classList.add("dragging");
        }, 0);
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

    const handleDrop = (e, stageId) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-over");

        if (draggedItem && draggedItem.stage !== stageId) {
            setProspects(prospects.map(p =>
                p.id === draggedItem.id ? { ...p, stage: stageId } : p
            ));
        }
    };

    const [itemToDelete, setItemToDelete] = useState(null);

    const handleDelete = (id) => {
        setItemToDelete(id);
    };

    const confirmDelete = () => {
        if (itemToDelete) {
            setProspects(prospects.filter(p => p.id !== itemToDelete));
            setItemToDelete(null);
            setIsModalOpen(false);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.company) {
            alert("Por favor ingresa al menos el nombre y la empresa.");
            return;
        }

        const payload = {
            ...formData,
            id: editingProspect ? editingProspect.id : Date.now(),
        };

        if (editingProspect) {
            setProspects(prospects.map(p => p.id === editingProspect.id ? payload : p));
        } else {
            setProspects([...prospects, payload]);
        }

        setIsModalOpen(false);
    };

    return (
        <div className="page-container prospectos-page">
            <div className="finanzas-header">
                <h1 className="page-title">Prospectos Pipeline</h1>
                <button className="btn-primary icon-btn glass" onClick={() => openModal(null)}>
                    <Plus size={16} />
                    <span>Añadir Lead</span>
                </button>
            </div>

            <div className="pipeline-board">
                {STAGES.map(stage => {
                    const stageProspects = prospects.filter(p => p.stage === stage.id);
                    const totalValue = stageProspects.reduce((acc, p) => {
                        return acc + parseInt(p.budget.toString().replace(/[^0-9]/g, '') || 0);
                    }, 0);

                    return (
                        <div
                            key={stage.id}
                            className="pipeline-column"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, stage.id)}
                        >
                            <div className="column-header" style={{ borderBottomColor: `${stage.color}40` }}>
                                <div className="column-title">
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stage.color }}></div>
                                    {stage.title}
                                </div>
                                <div className="column-value">
                                    {formatCurrency(totalValue)} ({stageProspects.length})
                                </div>
                            </div>

                            <div className="lead-cards">
                                {stageProspects.map(prospect => (
                                    <div
                                        key={prospect.id}
                                        className="lead-card"
                                        style={{ borderLeftColor: stage.color }}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, prospect)}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => openModal(prospect)}
                                    >
                                        <div className="lead-header">
                                            <div>
                                                <div className="lead-name">{prospect.name}</div>
                                                <div className="lead-company">{prospect.company}</div>
                                            </div>
                                            <span className="lead-source">{prospect.source}</span>
                                        </div>

                                        <div className="lead-budget">
                                            {prospect.budget ? formatCurrency(prospect.budget) : "$0.00"}
                                        </div>

                                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                                            <span>Probabilidad</span>
                                            <span>{prospect.probability}%</span>
                                        </div>
                                        <div className="probability-bar">
                                            <div
                                                className="probability-fill"
                                                style={{
                                                    width: `${prospect.probability}%`,
                                                    backgroundColor: prospect.probability > 60 ? 'var(--success)' : prospect.probability > 30 ? 'var(--warning)' : 'var(--text-tertiary)'
                                                }}
                                            ></div>
                                        </div>

                                        <div className="lead-footer">
                                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                <Clock size={12} /> {prospect.date}
                                            </div>
                                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                <Target size={12} /> {prospect.service}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingProspect ? editingProspect.name : "Nuevo Prospecto"}
            >
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleFormSubmit}>

                    <div className="detail-grid" style={{ marginBottom: 0 }}>
                        <div className="detail-item">
                            <span className="detail-label">Nombre del Contacto *</span>
                            <input type="text" className="select-filter" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Empresa *</span>
                            <input type="text" className="select-filter" required value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Fuente (Origen)</span>
                            <select className="select-filter" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })}>
                                <option>Instagram</option>
                                <option>Website</option>
                                <option>Referido</option>
                                <option>Outbound</option>
                            </select>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Etapa del Deal</span>
                            <select className="select-filter" value={formData.stage} onChange={e => setFormData({ ...formData, stage: e.target.value })}>
                                {STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                            </select>
                        </div>
                    </div>

                    <h3 className="modal-section-title">Detalles del Proyecto</h3>

                    <div className="detail-grid" style={{ marginBottom: 0 }}>
                        <div className="detail-item">
                            <span className="detail-label">Servicio de Interés</span>
                            <input type="text" className="select-filter" value={formData.service} onChange={e => setFormData({ ...formData, service: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Presupuesto Estimado</span>
                            <input type="number" className="select-filter" placeholder="0.00" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Probabilidad de Cierre (%)</span>
                            <input type="number" className="select-filter" min="0" max="100" value={formData.probability} onChange={e => setFormData({ ...formData, probability: e.target.value })} />
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Fecha de Contacto</span>
                            <input type="date" className="select-filter" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                    </div>

                    <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="detail-label">Notas</span>
                        <textarea className="notes-area" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                        {editingProspect ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="convert-btn" onClick={() => alert("Simulando conversión a Cliente...")}>
                                    <UserPlus size={16} />
                                    Convertir a Cliente
                                </button>
                                <button type="button" className="btn-icon-sm" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }} onClick={() => handleDelete(editingProspect.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ) : <div></div>}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsModalOpen(false)}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primary">
                                Guardar Prospecto
                            </button>
                        </div>
                    </div>

                </form>
            </Modal>

            <Modal isOpen={itemToDelete !== null} onClose={() => setItemToDelete(null)} title="Confirmar Eliminación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>¿Estás seguro de que deseas eliminar este prospecto? Esta acción no se puede deshacer.</p>
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
