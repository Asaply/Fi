'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, ArrowRight, Edit2, Trash2, Check, Plus, Link } from 'lucide-react';

export default function LeadsWidget({ widgetId, data = {}, updateWidgetData, removeWidget }) {
    const router = useRouter();
    const defaultLeads = [
        { id: 1, name: 'TechCorp Solutions', status: 'En Negociación', amount: '$15k', url: '/prospectos' },
        { id: 2, name: 'Boutique "La Moda"', status: 'Contacto Inicial', amount: '$3k', url: '/prospectos' },
    ];

    const [isEditing, setIsEditing] = useState(false);
    const [localTitle, setLocalTitle] = useState(data.title || 'Últimos Prospectos');
    const [localLeads, setLocalLeads] = useState(data.leads || defaultLeads);

    const handleSave = () => {
        updateWidgetData(widgetId, { title: localTitle, leads: localLeads });
        setIsEditing(false);
    };

    const handleLeadChange = (id, field, value) => {
        setLocalLeads(localLeads.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const addLead = () => {
        setLocalLeads([...localLeads, { id: Date.now(), name: 'Nuevo Prospecto', status: 'En Contacto', amount: '$1k', url: '' }]);
    };

    const removeLead = (id) => {
        setLocalLeads(localLeads.filter(l => l.id !== id));
    };

    return (
        <div className="widget-card leads-widget">
            <h4 className="widget-title">
                <Target size={18} className="title-icon" />
                {isEditing ? (
                    <input
                        className="widget-title-input"
                        value={localTitle}
                        onChange={(e) => setLocalTitle(e.target.value)}
                    />
                ) : (
                    localTitle
                )}
                <div className="widget-header-actions">
                    {isEditing ? (
                        <>
                            <button onClick={addLead} className="widget-action-btn" title="Agregar Prospecto">
                                <Plus size={16} />
                            </button>
                            <button onClick={handleSave} className="widget-action-btn save" title="Guardar">
                                <Check size={16} />
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="widget-action-btn edit" title="Editar">
                            <Edit2 size={14} />
                        </button>
                    )}
                    <button onClick={() => removeWidget(widgetId)} className="widget-action-btn delete" title="Eliminar Widget">
                        <Trash2 size={14} />
                    </button>
                </div>
            </h4>
            <div className="widget-content">
                <ul className="widget-list">
                    {localLeads.map(lead => (
                        <li
                            key={lead.id}
                            className={`widget-list-item lead-item ${!isEditing && lead.url ? 'clickable' : ''}`}
                            onClick={() => {
                                if (!isEditing && lead.url) {
                                    router.push(lead.url);
                                }
                            }}
                        >
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                    <input
                                        className="widget-input"
                                        value={lead.name}
                                        onChange={(e) => handleLeadChange(lead.id, 'name', e.target.value)}
                                        placeholder="Empresa o Persona"
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            className="widget-input"
                                            value={lead.status}
                                            onChange={(e) => handleLeadChange(lead.id, 'status', e.target.value)}
                                            placeholder="Status"
                                            style={{ flex: 1 }}
                                        />
                                        <input
                                            className="widget-input"
                                            value={lead.amount}
                                            onChange={(e) => handleLeadChange(lead.id, 'amount', e.target.value)}
                                            placeholder="Monto"
                                            style={{ width: '80px' }}
                                        />
                                        <button onClick={() => removeLead(lead.id)} className="widget-action-btn delete" style={{ background: 'rgba(255,59,48,0.1)' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <Link size={14} className="text-secondary" />
                                        <input
                                            className="widget-input"
                                            value={lead.url || ''}
                                            onChange={(e) => handleLeadChange(lead.id, 'url', e.target.value)}
                                            placeholder="Enlace (Ej. /prospectos o https://...)"
                                            style={{ flex: 1, fontSize: '12px' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="lead-info">
                                        <span className="lead-name">{lead.name}</span>
                                        <span className="lead-status">{lead.status}</span>
                                    </div>
                                    <div className="lead-action">
                                        <span className="lead-amount">{lead.amount}</span>
                                        <ArrowRight size={14} className="text-secondary" />
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                    {!isEditing && localLeads.length === 0 && (
                        <p className="text-secondary text-sm">No tienes prospectos activos.</p>
                    )}
                </ul>
            </div>
        </div>
    );
}
