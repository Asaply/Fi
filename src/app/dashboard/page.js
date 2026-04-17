'use client';
import { useState, useEffect } from 'react';
import { getFilter, setFilter } from '@/lib/filterMemory';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboarding } from '@/hooks/useOnboarding';

const DASHBOARD_STEPS = [
    { target: '[data-tour="time-filter"]', title: 'Filtra por período', description: 'Cambia el rango de tiempo para ver tus datos por mes, trimestre o año.', position: 'bottom' },
    { target: '[data-tour="resumen-finanzas"]', title: 'Resumen de Finanzas', description: 'Aquí ves tus ingresos, egresos y ganancia neta del período seleccionado.', position: 'bottom' },
    { target: '[data-tour="resumen-trading"]', title: 'Resumen de Trading', description: 'Tu P&L total y win rate de operaciones cerradas en el período.', position: 'bottom' },
    { target: '[data-tour="gastos-categoria"]', title: 'Gastos por categoría', description: 'Visualiza en qué estás gastando y en qué proporción.', position: 'top' },
];
import CardFinanzas from './components/CardFinanzas';
import CardTrading from './components/CardTrading';
import CardPortfolio from './components/CardPortfolio';
import GastosPorCategoria from '@/components/GastosPorCategoria';
import ReporteMensual from '@/components/ReporteMensual';
import Recordatorios from '@/components/Recordatorios';
import './Dashboard.css';

const PERIODOS = [
    { value: '1m', label: 'Este mes' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
    { value: '1y', label: '1 año' },
];

function getFechaInicio(periodo) {
    const now = new Date();
    switch (periodo) {
        case '1m':
            return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        case '3m':
            return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        case '6m':
            return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
        case '1y':
            return new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
        default:
            return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
}

export default function DashboardPage() {
    const { isActive: tourActive, currentStep: tourStep, next: tourNext, complete: tourComplete, skip: tourSkip, resetTour } = useOnboarding('dashboard');
    const [periodo, setPeriodo] = useState('3m');

    useEffect(() => {
        const saved = getFilter('dashboard');
        if (saved) setPeriodo(saved);
    }, []);

    const fechaInicio = getFechaInicio(periodo);

    return (
        <div className="page-container">
            <OnboardingTour
                steps={DASHBOARD_STEPS}
                isActive={tourActive}
                currentStep={tourStep}
                onNext={() => tourNext(DASHBOARD_STEPS.length)}
                onComplete={tourComplete}
                onSkip={tourSkip}
            />
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Resumen financiero del período</p>
                </div>
                <div className="time-filter-group" data-tour="time-filter">
                    {PERIODOS.map(p => (
                        <button
                            key={p.value}
                            className={`time-filter-btn${periodo === p.value ? ' active' : ''}`}
                            onClick={() => { setFilter('dashboard', p.value); setPeriodo(p.value); }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={resetTour} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: 0, marginBottom: '16px', display: 'block' }}>
                ¿Cómo usar esta sección?
            </button>

            {/* Cards grid */}
            <div className="dashboard-grid">
                <div data-tour="resumen-finanzas">
                    <CardFinanzas fechaInicio={fechaInicio} />
                </div>
                <div data-tour="resumen-trading">
                    <CardTrading fechaInicio={fechaInicio} />
                </div>
                <div className="dashboard-full-width" data-tour="gastos-categoria">
                    <GastosPorCategoria startDate={fechaInicio} />
                </div>
                <div className="dashboard-full-width">
                    <ReporteMensual startDate={fechaInicio} />
                </div>
                <div className="dashboard-full-width">
                    <CardPortfolio />
                </div>
                <div className="dashboard-full-width">
                    <Recordatorios />
                </div>
            </div>
        </div>
    );
}
