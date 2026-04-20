'use client';
import { useState, useEffect } from 'react';
import { getFilter, setFilter } from '@/lib/filterMemory';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboarding } from '@/hooks/useOnboarding';
import { DASHBOARD_STEPS } from '@/components/onboarding/tourSteps';
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
    const { isActive: tourActive, complete: tourComplete, skip: tourSkip, reset: resetTour } = useOnboarding('dashboard');
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
                onComplete={tourComplete}
                onSkip={tourSkip}
            />
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={resetTour} style={{ background: 'none', border: '1px solid #222222', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: '50%', lineHeight: 1, width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="¿Cómo usar esta sección?">?</button>
                    <div className="period-filter-wrap" style={{ display: 'inline-flex' }} data-tour="time-filter">
                        {PERIODOS.map(p => (
                            <button
                                key={p.value}
                                className={`period-filter-btn ${periodo === p.value ? 'active' : ''}`}
                                style={{ border: 'none', cursor: 'pointer' }}
                                onClick={() => { setFilter('dashboard', p.value); setPeriodo(p.value); }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

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
