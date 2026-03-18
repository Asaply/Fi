'use client';
import { useState } from 'react';
import { LineChart, Activity, Briefcase, Edit2, Trash2, Check } from 'lucide-react';

export default function FinancialSummaryWidget({ widgetId, data = {}, updateWidgetData, removeWidget }) {
    const [isEditing, setIsEditing] = useState(false);
    const [localData, setLocalData] = useState({
        title: data.title || 'Resumen Financiero',
        capital: data.capital || 125500,
        margin: data.margin || 24.5,
        receivables: data.receivables || 8200,
        payables: data.payables || 3150
    });

    const handleSave = () => {
        updateWidgetData(widgetId, localData);
        setIsEditing(false);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    return (
        <div className="widget-card financial-summary-widget">
            <h4 className="widget-title">
                <LineChart size={18} className="title-icon text-primary" />
                {isEditing ? (
                    <input
                        className="widget-title-input"
                        value={localData.title}
                        onChange={(e) => setLocalData({ ...localData, title: e.target.value })}
                    />
                ) : (
                    localData.title
                )}
                <div className="widget-header-actions">
                    {isEditing ? (
                        <button onClick={handleSave} className="widget-action-btn save" title="Guardar">
                            <Check size={16} />
                        </button>
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
            <div className="widget-content summary-grid">
                <div className="summary-box">
                    <span className="summary-label text-secondary">Capital Total</span>
                    {isEditing ? (
                        <input className="widget-input" type="number" value={localData.capital} onChange={e => setLocalData({ ...localData, capital: Number(e.target.value) })} />
                    ) : (
                        <span className="summary-value text-xl">{formatCurrency(localData.capital)}</span>
                    )}
                </div>
                <div className="summary-box">
                    <span className="summary-label text-secondary"><Activity size={14} className="inline-icon" /> Margen de Beneficio</span>
                    {isEditing ? (
                        <input className="widget-input" type="number" step="0.1" value={localData.margin} onChange={e => setLocalData({ ...localData, margin: Number(e.target.value) })} />
                    ) : (
                        <span className="summary-value text-xl">{localData.margin}%</span>
                    )}
                </div>
                <div className="summary-box">
                    <span className="summary-label text-secondary"><Briefcase size={14} className="inline-icon" /> C. por Cobrar</span>
                    {isEditing ? (
                        <input className="widget-input" type="number" value={localData.receivables} onChange={e => setLocalData({ ...localData, receivables: Number(e.target.value) })} />
                    ) : (
                        <span className="summary-value text-xl text-warning">{formatCurrency(localData.receivables)}</span>
                    )}
                </div>
                <div className="summary-box">
                    <span className="summary-label text-secondary">C. por Pagar</span>
                    {isEditing ? (
                        <input className="widget-input" type="number" value={localData.payables} onChange={e => setLocalData({ ...localData, payables: Number(e.target.value) })} />
                    ) : (
                        <span className="summary-value text-xl text-danger">{formatCurrency(localData.payables)}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
