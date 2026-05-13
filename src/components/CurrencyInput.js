'use client';
import { useState, useEffect } from 'react';

const formatWithCommas = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return '';
    const str = String(raw);
    const negative = str.startsWith('-');
    const abs = negative ? str.slice(1) : str;
    const parts = abs.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? '-' : '') + parts.join('.');
};

export default function CurrencyInput({ value, onChange, allowNegative = false, ...props }) {
    const [display, setDisplay] = useState(
        value !== '' && value != null ? formatWithCommas(value) : ''
    );

    useEffect(() => {
        // Sync only when parent resets/changes value from outside
        const rawDisplay = display.replace(/,/g, '');
        if (String(value ?? '') !== rawDisplay) {
            setDisplay(value !== '' && value != null ? formatWithCommas(String(value)) : '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e) => {
        const raw = e.target.value.replace(/,/g, '');
        const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
        if (raw !== '' && !pattern.test(raw)) return;
        setDisplay(formatWithCommas(raw));
        if (onChange) {
            onChange({ ...e, target: { ...e.target, value: raw } });
        }
    };

    return (
        <input
            {...props}
            type="text"
            inputMode="decimal"
            value={display}
            onChange={handleChange}
        />
    );
}
