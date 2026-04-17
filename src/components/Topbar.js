'use client';

import { User, Settings, LogOut, FileText, HelpCircle, Send } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useTopbar } from "./TopbarContext";
import Modal from "./Modal";
import { supabase } from "@/lib/supabaseClient";
import "./Topbar.css";

const ROUTE_LABELS = {
    '/finanzas':      'Finanzas',
    '/trading':       'Trading',
    '/portfolio':     'Portfolio Health',
    '/dashboard':     'Dashboard',
    '/clientes':      'Clientes',
    '/prospectos':    'Prospectos',
    '/airbnb':        'Airbnb',
    '/perfil':        'Perfil',
    '/configuracion': 'Configuración',
};

export default function Topbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { profilePic } = useTopbar();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
    const [supportMessage, setSupportMessage] = useState("");
    const profileRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <>
            <header className="topbar">
                <div className="topbar-left">
                    <span className="current-month">{ROUTE_LABELS[pathname] ?? 'FNCE'}</span>
                </div>

                <div className="topbar-right">
                    <div className="profile-dropdown-container" ref={profileRef} style={{ position: 'relative' }}>
                        <div className="profile-icon" onClick={() => setIsProfileOpen(!isProfileOpen)} style={{ cursor: 'pointer', overflow: 'hidden' }}>
                            {profilePic ? (
                                <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <User size={18} />
                            )}
                        </div>

                        {isProfileOpen && (
                            <div className="profile-dropdown" style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)', padding: '8px',
                                minWidth: '220px', boxShadow: 'var(--shadow-lg)', zIndex: 100
                            }}>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Usuario FNCE</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>admin@fnce.app</div>
                                </div>

                                <div className="dropdown-item" onClick={() => { setIsProfileOpen(false); router.push('/perfil'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' }}>
                                    <User size={16} /> <span>Mi Perfil</span>
                                </div>
                                <div className="dropdown-item" onClick={() => { setIsProfileOpen(false); router.push('/configuracion'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' }}>
                                    <Settings size={16} /> <span>Configuración</span>
                                </div>
                                <div className="dropdown-item" onClick={() => { setIsProfileOpen(false); router.push('/configuracion'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' }}>
                                    <FileText size={16} /> <span>Exportar mis datos</span>
                                </div>
                                <div className="dropdown-item" onClick={() => { setIsProfileOpen(false); setIsSupportModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' }}>
                                    <HelpCircle size={16} /> <span>Ayuda y soporte</span>
                                </div>

                                <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }}></div>

                                <div className="dropdown-item" onClick={async () => {
                                    setIsProfileOpen(false);
                                    await supabase.auth.signOut();
                                    router.push('/login');
                                }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', borderRadius: '4px', color: 'var(--danger)' }}>
                                    <LogOut size={16} /> <span>Cerrar sesión</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <Modal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} title="Centro de Ayuda">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>¿Necesitas ayuda con FNCE?</h4>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Escríbenos directamente y nuestro equipo de soporte te responderá en breve.</p>
                        <div style={{ marginTop: '12px', fontSize: '14px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Email: </span>
                            <a href="mailto:soporte@fnce.app" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>soporte@fnce.app</a>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 500 }}>Enviar Mensaje Rápido</label>
                        <textarea
                            className="form-input"
                            placeholder="Describe tu problema o duda aquí..."
                            style={{ minHeight: '100px', resize: 'vertical', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
                            value={supportMessage}
                            onChange={(e) => setSupportMessage(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>FNCE v1.0.0</span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn-secondary" onClick={() => setIsSupportModalOpen(false)}>Cerrar</button>
                            <a
                                href={`mailto:soporte@fnce.app?subject=Soporte FNCE v1.0.0&body=${encodeURIComponent(supportMessage)}`}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                                onClick={() => setIsSupportModalOpen(false)}
                            >
                                <Send size={14} /> Enviar Mensaje
                            </a>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
}
