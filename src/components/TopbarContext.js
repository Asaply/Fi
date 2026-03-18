'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from './Topbar';
import Modal from './Modal';

const TopbarContext = createContext();

export function TopbarProvider({ children }) {
    const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
    const [customDashboards, setCustomDashboards] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('fnce_custom_dashboards');
        if (saved) {
            try {
                setCustomDashboards(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse dashboards", e);
            }
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('fnce_custom_dashboards', JSON.stringify(customDashboards));
        }
    }, [customDashboards, isLoaded]);

    const handleNewClick = () => {
        setIsDashboardModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsDashboardModalOpen(false);
    };

    const addDashboard = (dashboard) => {
        setCustomDashboards([...customDashboards, { ...dashboard, widgets: dashboard.widgets || [] }]);
    };

    const updateDashboard = (id, updatedDashboard) => {
        const newDashboards = customDashboards.map(d => d.id === id ? updatedDashboard : d);
        setCustomDashboards(newDashboards);
    };

    return (
        <TopbarContext.Provider value={{
            handleNewClick,
            isDashboardModalOpen,
            handleCloseModal,
            customDashboards,
            addDashboard,
            updateDashboard
        }}>
            {children}
        </TopbarContext.Provider>
    );
}

export function useTopbar() {
    return useContext(TopbarContext);
}

export function TopbarLayout({ children }) {
    const { handleNewClick, isDashboardModalOpen, handleCloseModal, addDashboard } = useTopbar();
    const router = useRouter();
    const [newDashboard, setNewDashboard] = useState({ name: '', type: 'Financiero' });

    const handleCreateDashboard = () => {
        if (!newDashboard.name.trim()) return;

        const newId = newDashboard.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const dashboardEntry = {
            id: newId,
            name: newDashboard.name,
            type: newDashboard.type,
            createdAt: new Date().toISOString(),
            widgets: []
        };

        addDashboard(dashboardEntry);
        handleCloseModal();
        setNewDashboard({ name: '', type: 'Financiero' });
        router.push(`/dashboards/${newId}`);
    };

    return (
        <div className="main-area">
            <Topbar onNewClick={handleNewClick} />
            <main className="main-content">
                {children}
            </main>

            <Modal
                isOpen={isDashboardModalOpen}
                onClose={handleCloseModal}
                title="Crear Nuevo Dashboard"
            >
                <div className="modal-form-container">
                    <p className="text-secondary modal-desc">Configura tu nuevo tablero analítico.</p>
                    <div className="form-group">
                        <label>Nombre del Dashboard</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej: Reporte Trimestral"
                            value={newDashboard.name}
                            onChange={(e) => setNewDashboard({ ...newDashboard, name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Tipo de Dashboard</label>
                        <select
                            className="form-input select-filter"
                            value={newDashboard.type}
                            onChange={(e) => setNewDashboard({ ...newDashboard, type: e.target.value })}
                        >
                            <option value="Financiero">Financiero</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Ventas">Ventas</option>
                            <option value="Operaciones">Operaciones</option>
                            <option value="Airbnb / Rentas">Airbnb / Rentas</option>
                        </select>
                    </div>
                    <div className="modal-actions mt-4">
                        <button className="btn-secondary" onClick={handleCloseModal}>Cancelar</button>
                        <button
                            className="btn-primary"
                            onClick={handleCreateDashboard}
                            disabled={!newDashboard.name.trim()}
                        >
                            Crear Dashboard
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
