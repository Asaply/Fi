'use client';

import { useState } from 'react';
import { useTopbar } from '@/components/TopbarContext';
import { useParams } from 'next/navigation';
import { LayoutTemplate, AlertCircle, Plus } from 'lucide-react';
import Modal from '@/components/Modal';

// Import all Widgets
import RevenueWidget from '@/components/widgets/RevenueWidget';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import LeadsWidget from '@/components/widgets/LeadsWidget';
import ClientsWidget from '@/components/widgets/ClientsWidget';
import NotesWidget from '@/components/widgets/NotesWidget';
import FinancialSummaryWidget from '@/components/widgets/FinancialSummaryWidget';

import './Dashboard.css';
import '@/components/widgets/Widgets.css';

export default function CustomDashboard() {
    const params = useParams();
    const { customDashboards, updateDashboard } = useTopbar();
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

    if (!params || !params.id) return null;

    const dashboard = customDashboards.find(d => d.id === params.id);

    if (!dashboard) {
        return (
            <div className="empty-dashboard-state">
                <AlertCircle size={48} className="empty-icon text-secondary" />
                <h2>Dashboard no encontrado</h2>
                <p className="text-secondary">El tablero que intentas visualizar no existe o fue eliminado.</p>
            </div>
        );
    }

    // Available widget catalog
    const availableWidgets = [
        { id: 'revenue', name: 'Ingresos vs Egresos', component: RevenueWidget },
        { id: 'calendar', name: 'Calendario', component: CalendarWidget },
        { id: 'leads', name: 'Prospectos', component: LeadsWidget },
        { id: 'clients', name: 'Clientes', component: ClientsWidget },
        { id: 'notes', name: 'Notas', component: NotesWidget },
        { id: 'summary', name: 'Resumen Financiero', component: FinancialSummaryWidget },
    ];

    const handleAddWidget = (widgetId) => {
        const newWidget = {
            instanceId: Date.now().toString(),
            typeId: widgetId
        };
        const updatedDashboard = {
            ...dashboard,
            widgets: [...(dashboard.widgets || []), newWidget]
        };
        updateDashboard(dashboard.id, updatedDashboard);
        setIsWidgetModalOpen(false);
    };

    const updateWidgetData = (instanceId, newData) => {
        const updatedWidgets = dashboard.widgets.map(w =>
            w.instanceId === instanceId ? { ...w, data: newData } : w
        );
        updateDashboard(dashboard.id, { ...dashboard, widgets: updatedWidgets });
    };

    const removeWidget = (instanceId) => {
        const updatedWidgets = dashboard.widgets.filter(w => w.instanceId !== instanceId);
        updateDashboard(dashboard.id, { ...dashboard, widgets: updatedWidgets });
    };

    const renderWidget = (widgetInstance) => {
        const widgetConfig = availableWidgets.find(w => w.id === widgetInstance.typeId);
        if (!widgetConfig) return null;

        const WidgetComponent = widgetConfig.component;
        return (
            <WidgetComponent
                key={widgetInstance.instanceId}
                dashboardId={dashboard.id}
                widgetId={widgetInstance.instanceId}
                data={widgetInstance.data}
                updateWidgetData={updateWidgetData}
                removeWidget={removeWidget}
            />
        );
    };

    const hasWidgets = dashboard.widgets && dashboard.widgets.length > 0;

    return (
        <div className="custom-dashboard-container page-container">
            <header className="dashboard-header-simple">
                <div>
                    <h1 className="page-title">{dashboard.name}</h1>
                    <p className="page-subtitle">Tablero de tipo: {dashboard.type}</p>
                </div>
                <button className="btn-primary" onClick={() => setIsWidgetModalOpen(true)}>
                    <Plus size={16} /> Agregar Widget
                </button>
            </header>

            {!hasWidgets ? (
                <div className="dashboard-placeholder card">
                    <LayoutTemplate size={48} className="placeholder-icon" />
                    <h3>Tablero Vacío</h3>
                    <p className="text-secondary text-center max-w-md">
                        Este es un nuevo tablero de {dashboard.type.toLowerCase()}.
                        Añade widgets para personalizar tus métricas.
                    </p>
                    <button className="btn-secondary mt-4" onClick={() => setIsWidgetModalOpen(true)}>Explorar Widgets</button>
                </div>
            ) : (
                <div className="widgets-grid">
                    {dashboard.widgets.map(renderWidget)}
                </div>
            )}

            <Modal
                isOpen={isWidgetModalOpen}
                onClose={() => setIsWidgetModalOpen(false)}
                title="Agregar Widget"
            >
                <div className="widget-selection-list">
                    <p className="text-secondary modal-desc mb-4">Selecciona el módulo que deseas agregar a tu tablero.</p>
                    <div className="widget-options">
                        {availableWidgets.map(widget => (
                            <button
                                key={widget.id}
                                className="widget-option-btn card"
                                onClick={() => handleAddWidget(widget.id)}
                            >
                                <span className="font-medium text-primary">{widget.name}</span>
                                <Plus size={16} className="text-secondary" />
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
