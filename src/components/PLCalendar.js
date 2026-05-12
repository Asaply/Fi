import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './PLCalendar.css';

const PLCalendar = ({ transactions, porCobrar, mode = 'finanzas', accountType = 'debit' }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null); // dateStr | null
    const autoNavigated = useRef(false);

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

        // Filter once per account type (trading passes all)
        const filteredTx = mode === 'finanzas'
            ? transactions.filter(t => (t.account_type || 'debito') === (accountType === 'credit' ? 'credito' : 'debito'))
            : transactions;

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

            filteredTx.forEach(t => {
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
    }, [currentDate, transactions, accountType]);

    // Auto-navigate to the month of the most recent transaction (runs once when transactions load)
    useEffect(() => {
        if (autoNavigated.current || !transactions || transactions.length === 0) return;
        const filtered = mode === 'finanzas'
            ? transactions.filter(t => (t.account_type || 'debito') === (accountType === 'credit' ? 'credito' : 'debito'))
            : transactions;
        if (filtered.length === 0) return;
        const latest = filtered.reduce((max, t) => (t.date > max ? t.date : max), filtered[0].date);
        if (latest) {
            const [y, m] = latest.split('-').map(Number);
            setCurrentDate(new Date(y, m - 1, 1));
            autoNavigated.current = true;
        }
    }, [transactions]);

    const nextMonth = () => {
        setSelectedDay(null);
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setSelectedDay(null);
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleYearChange = (e) => {
        setSelectedDay(null);
        const newYear = parseInt(e.target.value, 10);
        setCurrentDate(new Date(newYear, currentDate.getMonth(), 1));
    };

    const handleMonthChange = (e) => {
        setSelectedDay(null);
        const newMonth = parseInt(e.target.value, 10);
        setCurrentDate(new Date(currentDate.getFullYear(), newMonth, 1));
    };

    const currentYear = currentDate.getFullYear();
    const years = Array.from(new Array(5), (val, index) => currentYear - 2 + index);

    const todayStr = (() => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    })();

    return (
        <div className="pl-calendar-container">
            <div className="pl-calendar-header">
                <div className="pl-calendar-title" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 className="summary-title" style={{ fontSize: "16px", color: "var(--text-primary)", margin: 0 }}>P&L Calendar</h2>
                        <span className="info-icon" title="Profit and Loss Calendar">i</span>
                    </div>
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

                        const isSelected = d.dateStr === selectedDay;
                        return (
                            <div
                                key={d.dateStr}
                                className={`pl-calendar-cell ${pnlClass}${d.dateStr === todayStr ? ' today' : ''}${isSelected ? ' selected-day' : ''}`}
                                onClick={() => setSelectedDay(isSelected ? null : d.dateStr)}
                            >
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

            {/* Day detail panel */}
            {selectedDay && (() => {
                const filteredTx = mode === 'finanzas'
                    ? transactions.filter(t => (t.account_type || 'debito') === (accountType === 'credit' ? 'credito' : 'debito'))
                    : transactions;
                const dayTxs = filteredTx.filter(t => t.date === selectedDay);
                const [y, m, d] = selectedDay.split('-').map(Number);
                const label = `${d} de ${months[m - 1]} ${y}`;
                return (
                    <div className="pl-day-panel">
                        <div className="pl-day-panel-header">
                            <span className="pl-day-panel-title">{label}</span>
                            <button className="pl-day-panel-close" onClick={() => setSelectedDay(null)}><X size={14} /></button>
                        </div>
                        {dayTxs.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Sin movimientos este día.</p>
                        ) : (
                            <ul className="pl-day-tx-list">
                                {dayTxs.map((t, i) => (
                                    <li key={t.id || i} className="pl-day-tx-item">
                                        <div className="pl-day-tx-left">
                                            <span className="pl-day-tx-concept">{t.concept || t.description || '—'}</span>
                                            {t.categoria && <span className="pl-day-tx-cat">{t.categoria}</span>}
                                        </div>
                                        <span className={`pl-day-tx-amount ${t.type === 'Ingreso' ? 'pos' : 'neg'}`}>
                                            {t.type === 'Ingreso' ? '+' : '-'}{formatCurrency(Math.abs(t.amount || 0))}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};

export default PLCalendar;
