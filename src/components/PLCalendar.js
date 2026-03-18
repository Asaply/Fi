import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './PLCalendar.css';

const PLCalendar = ({ transactions }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState([]);

    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
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
            let hasData = false;

            transactions.forEach(t => {
                if (t.date === dateStr) {
                    hasData = true;
                    if (t.type === 'Ingreso') dailyIngresos += t.amount;
                    if (t.type === 'Egreso') dailyEgresos += t.amount;
                }
            });

            const pnl = dailyIngresos - dailyEgresos;

            days.push({
                day,
                dateStr,
                pnl,
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
                <div className="pl-calendar-title">
                    <h2 className="summary-title" style={{ fontSize: "16px", color: "var(--text-primary)", margin: 0 }}>P&L Calendar</h2>
                    <span className="info-icon" title="Profit and Loss Calendar">i</span>
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
                                displayPnl = `+${d.pnl.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            } else if (d.pnl < 0) {
                                pnlClass = "pnl-negative";
                                displayPnl = `${d.pnl.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            } else {
                                displayPnl = "0.00";
                            }
                        }

                        return (
                            <div key={d.dateStr} className={`pl-calendar-cell ${pnlClass}`}>
                                <div className="pl-calendar-date">{d.day}</div>
                                <div className="pl-calendar-amount">{displayPnl}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PLCalendar;
