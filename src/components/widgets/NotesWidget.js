'use client';
import { useState } from 'react';
import { FileText, Save, Trash2 } from 'lucide-react';

export default function NotesWidget({ widgetId, data = {}, updateWidgetData, removeWidget }) {
    const [title, setTitle] = useState(data.title || "Notas Rápidas");
    const [note, setNote] = useState(data.note || "");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        updateWidgetData(widgetId, { title, note });
        setIsEditingTitle(false);
        setTimeout(() => setIsSaving(false), 500);
    };

    return (
        <div className="widget-card notes-widget">
            <h4 className="widget-title flex-between">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginRight: '16px' }}>
                    <FileText size={18} className="title-icon" />
                    {isEditingTitle ? (
                        <input
                            className="widget-title-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={() => setIsEditingTitle(false)}
                            autoFocus
                        />
                    ) : (
                        <span onClick={() => setIsEditingTitle(true)} style={{ cursor: 'pointer' }} title="Haz clic para editar título">
                            {title}
                        </span>
                    )}
                </span>
                <div className="widget-header-actions">
                    <button onClick={handleSave} className="widget-action-btn save" title="Guardar cambíos">
                        <Save size={16} className={isSaving ? 'spin-anim' : ''} />
                    </button>
                    <button onClick={() => removeWidget(widgetId)} className="widget-action-btn delete" title="Eliminar Widget">
                        <Trash2 size={16} />
                    </button>
                </div>
            </h4>
            <div className="widget-content">
                <textarea
                    className="notes-textarea"
                    placeholder="Escribe tus ideas aquí..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
            </div>
        </div>
    );
}
