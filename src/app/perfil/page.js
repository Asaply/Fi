'use client';

import { useState, useEffect } from 'react';
import {
    User, Mail, Lock, Globe, Clock, Camera, CheckCircle2,
    Phone, MapPin, Bell, Shield, Download, Trash2,
    ChevronRight, LogOut, Info, CreditCard,
} from 'lucide-react';
import { useTopbar } from '@/components/TopbarContext';
import { supabase } from '@/lib/supabaseClient';
import { exportDataAsPDF } from '@/lib/exportPdf';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import './Perfil.css';

const PREFS_KEY = 'fnce_profile_prefs';
const APP_VERSION = '1.0.0';

export default function PerfilPage() {
    const { profilePic, setProfilePic } = useTopbar();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        country: 'MX',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
        language: 'es',
        notifEmail: true,
        notifPush: true,
    });

    useEffect(() => {
        const prefs = (() => {
            try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
        })();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                const displayName = user.user_metadata?.display_name
                    || user.user_metadata?.full_name
                    || user.user_metadata?.name
                    || user.email?.split('@')[0]
                    || '';
                setFormData(prev => ({
                    ...prev,
                    name: displayName,
                    email: user.email || '',
                    phone: prefs.phone || '',
                    country: prefs.country || 'MX',
                    currency: prefs.currency || 'MXN',
                    timezone: prefs.timezone || 'America/Mexico_City',
                    language: prefs.language || 'es',
                    notifEmail: prefs.notifEmail !== false,
                    notifPush: prefs.notifPush !== false,
                }));
            }
        });
    }, []);

    const handleChange = (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData(prev => ({ ...prev, [e.target.name]: val }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { phone, country, currency, timezone, language, notifEmail, notifPush, name } = formData;
            localStorage.setItem(PREFS_KEY, JSON.stringify({ phone, country, currency, timezone, language, notifEmail, notifPush }));
            await supabase.auth.updateUser({ data: { display_name: name } });
            toast.success('Cambios guardados');
        } catch {
            toast.error('Error al guardar');
        }
        setSaving(false);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('La imagen debe pesar menos de 5MB.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            setProfilePic(reader.result);
            localStorage.setItem('fnce_profile_pic', reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handlePasswordReset = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return;
        await supabase.auth.resetPasswordForEmail(user.email);
        toast.success('Enlace de cambio de contraseña enviado a tu correo.');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const handleExportData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: transactions }, { data: clients }] = await Promise.all([
                supabase.from('transactions').select('*').eq('user_id', user.id),
                supabase.from('clients').select('*').eq('user_id', user.id),
            ]);
            await exportDataAsPDF({ transactions: transactions || [], clients: clients || [], userEmail: user.email || '' });
            toast.success('PDF exportado correctamente.');
        } catch {
            toast.error('Error al exportar los datos.');
        }
    };

    const handleClearTransactions = () => {
        toast.error('¿Eliminar todas las transacciones?', {
            action: {
                label: 'Confirmar',
                onClick: async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase.from('transactions').delete().eq('user_id', user.id);
                    toast.success('Transacciones eliminadas.');
                }
            }
        });
    };

    const initials = formData.name
        ? formData.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
        : formData.email?.[0]?.toUpperCase() || 'U';

    return (
        <div className="page-container perfil-page">

            {/* ── Profile Hero ── */}
            <div className="perfil-hero">
                <div className="perfil-avatar-wrap">
                    {profilePic
                        ? <img src={profilePic} alt="Avatar" className="perfil-avatar-img" />
                        : <span className="perfil-avatar-initials">{initials}</span>
                    }
                    <label htmlFor="profile-pic-input" className="perfil-avatar-cam">
                        <Camera size={14} />
                    </label>
                    <input id="profile-pic-input" type="file" style={{ display: 'none' }}
                        accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} />
                </div>
                <div className="perfil-hero-info">
                    <h2 className="perfil-hero-name">{formData.name || 'Mi cuenta'}</h2>
                    <div className="perfil-hero-email">
                        <CheckCircle2 size={12} style={{ color: 'var(--positive)', flexShrink: 0 }} />
                        {formData.email}
                    </div>
                </div>
            </div>

            {/* ── Settings sections ── */}
            <div className="perfil-sections">

                {/* Personal info */}
                <div className="perfil-section">
                    <p className="perfil-section-label">Información personal</p>
                    <div className="perfil-card">
                        <SettingInput icon={<User size={15}/>} label="Nombre" name="name" value={formData.name} onChange={handleChange} />
                        <SettingInput icon={<Mail size={15}/>} label="Correo" name="email" value={formData.email} disabled type="email" />
                        <SettingInput icon={<Phone size={15}/>} label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} type="tel" placeholder="+52 55 0000 0000" last />
                    </div>
                </div>

                {/* Regional */}
                <div className="perfil-section">
                    <p className="perfil-section-label">Regional</p>
                    <div className="perfil-card">
                        <SettingSelect icon={<MapPin size={15}/>} label="País" name="country" value={formData.country} onChange={handleChange}>
                            <option value="MX">México</option>
                            <option value="US">Estados Unidos</option>
                            <option value="ES">España</option>
                            <option value="AR">Argentina</option>
                            <option value="CO">Colombia</option>
                        </SettingSelect>
                        <SettingSelect icon={<CreditCard size={15}/>} label="Moneda" name="currency" value={formData.currency} onChange={handleChange}>
                            <option value="MXN">Peso Mexicano (MXN)</option>
                            <option value="USD">Dólar USD</option>
                            <option value="EUR">Euro (EUR)</option>
                        </SettingSelect>
                        <SettingSelect icon={<Clock size={15}/>} label="Zona horaria" name="timezone" value={formData.timezone} onChange={handleChange}>
                            <option value="America/Mexico_City">Ciudad de México (CST)</option>
                            <option value="America/New_York">Nueva York (EST)</option>
                            <option value="Europe/Madrid">Madrid (CET)</option>
                        </SettingSelect>
                        <SettingSelect icon={<Globe size={15}/>} label="Idioma" name="language" value={formData.language} onChange={handleChange} last>
                            <option value="es">Español</option>
                            <option value="en">English</option>
                        </SettingSelect>
                    </div>
                </div>

                {/* Notifications */}
                <div className="perfil-section">
                    <p className="perfil-section-label">Notificaciones</p>
                    <div className="perfil-card">
                        <SettingToggle icon={<Bell size={15}/>} label="Notificaciones por correo" name="notifEmail" checked={formData.notifEmail} onChange={handleChange} />
                        <SettingToggle icon={<Bell size={15}/>} label="Notificaciones push" name="notifPush" checked={formData.notifPush} onChange={handleChange} last />
                    </div>
                </div>

                {/* Security */}
                <div className="perfil-section">
                    <p className="perfil-section-label">Seguridad</p>
                    <div className="perfil-card">
                        <SettingAction icon={<Lock size={15}/>} label="Cambiar contraseña" sublabel="Te enviaremos un enlace por correo" onClick={handlePasswordReset} />
                        <SettingAction icon={<Shield size={15}/>} label="Autenticación en dos pasos" sublabel="Próximamente" disabled last />
                    </div>
                </div>

                {/* Data */}
                <div className="perfil-section">
                    <p className="perfil-section-label">Mis datos</p>
                    <div className="perfil-card">
                        <SettingAction icon={<Download size={15}/>} label="Exportar transacciones" sublabel="Descarga un PDF con tus datos" onClick={handleExportData} />
                        <SettingAction icon={<Trash2 size={15}/>} label="Eliminar transacciones" sublabel="Borra todos tus movimientos" onClick={handleClearTransactions} danger last />
                    </div>
                </div>

                {/* Save button */}
                <button className="btn-primary perfil-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>

                {/* Logout */}
                <button className="perfil-logout-btn" onClick={handleLogout}>
                    <LogOut size={15} /> Cerrar sesión
                </button>

                {/* App info */}
                <div className="perfil-app-info">
                    <Info size={12} />
                    NVA v{APP_VERSION} · <span onClick={() => toast.info('NVA Finance App')}>Acerca de</span>
                </div>
            </div>
        </div>
    );
}

/* ── Sub-components ── */

function SettingInput({ icon, label, last, ...inputProps }) {
    return (
        <div className={`perfil-row${last ? ' perfil-row-last' : ''}`}>
            <span className="perfil-row-icon">{icon}</span>
            <div className="perfil-row-body">
                <span className="perfil-row-label">{label}</span>
                <input className="perfil-row-input" {...inputProps} />
            </div>
        </div>
    );
}

function SettingSelect({ icon, label, last, children, ...selectProps }) {
    return (
        <div className={`perfil-row${last ? ' perfil-row-last' : ''}`}>
            <span className="perfil-row-icon">{icon}</span>
            <div className="perfil-row-body">
                <span className="perfil-row-label">{label}</span>
                <select className="perfil-row-select" {...selectProps}>{children}</select>
            </div>
        </div>
    );
}

function SettingToggle({ icon, label, name, checked, onChange, last }) {
    return (
        <div className={`perfil-row${last ? ' perfil-row-last' : ''}`}>
            <span className="perfil-row-icon">{icon}</span>
            <span className="perfil-row-label" style={{ flex: 1 }}>{label}</span>
            <label className="perfil-toggle">
                <input type="checkbox" name={name} checked={checked} onChange={onChange} />
                <span className="perfil-toggle-track" />
            </label>
        </div>
    );
}

function SettingAction({ icon, label, sublabel, onClick, danger, disabled, last }) {
    return (
        <button
            className={`perfil-row perfil-row-btn${last ? ' perfil-row-last' : ''}${danger ? ' perfil-row-danger' : ''}${disabled ? ' perfil-row-disabled' : ''}`}
            onClick={onClick}
            disabled={disabled}
        >
            <span className="perfil-row-icon">{icon}</span>
            <div className="perfil-row-body">
                <span className="perfil-row-label">{label}</span>
                {sublabel && <span className="perfil-row-sublabel">{sublabel}</span>}
            </div>
            <ChevronRight size={15} className="perfil-row-chevron" />
        </button>
    );
}
