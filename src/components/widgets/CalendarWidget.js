'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, Clock, Edit2, Trash2, Check, Plus, Link } from 'lucide-react';

export default function CalendarWidget({ widgetId, data = {}, updateWidgetData, removeWidget }) {
    const router = useRouter();
    const defaultEvents = [
        { id: 1, title: 'Reunión con Inversionistas', time: '10:00 AM', url: '' },
        { id: 2, title: 'Revisión de Marketing', time: '01:30 PM', url: '' },
        { id: 3, title: 'Entrevista', time: '04:00 PM', url: '' }
    ];

    const [isEditing, setIsEditing] = useState(false);
    const [localTitle, setLocalTitle] = useState(data.title || 'Próximos Eventos');
    const [localEvents, setLocalEvents] = useState(data.events || defaultEvents);

    const handleSave = () => {
        updateWidgetData(widgetId, { title: localTitle, events: localEvents });
        setIsEditing(false);
    };

    const handleEventChange = (id, field, value) => {
        setLocalEvents(localEvents.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const addEvent = () => {
        setLocalEvents([...localEvents, { id: Date.now(), title: 'Nuevo Evento', time: '12:00 PM', url: '' }]);
    };

    const removeEvent = (id) => {
        setLocalEvents(localEvents.filter(e => e.id !== id));
    };

    return (
        <div className="widget-card calendar-widget">
            <h4 className="widget-title">
                <CalendarIcon size={18} className="title-icon" />
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
                            <button onClick={addEvent} className="widget-action-btn" title="Agregar Evento">
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
                    {localEvents.map(event => (
                        <li
                            key={event.id}
                            className={`widget-list-item ${!isEditing && event.url ? 'clickable' : ''}`}
                            onClick={() => {
                                if (!isEditing && event.url) {
                                    router.push(event.url);
                                }
                            }}
                        >
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                    <input
                                        className="widget-input"
                                        value={event.title}
                                        onChange={(e) => handleEventChange(event.id, 'title', e.target.value)}
                                        placeholder="Título del evento"
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            className="widget-input"
                                            value={event.time}
                                            onChange={(e) => handleEventChange(event.id, 'time', e.target.value)}
                                            placeholder="Ej. 10:00 AM"
                                            style={{ flex: 1 }}
                                        />
                                        <button onClick={() => removeEvent(event.id)} className="widget-action-btn delete" style={{ background: 'rgba(255,59,48,0.1)' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <Link size={14} className="text-secondary" />
                                        <input
                                            className="widget-input"
                                            value={event.url || ''}
                                            onChange={(e) => handleEventChange(event.id, 'url', e.target.value)}
                                            placeholder="Enlace (Ej. /airbnb o https://...)"
                                            style={{ flex: 1, fontSize: '12px' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span className="event-title">{event.title}</span>
                                    <span className="event-time text-secondary"><Clock size={12} /> {event.time}</span>
                                </>
                            )}
                        </li>
                    ))}
                    {!isEditing && localEvents.length === 0 && (
                        <p className="text-secondary text-sm">No hay eventos programados.</p>
                    )}
                </ul>
            </div>
        </div>
    );
}
