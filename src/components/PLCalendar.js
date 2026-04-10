import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './PLCalendar.css';

const PLCalendar = ({ transactions, porCobrar, mode = 'finanzas' }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState([]);

    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const formatCompact = (amount) => {
        if (Math.abs(amount) >= 1000000) {
            return (amount / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (Math.abs(amount) >= 1000) {
            return (amount / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return amount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const generateCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let days = [];

        // Add empty slots for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({ day: null, dateStr: '', pnl: 0, hasData: false });
        }

        // Add all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            // Adjust to YYYY-MM-DD local format
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Calculate PnL for this day
            let dailyIngresos = 0;
            let dailyEgresos = 0;
            let dailyGastosPersonales = 0;
            let dailyInversiones = 0;
            let tradingPnl = 0;
            let hasData = false;

            transactions.forEach(t => {
                if (t.date === dateStr) {
                    hasData = true;
                    if (mode === 'finanzas') {
                        if (t.type === 'Ingreso') dailyIngresos += t.amount || 0;
                        if (t.type === 'Egreso') dailyEgresos += t.amount || 0;
                        if (t.type === 'Gasto Personal') dailyGastosPersonales += t.amount || 0;
                        if (t.type === 'Inversión') dailyInversiones += t.amount || 0;
                    } else if (mode === 'trading') {
                        if (t.status === 'Cerrado' || t.status === 'Closed') {
                            tradingPnl += t.pnl || 0;
                        }
                    }
                }
            });

            const pnl = mode === 'trading' ? tradingPnl : (dailyIngresos - dailyEgresos);

            days.push({
                day,
                dateStr,
                pnl,
                gastos: dailyGastosPersonales,
                inversiones: dailyInversiones,
                hasData
            });
        }

        setCalendarDays(days);
    };

    useEffect(() => {
        generateCalendar();
    }, [currentDate, transactions]);

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleYearChange = (e) => {
        const newYear = parseInt(e.target.value, 10);
        setCurrentDate(new Date(newYear, currentDate.getMonth(), 1));
    };

    const handleMonthChange = (e) => {
        const newMonth = parseInt(e.target.value, 10);
        setCurrentDate(new Date(currentDate.getFullYear(), newMonth, 1));
    };

    const currentYear = currentDate.getFullYear();
    const years = Array.from(new Array(5), (val, index) => currentYear - 2 + index);

    return (
        <div className="pl-calendar-container">
            <div className="pl-calendar-header">
                <div className="pl-calendar-title" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 className="summary-title" style={{ fontSize: "16px", color: "var(--text-primary)", margin: 0 }}>P&L Calendar</h2>
                        <span className="info-icon" title="Profit and Loss Calendar">i</span>
                    </div>
                    {porCobrar !== undefined && porCobrar > 0 && (
                        <div style={{ background: 'rgba(245, 166, 35, 0.1)', padding: '4px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#f5a623', fontWeight: 600 }}>⏳ Por Cobrar: {formatCurrency(porCobrar)}</span>
                        </div>
                    )}
                </div>

                <div className="pl-calendar-controls">
                    <div className="month-year-selects filters-group">
                        <select
                            className="select-filter"
                            value={currentDate.getMonth()}
                            onChange={handleMonthChange}
                        >
                            {months.map((m, idx) => (
                                <option key={idx} value={idx}>{m}</option>
                            ))}
                        </select>
                        <select
                            className="select-filter"
                            value={currentYear}
                            onChange={handleYearChange}
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="pl-calendar-grid-wrapper">
                <div className="pl-calendar-grid">
                    {/* Weekday headers */}
                    <div className="pl-calendar-weekday">Dom</div>
                    <div className="pl-calendar-weekday">Lun</div>
                    <div className="pl-calendar-weekday">Mar</div>
                    <div className="pl-calendar-weekday">Mié</div>
                    <div className="pl-calendar-weekday">Jue</div>
                    <div className="pl-calendar-weekday">Vie</div>
                    <div className="pl-calendar-weekday">Sáb</div>

                    {/* Days */}
                    {calendarDays.map((d, idx) => {
                        if (!d.day) {
                            return <div key={`empty-${idx}`} className="pl-calendar-cell empty-cell"></div>;
                        }

                        let pnlClass = "pnl-neutral";
                        let displayPnl = d.hasData ? "0.00" : "--";

                        if (d.hasData) {
                            if (d.pnl > 0) {
                                pnlClass = "pnl-positive";
                                displayPnl = `+${formatCompact(d.pnl)}`;
                            } else if (d.pnl < 0) {
                                pnlClass = "pnl-negative";
                                displayPnl = `${formatCompact(d.pnl)}`;
                            } else {
                                displayPnl = "0.00";
                            }
                        }

                        return (
                            <div key={d.dateStr} className={`pl-calendar-cell ${pnlClass}`}>
                                <div className="pl-calendar-date">{d.day}</div>
                                <div className="pl-calendar-amount">{displayPnl}</div>
                                {d.hasData && (d.gastos > 0 || d.inversiones > 0) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', textAlign: 'center', width: '100%' }}>
                                        {d.inversiones > 0 && <span style={{ fontSize: '9px', color: '#0A84FF', fontWeight: 600, background: 'rgba(10, 132, 255, 0.1)', padding: '2px', borderRadius: '4px', wordBreak: 'break-all' }}>Inv: ${formatCompact(d.inversiones)}</span>}
                                        {d.gastos > 0 && <span style={{ fontSize: '9px', color: '#8E8E93', fontWeight: 600, background: 'rgba(142, 142, 147, 0.1)', padding: '2px', borderRadius: '4px', wordBreak: 'break-all' }}>GP: -${formatCompact(d.gastos)}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PLCalendar;
