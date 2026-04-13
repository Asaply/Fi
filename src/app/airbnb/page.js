'use client';

import { useState, useEffect } from 'react';
import { BedDouble, CalendarDays, Wallet, TrendingUp, Users } from 'lucide-react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import './Airbnb.css';

export default function Airbnb() {
    const [reservations, setReservations] = useState([]);
    const [filter, setFilter] = useState('Todas');
    const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [newForm, setNewForm] = useState({
        guest: '',
        property: 'Villa Sol',
        checkIn: '',
        checkOut: '',
        amount: '',
        status: 'Pendiente'
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('airbnb_reservations').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error("Error fetching reservations", error);
        } else {
            setReservations(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredReservations = filter === 'Todas'
        ? reservations
        : reservations.filter(r => r.status === filter);

    const handleDelete = async (id) => {
        if (!confirm("¿Estás seguro de que deseas eliminar esta reservación?")) return;
        const { error } = await supabase.from('airbnb_reservations').delete().eq('id', id);
        if (error) {
            console.error("Error deleting", error);
            alert("Hubo un error al eliminar.");
        } else {
            setReservations(reservations.filter(r => r.id !== id));
            setSelectedBooking(null);
        }
    };

    const handleEditClick = () => {
        setEditForm({ ...selectedBooking });
        setIsEditing(true);
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const handleSaveChanges = async () => {
        let finalDates = editForm.dates;
        if (editForm.checkIn && editForm.checkOut) {
            if (new Date(editForm.checkOut) <= new Date(editForm.checkIn)) {
                alert("El Check-out debe ser posterior al Check-in.");
                return;
            }
            finalDates = `${editForm.checkIn} a ${editForm.checkOut}`;
        }

        const { data, error } = await supabase.from('airbnb_reservations').update({
            guest: editForm.guest,
            property: editForm.property,
            dates: finalDates,
            amount: editForm.amount,
            status: editForm.status
        }).eq('id', editForm.id).select();

        if (error) {
            console.error("Error updating reservation", error);
            alert("Hubo un error al actualizar.");
        } else if (data && data[0]) {
            setReservations(reservations.map(r => r.id === editForm.id ? data[0] : r));
            setSelectedBooking(data[0]);
        }
        setIsEditing(false);
    };

    const handleNewChange = (e) => {
        setNewForm({ ...newForm, [e.target.name]: e.target.value });
    };

    const handleSaveNew = async () => {
        if (!newForm.checkIn || !newForm.checkOut) {
            alert("Las fechas de Check-in y Check-out son requeridas.");
            return;
        }
        if (new Date(newForm.checkOut) <= new Date(newForm.checkIn)) {
            alert("El Check-out debe ser posterior al Check-in.");
            return;
        }

        const amountStr = `${newForm.amount.includes('$') ? newForm.amount : '$' + newForm.amount}`;
        const finalAmountStr = amountStr.includes('MXN') ? amountStr : `${amountStr} MXN`;
        const newRes = {
            guest: newForm.guest,
            property: newForm.property,
            dates: `${newForm.checkIn} a ${newForm.checkOut}`,
            amount: finalAmountStr,
            status: newForm.status
        };

        const { data, error } = await supabase.from('airbnb_reservations').insert([newRes]).select();

        if (error) {
            console.error("Error creating reservation", error);
            alert("Hubo un error al crear la reservación.");
        } else if (data && data[0]) {
            setReservations([data[0], ...reservations]);
        }
        setIsNewBookingModalOpen(false);
        setNewForm({ guest: '', property: 'Villa Sol', checkIn: '', checkOut: '', amount: '', status: 'Pendiente' });
    };

    const totalIngresos = reservations
        .filter(r => r.status === 'Confirmada')
        .reduce((sum, r) => {
            const num = parseFloat(r.amount.replace(/[^0-9.-]+/g, ""));
            return sum + (isNaN(num) ? 0 : num);
        }, 0);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const huespedesActivos = new Set(reservations.filter(r => r.status === 'Confirmada').map(r => r.guest)).size;

    return (
        <div className="airbnb-container">
            <header className="airbnb-header">
                <div>
                    <h1 className="page-title">Airbnb Dashboard</h1>
                    <p className="page-subtitle">Gestión de reservaciones y analíticas</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setIsNewBookingModalOpen(true)}
                >
                    Nueva Reservación
                </button>
            </header>

            <section className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon-wrapper income">
                        <Wallet size={24} className="stat-icon" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Ingresos Globales</span>
                        <span className="stat-value">{formatCurrency(totalIngresos)}</span>
                        <span className="stat-trend positive"><TrendingUp size={14} /> Total confirmadas</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper occupancy">
                        <CalendarDays size={24} className="stat-icon" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Reservaciones</span>
                        <span className="stat-value">{reservations.length}</span>
                        <span className="stat-trend neutral">Activas en el sistema</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper guests">
                        <Users size={24} className="stat-icon" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Huéspedes Únicos</span>
                        <span className="stat-value">{huespedesActivos}</span>
                        <span className="stat-trend neutral">Con reservaciones confirmadas</span>
                    </div>
                </div>
            </section>

            <section className="reservations-section">
                <div className="section-header">
                    <h2>Próximas Reservaciones</h2>
                    <div className="filters">
                        <select
                            className="select-filter"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            <option value="Todas">Todas</option>
                            <option value="Confirmada">Confirmadas</option>
                            <option value="Pendiente">Pendientes</option>
                            <option value="Cancelada">Canceladas</option>
                        </select>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="reservations-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Huésped</th>
                                <th>Propiedad</th>
                                <th>Fechas</th>
                                <th>Total</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan="7" className="text-center py-4 text-secondary">Cargando...</td></tr>
                            ) : filteredReservations.map((res) => (
                                <tr key={res.id}>
                                    <td className="font-medium text-secondary">RES-{res.id}</td>
                                    <td>
                                        <div className="guest-cell">
                                            <div className="guest-avatar">{res.guest ? res.guest.charAt(0) : '?'}</div>
                                            <span className="font-semibold">{res.guest}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="property-cell">
                                            <BedDouble size={14} className="property-icon" />
                                            <span>{res.property}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {!res.dates || res.dates === '-' ? (
                                            <span className="status-badge status-cancelada" style={{ cursor: 'pointer' }} onClick={() => { setSelectedBooking(res); setIsEditing(true); }}>
                                                Fechas faltantes
                                            </span>
                                        ) : (
                                            res.dates
                                        )}
                                    </td>
                                    <td className="font-semibold">{formatCurrency(parseFloat(res.amount.toString().replace(/[^0-9.-]+/g, "")) || 0)}</td>
                                    <td>
                                        <span className={`status-badge status-${res.status.toLowerCase()}`}>
                                            {res.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-icon"
                                            onClick={() => setSelectedBooking(res)}
                                        >
                                            Ver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && filteredReservations.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="empty-state">No hay reservaciones que coincidan con el filtro.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <Modal
                isOpen={isNewBookingModalOpen}
                onClose={() => setIsNewBookingModalOpen(false)}
                title="Crear Nueva Reservación"
            >
                <div className="modal-form-container">
                    <p className="text-secondary modal-desc">Ingresa los detalles de la nueva reservación.</p>
                    <div className="form-group">
                        <label>Huésped</label>
                        <input type="text" name="guest" className="form-input" placeholder="Nombre del huésped" value={newForm.guest} onChange={handleNewChange} />
                    </div>
                    <div className="form-group">
                        <label>Propiedad</label>
                        <select name="property" className="form-input select-filter" value={newForm.property} onChange={handleNewChange}>
                            <option value="Villa Sol">Villa Sol</option>
                            <option value="Casa Luna">Casa Luna</option>
                            <option value="Estudio Centro">Estudio Centro</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Check-in *</label>
                        <input type="date" name="checkIn" className="form-input" required value={newForm.checkIn} onChange={handleNewChange} />
                    </div>
                    <div className="form-group">
                        <label>Check-out *</label>
                        <input type="date" name="checkOut" className="form-input" required value={newForm.checkOut} onChange={handleNewChange} />
                    </div>
                    <div className="form-group">
                        <label>Monto Total (MXN sin signo ni letras)</label>
                        <input type="text" name="amount" className="form-input" placeholder="Ej: 4,500" value={newForm.amount} onChange={handleNewChange} />
                    </div>
                    <div className="form-group">
                        <label>Estado Inicial</label>
                        <select name="status" className="form-input select-filter" value={newForm.status} onChange={handleNewChange}>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Confirmada">Confirmada</option>
                        </select>
                    </div>
                    <div className="modal-actions mt-4">
                        <button className="btn-secondary" onClick={() => setIsNewBookingModalOpen(false)}>Cancelar</button>
                        <button className="btn-primary" onClick={handleSaveNew}>Guardar Reservación</button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={selectedBooking !== null}
                onClose={() => { setSelectedBooking(null); setIsEditing(false); }}
                title={isEditing ? "Editar Reservación" : "Detalles de Reservación"}
            >
                {selectedBooking && !isEditing && (
                    <div className="booking-details-container">
                        <div className="detail-row">
                            <span className="text-secondary font-medium">ID:</span>
                            <span className="font-semibold">RES-{selectedBooking.id}</span>
                        </div>
                        <div className="detail-row">
                            <span className="text-secondary font-medium">Huésped:</span>
                            <span>{selectedBooking.guest}</span>
                        </div>
                        <div className="detail-row">
                            <span className="text-secondary font-medium">Propiedad:</span>
                            <span>{selectedBooking.property}</span>
                        </div>
                        <div className="detail-row">
                            <span className="text-secondary font-medium">Fechas:</span>
                            <span>{selectedBooking.dates}</span>
                        </div>
                        <div className="detail-row">
                            <span className="text-secondary font-medium">Estado:</span>
                            <span className={`status-badge status-${selectedBooking.status.toLowerCase()}`}>
                                {selectedBooking.status}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="text-secondary font-medium">Total:</span>
                            <span className="font-semibold text-lg">{selectedBooking.amount}</span>
                        </div>

                        <div className="modal-actions mt-4">
                            <button className="btn-danger" onClick={() => handleDelete(selectedBooking.id)}>Eliminar</button>
                            <button className="btn-primary" onClick={handleEditClick}>Editar</button>
                            <button className="btn-secondary" onClick={() => setSelectedBooking(null)}>Cerrar</button>
                        </div>
                    </div>
                )}
                {selectedBooking && isEditing && (
                    <div className="modal-form-container">
                        <div className="form-group">
                            <label>Huésped</label>
                            <input type="text" name="guest" className="form-input" value={editForm?.guest || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label>Propiedad</label>
                            <select name="property" className="form-input select-filter" value={editForm?.property || ''} onChange={handleEditChange}>
                                <option value="Villa Sol">Villa Sol</option>
                                <option value="Casa Luna">Casa Luna</option>
                                <option value="Estudio Centro">Estudio Centro</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ opacity: 0.5 }}>
                            <label>Fechas Actuales</label>
                            <input type="text" disabled className="form-input" value={editForm?.dates || ''} />
                        </div>
                        <div className="form-group">
                            <label>Nuevo Check-in (Opcional si deseas cambiar)</label>
                            <input type="date" name="checkIn" className="form-input" value={editForm?.checkIn || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label>Nuevo Check-out</label>
                            <input type="date" name="checkOut" className="form-input" value={editForm?.checkOut || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label>Monto Total</label>
                            <input type="text" name="amount" className="form-input" value={editForm?.amount || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label>Estado</label>
                            <select name="status" className="form-input select-filter" value={editForm?.status || ''} onChange={handleEditChange}>
                                <option value="Confirmada">Confirmada</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Cancelada">Cancelada</option>
                            </select>
                        </div>
                        <div className="modal-actions mt-4">
                            <button className="btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveChanges}>Guardar Cambios</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
