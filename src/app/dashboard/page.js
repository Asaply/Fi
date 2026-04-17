'use client';
import { useState, useEffect } from 'react';
import { getFilter, setFilter } from '@/lib/filterMemory';
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
    const [periodo, setPeriodo] = useState('3m');

    useEffect(() => {
        const saved = getFilter('dashboard');
        if (saved) setPeriodo(saved);
    }, []);

    const fechaInicio = getFechaInicio(periodo);

    return (
        <div className="page-container">
            {/* Period selector */}
            <div className="dashboard-topbar">
                <div className="dashboard-periodo-selector">
                    {PERIODOS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => { setFilter('dashboard', p.value); setPeriodo(p.value); }}
                            className={`dashboard-periodo-btn${periodo === p.value ? ' active' : ''}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cards grid */}
            <div className="dashboard-grid">
                <CardFinanzas fechaInicio={fechaInicio} />
                <CardTrading fechaInicio={fechaInicio} />
                <div className="dashboard-full-width">
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
