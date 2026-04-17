'use client';

import { useState } from 'react';
import { Bell, LayoutTemplate, Shield, Database, Download, AlertTriangle } from 'lucide-react';
import './Configuracion.css';

export default function ConfiguracionPage() {
    const [notifState, setNotifState] = useState({
        pagos: true,
        airbnb: true,
        prospectos: false,
        portfolio: true,
        resumen: false
    });

    const [modulesState, setModulesState] = useState({
        trading: true,
        airbnb: true,
        prospectos: true
    });

    const handleNotifToggle = (key) => setNotifState(prev => ({ ...prev, [key]: !prev[key] }));
    const handleModuleToggle = (key) => setModulesState(prev => ({ ...prev, [key]: !prev[key] }));

    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Emulate data fetching loop for 1 second UX
            await new Promise(r => setTimeout(r, 1000));
            
            const data = {
                exportDate: new Date().toISOString(),
                version: '1.0.0',
                userConfig: { ...notifState, ...modulesState },
                dashboards: JSON.parse(localStorage.getItem('fnce_custom_dashboards') || '[]'),
                mocked_transactions: [
                    { id: 1, type: "Income", amount: 5000, date: "2023-10-01" },
                    { id: 2, type: "Expense", amount: 1200, date: "2023-10-02" }
                ],
                mocked_clients: [{ name: "Acme Corp", status: "Active" }]
            };

            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
            const link = document.createElement("a");
            link.href = jsonString;
            link.download = `fnce_datos_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error(e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="page-container config-page">
            <div className="finanzas-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">Configuración</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                        Administra notificaciones, módulos visibles y la seguridad de tu cuenta.
                    </p>
                </div>
            </div>

            <div className="config-grid">
                {/* Notificaciones */}
                <div className="card">
                    <h3 className="section-title"><Bell size={18} /> Notificaciones</h3>
                    <div className="toggle-list">
                        <div className="toggle-item">
                            <div>
                                <div className="toggle-title">Pagos de clientes vencidos</div>
                                <div className="toggle-desc">Alertas cuando una factura expira.</div>
                            </div>
                            <label className="switch">
                                <input type="checkbox" checked={notifState.pagos} onChange={() => handleNotifToggle('pagos')} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="toggle-item">
                            <div>
                                <div className="toggle-title">Check-ins próximos (Airbnb)</div>
                                <div className="toggle-desc">Recordatorio 24h antes del huésped.</div>
                            </div>
                            <label className="switch">
                                <input type="checkbox" checked={notifState.airbnb} onChange={() => handleNotifToggle('airbnb')} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="toggle-item">
                            <div>
                                <div className="toggle-title">Alertas de Portafolio</div>
                                <div className="toggle-desc">Movimientos inusuales del mercado (+5%).</div>
                            </div>
                            <label className="switch">
                                <input type="checkbox" checked={notifState.portfolio} onChange={() => handleNotifToggle('portfolio')} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="toggle-item">
                            <div>
                                <div className="toggle-title">Resumen semanal por email</div>
                                <div className="toggle-desc">Reporte consolidado los lunes por la mañana.</div>
                            </div>
                            <label className="switch">
                                <input type="checkbox" checked={notifState.resumen} onChange={() => handleNotifToggle('resumen')} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Módulos */}
                <div className="card">
                    <h3 className="section-title"><LayoutTemplate size={18} /> Módulos Visibles</h3>
                    <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px' }}>
                        Desactiva los módulos que no utilices para simplificar tu Sidebar.
                    </p>
                    <div className="toggle-list">
                        <div className="toggle-item">
                            <span className="toggle-title">Trading</span>
                            <label className="switch"><input type="checkbox" checked={modulesState.trading} onChange={() => handleModuleToggle('trading')} /><span className="slider round"></span></label>
                        </div>
                        <div className="toggle-item">
                            <span className="toggle-title">Airbnb</span>
                            <label className="switch"><input type="checkbox" checked={modulesState.airbnb} onChange={() => handleModuleToggle('airbnb')} /><span className="slider round"></span></label>
                        </div>
                        <div className="toggle-item">
                            <span className="toggle-title">Prospectos</span>
                            <label className="switch"><input type="checkbox" checked={modulesState.prospectos} onChange={() => handleModuleToggle('prospectos')} /><span className="slider round"></span></label>
                        </div>
                    </div>
                </div>

                {/* Seguridad e Integridad */}
                <div className="card">
                    <h3 className="section-title"><Shield size={18} /> Seguridad Privada</h3>
                    <div className="toggle-list" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <div className="toggle-item">
                            <div>
                                <div className="toggle-title">PIN de Acceso / Biometría</div>
                                <div className="toggle-desc">Requerir Face ID al abrir la App (PWA).</div>
                            </div>
                            <label className="switch"><input type="checkbox" defaultChecked={false} /><span className="slider round"></span></label>
                        </div>
                    </div>
                    <button className="btn-secondary" style={{ width: '100%', marginBottom: '12px' }}>Ver dispositivos conectados</button>
                    <button className="btn-danger-outline" style={{ width: '100%' }}>Cerrar todas las sesiones activas</button>
                </div>

                {/* Datos */}
                <div className="card border-warning">
                    <h3 className="section-title text-warning"><Database size={18} /> Gestión de Datos</h3>
                    <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px' }}>
                        Tus datos te pertenecen. Puedes descargarlos o purgar el sistema permanentemente.
                    </p>
                    <button className="btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }} onClick={handleExport} disabled={isExporting}>
                        <Download size={16} className={isExporting ? 'spin-anim' : ''} /> {isExporting ? 'Recopilando datos...' : 'Exportar todos mis datos (JSON)'}
                    </button>

                    <button className="btn-danger" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <AlertTriangle size={16} /> Eliminar mi cuenta
                    </button>
                </div>
            </div>
        </div>
    );
}
