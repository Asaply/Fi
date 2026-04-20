'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Lock, Globe, Clock, Camera, CheckCircle } from 'lucide-react';
import { useTopbar } from '@/components/TopbarContext';
import { supabase } from '@/lib/supabaseClient';
import './Perfil.css';

const PREFS_KEY = 'fnce_profile_prefs';

export default function PerfilPage() {
    const { profilePic, setProfilePic } = useTopbar();
    const [saved, setSaved] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
        language: 'es',
    });

    useEffect(() => {
        const prefs = (() => {
            try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
        })();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                const displayName = user.user_metadata?.full_name
                    || user.user_metadata?.name
                    || user.email?.split('@')[0]
                    || '';
                setFormData({
                    name: displayName,
                    email: user.email || '',
                    currency: prefs.currency || 'MXN',
                    timezone: prefs.timezone || 'America/Mexico_City',
                    language: prefs.language || 'es',
                });
            }
        });
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        const { currency, timezone, language } = formData;
        localStorage.setItem(PREFS_KEY, JSON.stringify({ currency, timezone, language }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen debe pesar menos de 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            setProfilePic(base64String);
            localStorage.setItem('fnce_profile_pic', base64String);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="page-container perfil-page">
            <div className="finanzas-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">Mi Perfil</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                        Gestiona tu información personal y preferencias de cuenta.
                    </p>
                </div>
            </div>

            <div className="perfil-layout">
                {/* Left Sidebar Profile Card */}
                <div className="perfil-sidebar card">
                    <div className="avatar-section">
                        <div className="avatar-wrapper">
                            {profilePic ? (
                                <img src={profilePic} alt="Avatar" className="avatar-icon-placeholder" style={{ borderRadius: '50%', objectFit: 'cover', width: '96px', height: '96px', padding: 0 }} />
                            ) : (
                                <User size={48} className="avatar-icon-placeholder" />
                            )}
                            <label htmlFor="profile-pic-input" className="upload-btn">
                                <Camera size={16} />
                            </label>
                            <input
                                id="profile-pic-input"
                                type="file"
                                style={{ display: 'none' }}
                                accept="image/png, image/jpeg, image/webp"
                                onChange={handleImageUpload}
                            />
                        </div>
                        <h2 className="user-name">{formData.name}</h2>
                        <div className="user-email">
                            <CheckCircle size={14} className="verified-icon" />
                            {formData.email}
                        </div>
                    </div>
                </div>

                {/* Main Settings Area */}
                <div className="perfil-main">
                    <div className="card">
                        <h3 className="section-title">Información Personal</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label><User size={14}/> Nombre Completo</label>
                                <input type="text" name="name" className="form-input" value={formData.name} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label><Mail size={14}/> Correo Electrónico</label>
                                <input type="email" name="email" className="form-input" disabled value={formData.email} />
                            </div>
                        </div>

                        <div className="divider"></div>
                        
                        <h3 className="section-title">Preferencias Regionales</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label><Globe size={14}/> Moneda Base</label>
                                <select name="currency" className="form-input select-filter" value={formData.currency} onChange={handleChange}>
                                    <option value="MXN">Peso Mexicano (MXN)</option>
                                    <option value="USD">Dólar Estadounidense (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label><Clock size={14}/> Zona Horaria</label>
                                <select name="timezone" className="form-input select-filter" value={formData.timezone} onChange={handleChange}>
                                    <option value="America/Mexico_City">America/Mexico_City</option>
                                    <option value="America/New_York">America/New_York</option>
                                    <option value="Europe/Madrid">Europe/Madrid</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label><Globe size={14}/> Idioma</label>
                                <select name="language" className="form-input select-filter" value={formData.language} onChange={handleChange}>
                                    <option value="es">Español</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                        </div>

                        <div className="divider"></div>
                        
                        <h3 className="section-title">Seguridad</h3>
                        <div className="form-group" style={{ maxWidth: '300px' }}>
                            <button className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={() => alert('Cambio de contraseña no disponible en esta versión.')}>
                                <Lock size={16} /> Cambiar Contraseña
                            </button>
                        </div>

                        <div className="action-footer mt-4" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                            {saved && <span style={{ fontSize: '14px', color: 'var(--success)' }}>✓ Guardado</span>}
                            <button className="btn-primary" onClick={handleSave}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
