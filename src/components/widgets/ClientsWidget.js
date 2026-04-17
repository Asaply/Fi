'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Star, Edit2, Trash2, Check, Plus, Link } from 'lucide-react';

export default function ClientsWidget({ widgetId, data = {}, updateWidgetData, removeWidget }) {
    const router = useRouter();
    const defaultClients = [
        { id: 1, name: 'Acme Corp', project: 'Rediseño Web', health: 'Excelente', url: '/clientes' },
        { id: 2, name: 'Consultoría Silva', project: 'App Móvil', health: 'En Riesgo', url: '/clientes' },
        { id: 3, name: 'Logística Pro', project: 'Mantenimiento', health: 'Estable', url: '/clientes' },
    ];

    const [isEditing, setIsEditing] = useState(false);
    const [localTitle, setLocalTitle] = useState(data.title || 'Clientes Activos');
    const [localClients, setLocalClients] = useState(data.clients || defaultClients);

    const handleSave = () => {
        updateWidgetData(widgetId, { title: localTitle, clients: localClients });
        setIsEditing(false);
    };

    const handleClientChange = (id, field, value) => {
        setLocalClients(localClients.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addClient = () => {
        setLocalClients([...localClients, { id: Date.now(), name: 'Nuevo Cliente', project: 'Proyecto X', health: 'Estable', url: '' }]);
    };

    const removeClient = (id) => {
        setLocalClients(localClients.filter(c => c.id !== id));
    };

    const getHealthColor = (health) => {
        if (health === 'Excelente') return 'text-success';
        if (health === 'En Riesgo') return 'text-danger';
        return 'text-secondary';
    };

    return (
        <div className="widget-card clients-widget">
            <h4 className="widget-title">
                <Users size={18} className="title-icon" />
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
                            <button onClick={addClient} className="widget-action-btn" title="Agregar Cliente">
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
                {!isEditing && localClients.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p className="text-secondary text-sm" style={{ margin: 0 }}>No tienes clientes registrados.</p>
                    </div>
                ) : (
                    <ul className="widget-list">
                        {localClients.map(client => (
                            <li
                                key={client.id}
                                className={`widget-list-item client-item ${!isEditing && client.url ? 'clickable' : ''}`}
                                onClick={() => {
                                    if (!isEditing && client.url) {
                                        router.push(client.url);
                                    }
                                }}
                            >
                                {isEditing ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                        <input
                                            className="widget-input"
                                            value={client.name}
                                            onChange={(e) => handleClientChange(client.id, 'name', e.target.value)}
                                            placeholder="Nombre del cliente"
                                        />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                className="widget-input"
                                                value={client.project}
                                                onChange={(e) => handleClientChange(client.id, 'project', e.target.value)}
                                                placeholder="Proyecto"
                                                style={{ flex: 1 }}
                                            />
                                            <select
                                                className="widget-input"
                                                value={client.health}
                                                onChange={(e) => handleClientChange(client.id, 'health', e.target.value)}
                                                style={{ width: '110px' }}
                                            >
                                                <option value="Excelente">Excelente</option>
                                                <option value="Estable">Estable</option>
                                                <option value="En Riesgo">En Riesgo</option>
                                            </select>
                                            <button onClick={() => removeClient(client.id)} className="widget-action-btn delete" style={{ background: 'rgba(255,59,48,0.1)' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <Link size={14} className="text-secondary" />
                                            <input
                                                className="widget-input"
                                                value={client.url || ''}
                                                onChange={(e) => handleClientChange(client.id, 'url', e.target.value)}
                                                placeholder="Enlace (Ej. /clientes o https://...)"
                                                style={{ flex: 1, fontSize: '12px' }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="client-info">
                                            <span className="client-name">{client.name}</span>
                                            <span className="client-project text-secondary">{client.project}</span>
                                        </div>
                                        <div className={`client-health ${getHealthColor(client.health)}`}>
                                            <Star size={12} className="inline-icon" /> {client.health}
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
