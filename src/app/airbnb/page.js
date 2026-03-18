'use client';

import { useState } from 'react';
import { BedDouble, CalendarDays, Wallet, TrendingUp, Users } from 'lucide-react';
import Modal from '@/components/Modal';
import './Airbnb.css';

const mockReservations = [
    { id: 'RES-001', guest: 'María González', dates: '12 Mar - 15 Mar', status: 'Confirmada', amount: '$4,500 MXN', property: 'Villa Sol' },
    { id: 'RES-002', guest: 'John Smith', dates: '18 Mar - 22 Mar', status: 'Pendiente', amount: '$7,200 MXN', property: 'Casa Luna' },
    { id: 'RES-003', guest: 'Andrea Torres', dates: '25 Mar - 30 Mar', status: 'Confirmada', amount: '$8,000 MXN', property: 'Villa Sol' },
    { id: 'RES-004', guest: 'Roberto Ruiz', dates: '02 Abr - 05 Abr', status: 'Cancelada', amount: '$3,100 MXN', property: 'Estudio Centro' },
];

export default function Airbnb() {
    const [reservations, setReservations] = useState(mockReservations);
    const [filter, setFilter] = useState('Todas');
    const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [newForm, setNewForm] = useState({
        guest: '',
        property: 'Villa Sol',
        dates: '',
        amount: '',
        status: 'Pendiente'
    });

    const filteredReservations = filter === 'Todas'
        ? reservations
        : reservations.filter(r => r.status === filter);

    const handleDelete = (id) => {
        setReservations(reservations.filter(r => r.id !== id));
        setSelectedBooking(null);
    };

    const handleEditClick = () => {
        setEditForm({ ...selectedBooking });
        setIsEditing(true);
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const handleSaveChanges = () => {
        setReservations(reservations.map(r => r.id === editForm.id ? editForm : r));
        setSelectedBooking(editForm);
        setIsEditing(false);
    };

    const handleNewChange = (e) => {
        setNewForm({ ...newForm, [e.target.name]: e.target.value });
    };

    const handleSaveNew = () => {
        const newId = `RES-00${reservations.length + 1}`;
        const newRes = {
            id: newId,
            guest: newForm.guest,
            property: newForm.property,
            dates: newForm.dates,
            amount: `${newForm.amount.includes('$') ? newForm.amount : '$' + newForm.amount} MXN`,
            status: newForm.status
        };
        setReservations([...reservations, newRes]);
        setIsNewBookingModalOpen(false);
        setNewForm({ guest: '', property: 'Villa Sol', dates: '', amount: '', status: 'Pendiente' });
    };

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
                        <span className="stat-label">Ingresos del Mes</span>
                        <span className="stat-value">$45,200 <span className="currency">MXN</span></span>
                        <span className="stat-trend positive"><TrendingUp size={14} /> +12% vs mes anterior</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper occupancy">
                        <CalendarDays size={24} className="stat-icon" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Tasa de Ocupación</span>
                        <span className="stat-value">78%</span>
                        <span className="stat-trend positive"><TrendingUp size={14} /> +5% vs mes anterior</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper guests">
                        <Users size={24} className="stat-icon" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Huéspedes Activos</span>
                        <span className="stat-value">12</span>
                        <span className="stat-trend neutral">En 3 propiedades</span>
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
                            {filteredReservations.map((res) => (
                                <tr key={res.id}>
                                    <td className="font-medium text-secondary">{res.id}</td>
                                    <td>
                                        <div className="guest-cell">
                                            <div className="guest-avatar">{res.guest.charAt(0)}</div>
                                            <span className="font-semibold">{res.guest}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="property-cell">
                                            <BedDouble size={14} className="property-icon" />
                                            <span>{res.property}</span>
                                        </div>
                                    </td>
                                    <td>{res.dates}</td>
                                    <td className="font-semibold">{res.amount}</td>
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
                            {filteredReservations.length === 0 && (
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
                        <label>Fechas</label>
                        <input type="text" name="dates" className="form-input" placeholder="Ej: 14 Abr - 18 Abr" value={newForm.dates} onChange={handleNewChange} />
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
                            <span className="font-semibold">{selectedBooking.id}</span>
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
                        <div className="form-group">
                            <label>Fechas</label>
                            <input type="text" name="dates" className="form-input" value={editForm?.dates || ''} onChange={handleEditChange} />
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
