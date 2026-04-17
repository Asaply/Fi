'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';

const PRESET_COLORS = ['#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#A855F7'];

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

function toISODate(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function Recordatorios() {
    const today = new Date();
    const todayStr = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', date: todayStr, time: '', color: '#3B82F6' });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            const { data } = await supabase
                .from('reminders')
                .select('*')
                .eq('user_id', user?.id)
                .order('date', { ascending: true });
            setReminders(data || []);
            setLoading(false);
        };
        load();
    }, []);

    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);

    const reminderDates = useMemo(() => new Set(reminders.map(r => r.date)), [reminders]);

    const dayReminders = useMemo(() =>
        reminders.filter(r => r.date === selectedDate)
            .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
        [reminders, selectedDate]
    );

    const prevMonth = () => {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    };

    const nextMonth = () => {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    };

    const handleAddReminder = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.date) return;
        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            user_id: user.id,
            title: form.title.trim(),
            description: form.description.trim() || null,
            date: form.date,
            time: form.time || null,
            color: form.color,
        };
        const { data, error } = await supabase.from('reminders').insert([payload]).select();
        if (!error && data?.[0]) {
            setReminders(prev => [...prev, data[0]].sort((a, b) => a.date.localeCompare(b.date)));
            setIsModalOpen(false);
            setForm({ title: '', description: '', date: selectedDate, time: '', color: '#3B82F6' });
        }
    };

    const handleToggleComplete = async (id, completed) => {
        const { error } = await supabase.from('reminders').update({ completed: !completed }).eq('id', id);
        if (!error) setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !completed } : r));
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('reminders').delete().eq('id', id);
        if (!error) setReminders(prev => prev.filter(r => r.id !== id));
    };

    const calDays = [];
    for (let i = 0; i < firstDay; i++) calDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                    Recordatorios
                </h2>
                <button
                    onClick={() => { setForm(f => ({ ...f, date: selectedDate })); setIsModalOpen(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' }}
                >
                    <Plus size={12} /> Agregar
                </button>
            </div>

            {/* Two-column layout: calendar + day list */}
            <div className="recordatorios-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Mini calendar */}
                <div className="recordatorios-calendario">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 8px', fontSize: '16px', lineHeight: 1 }}>‹</button>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {MONTHS_ES[calMonth]} {calYear}
                        </span>
                        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 8px', fontSize: '16px', lineHeight: 1 }}>›</button>
                    </div>

                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
                        {DAYS_ES.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, padding: '2px 0' }}>{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                        {calDays.map((day, idx) => {
                            if (!day) return <div key={`e-${idx}`} />;
                            const dateStr = toISODate(calYear, calMonth, day);
                            const isSelected = dateStr === selectedDate;
                            const isToday = dateStr === todayStr;
                            const hasReminder = reminderDates.has(dateStr);
                            return (
                                <div
                                    key={day}
                                    onClick={() => setSelectedDate(dateStr)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        padding: '4px 2px', borderRadius: '6px', cursor: 'pointer',
                                        background: isSelected ? 'var(--brand)' : isToday ? 'var(--bg-elevated)' : 'transparent',
                                        transition: 'background 0.1s',
                                    }}
                                >
                                    <span style={{
                                        fontSize: '12px', lineHeight: '1.4',
                                        color: isSelected ? '#fff' : isToday ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontWeight: isToday || isSelected ? 700 : 400,
                                    }}>
                                        {day}
                                    </span>
                                    {hasReminder && (
                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--brand)', marginTop: '1px' }} />
                                    )}
                                    {!hasReminder && <div style={{ width: '4px', height: '4px' }} />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Reminders for selected day */}
                <div className="recordatorios-lista">
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 10px 0', textTransform: 'capitalize' }}>
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    {loading ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cargando...</p>
                    ) : dayReminders.length === 0 ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', paddingTop: '8px' }}>Sin recordatorios este día</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {dayReminders.map(r => (
                                <div key={r.id} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                                    padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '8px',
                                    borderLeft: `3px solid ${r.color || '#3B82F6'}`,
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={r.completed || false}
                                        onChange={() => handleToggleComplete(r.id, r.completed)}
                                        style={{ marginTop: '2px', cursor: 'pointer', accentColor: r.color || '#3B82F6', flexShrink: 0 }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            margin: 0, fontSize: '13px', fontWeight: 500,
                                            color: r.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                            textDecoration: r.completed ? 'line-through' : 'none',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {r.title}
                                        </p>
                                        {r.time && (
                                            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {r.time.slice(0, 5)}
                                            </p>
                                        )}
                                    </div>
                                    <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px', flexShrink: 0 }}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add reminder modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agregar recordatorio">
                <form onSubmit={handleAddReminder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Título *</label>
                        <input
                            className="select-filter"
                            type="text"
                            required
                            placeholder="Ej: Pago mensual Netflix"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Descripción (opcional)</label>
                        <input
                            className="select-filter"
                            type="text"
                            placeholder="Notas adicionales"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Fecha *</label>
                            <input
                                className="select-filter"
                                type="date"
                                required
                                value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Hora (opcional)</label>
                            <input
                                className="select-filter"
                                type="time"
                                value={form.time}
                                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Color</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {PRESET_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, color: c }))}
                                    style={{
                                        width: '24px', height: '24px', borderRadius: '50%', background: c,
                                        border: form.color === c ? '3px solid white' : '3px solid transparent',
                                        cursor: 'pointer', padding: 0, flexShrink: 0,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
