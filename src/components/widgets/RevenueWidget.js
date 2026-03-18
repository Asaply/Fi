'use client';
import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Edit2, Trash2, Check } from 'lucide-react';

export default function RevenueWidget({ widgetId, data = {}, updateWidgetData, removeWidget }) {
    const [isEditing, setIsEditing] = useState(false);
    const [localData, setLocalData] = useState({
        title: data.title || 'Ingresos vs Egresos',
        income: data.income || 45200,
        expenses: data.expenses || 12450
    });

    const netBalance = localData.income - localData.expenses;

    const handleSave = () => {
        updateWidgetData(widgetId, localData);
        setIsEditing(false);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    return (
        <div className="widget-card revenue-widget">
            <h4 className="widget-title">
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
            <div className="widget-content">
                <div className="stat-group">
                    <div className="stat-label"><TrendingUp size={16} className="text-success" /> Ingresos este mes</div>
                    {isEditing ? (
                        <input
                            type="number"
                            className="widget-input"
                            value={localData.income}
                            onChange={(e) => setLocalData({ ...localData, income: Number(e.target.value) })}
                        />
                    ) : (
                        <div className="stat-value text-success">{formatCurrency(localData.income)}</div>
                    )}
                </div>
                <div className="stat-group">
                    <div className="stat-label"><TrendingDown size={16} className="text-danger" /> Egresos este mes</div>
                    {isEditing ? (
                        <input
                            type="number"
                            className="widget-input"
                            value={localData.expenses}
                            onChange={(e) => setLocalData({ ...localData, expenses: Number(e.target.value) })}
                        />
                    ) : (
                        <div className="stat-value text-danger">{formatCurrency(localData.expenses)}</div>
                    )}
                </div>
                <div className="stat-group total">
                    <div className="stat-label"><DollarSign size={16} className="text-primary" /> Balance Neto</div>
                    <div className="stat-value">{formatCurrency(netBalance)}</div>
                </div>
            </div>
        </div>
    );
}
