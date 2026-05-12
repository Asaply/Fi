'use client';

import { useState, useEffect } from 'react';
import {
    Bell, Shield, Database, Download, AlertTriangle,
    ChevronRight, Fingerprint, Lock, KeyRound, Delete, AlertCircle, Sun, Moon,
} from 'lucide-react';
import { useTopbar } from '@/components/TopbarContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { exportDataAsPDF } from '@/lib/exportPdf';
import Modal from '@/components/Modal';
import {
    isPinEnabled, isBiometricEnabled, isBiometricSupported,
    setPin, verifyPin, disablePin, disableBiometric,
    registerBiometric,
} from '@/lib/pinAuth';
import './Configuracion.css';

const NOTIF_KEY = 'fnce_notif_prefs';
const PIN_LENGTH = 4;

export default function ConfiguracionPage() {
    const { theme, toggleTheme } = useTopbar();
    const [notif, setNotif] = useState({ portfolio: true, resumen: false });
    const [pinEnabled, setPinEnabled] = useState(false);
    const [bioEnabled, setBioEnabled] = useState(false);
    const [bioSupported, setBioSupported] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // PIN modal state
    const [pinModal, setPinModal] = useState(null); // null | 'setup' | 'change' | 'disable' | 'disable-bio'
    const [pinStep, setPinStep] = useState('enter'); // 'enter' | 'confirm'
    const [pinInput, setPinInput] = useState('');
    const [pinFirst, setPinFirst] = useState('');
    const [pinError, setPinError] = useState('');

    useEffect(() => {
        try {
            const n = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
            setNotif(prev => ({ ...prev, ...n }));
        } catch {}
        setPinEnabled(isPinEnabled());
        setBioEnabled(isBiometricEnabled());
        isBiometricSupported().then(setBioSupported);
    }, []);

    const toggleNotif = (key) => {
        setNotif(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
            return next;
        });
    };

    /* ── PIN modal helpers ── */
    const openModal = (mode) => {
        setPinModal(mode);
        setPinStep('enter');
        setPinInput('');
        setPinFirst('');
        setPinError('');
    };

    const closeModal = () => {
        setPinModal(null);
        setPinInput('');
        setPinFirst('');
        setPinError('');
        setPinStep('enter');
    };

    const handlePinDigit = async (d) => {
        if (pinInput.length >= PIN_LENGTH) return;
        const next = pinInput + d;
        setPinInput(next);
        setPinError('');

        if (next.length < PIN_LENGTH) return;

        // PIN complete — process based on modal mode
        if (pinModal === 'setup' || pinModal === 'change') {
            if (pinStep === 'enter') {
                // If changing, verify current PIN first
                if (pinModal === 'change') {
                    const ok = await verifyPin(next);
                    if (!ok) { setPinError('PIN incorrecto'); setPinInput(''); return; }
                }
                setPinFirst(next);
                setPinInput('');
                setPinStep('confirm');
                setPinError('');
            } else {
                // confirm step
                if (next !== pinFirst) {
                    setPinError('Los PINs no coinciden');
                    setPinInput('');
                    setPinStep('enter');
                    setPinFirst('');
                    return;
                }
                await setPin(next);
                setPinEnabled(true);
                toast.success('PIN configurado correctamente.');
                closeModal();
            }
        } else if (pinModal === 'disable') {
            const ok = await verifyPin(next);
            if (!ok) { setPinError('PIN incorrecto'); setPinInput(''); return; }
            disablePin();
            setPinEnabled(false);
            setBioEnabled(false);
            toast.success('PIN desactivado.');
            closeModal();
        } else if (pinModal === 'disable-bio') {
            const ok = await verifyPin(next);
            if (!ok) { setPinError('PIN incorrecto'); setPinInput(''); return; }
            disableBiometric();
            setBioEnabled(false);
            toast.success('Biometría desactivada.');
            closeModal();
        }
    };

    const handlePinDelete = () => {
        setPinInput(prev => prev.slice(0, -1));
        setPinError('');
    };

    /* ── Biometric ── */
    const handleBioToggle = async () => {
        if (bioEnabled) {
            openModal('disable-bio');
            return;
        }
        try {
            await registerBiometric();
            setBioEnabled(true);
            toast.success('Biometría activada.');
        } catch (e) {
            toast.error(e.message || 'Error al registrar biometría.');
        }
    };

    /* ── Export ── */
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Sin sesión');
            const [{ data: transactions }, { data: clients }] = await Promise.all([
                supabase.from('transactions').select('*').eq('user_id', user.id),
                supabase.from('clients').select('*').eq('user_id', user.id),
            ]);
            await exportDataAsPDF({
                transactions: transactions || [],
                clients: clients || [],
                userEmail: user.email || '',
            });
            toast.success('PDF exportado correctamente.');
        } catch {
            toast.error('Error al exportar los datos.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccount = () => {
        toast.error('¿Eliminar tu cuenta permanentemente?', {
            action: {
                label: 'Confirmar',
                onClick: () => toast.info('Contacta a soporte para eliminar tu cuenta.'),
            },
        });
    };

    /* ── PIN modal title ── */
    const pinModalTitle = {
        setup: pinStep === 'enter' ? 'Crea tu PIN' : 'Confirma tu PIN',
        change: pinStep === 'enter' ? 'Ingresa tu PIN actual' : pinStep === 'new' ? 'Nuevo PIN' : 'Confirma nuevo PIN',
        disable: 'Ingresa tu PIN para desactivar',
        'disable-bio': 'Ingresa tu PIN para continuar',
    }[pinModal] ?? '';

    return (
        <div className="page-container cfg-page">
            <div className="cfg-sections">

                {/* Apariencia */}
                <div className="cfg-section">
                    <p className="cfg-section-label">Apariencia</p>
                    <div className="cfg-card">
                        <CfgToggle
                            icon={theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                            label={theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
                            sublabel="Cambia entre tema claro y oscuro"
                            checked={theme === 'light'}
                            onChange={toggleTheme}
                            last
                        />
                    </div>
                </div>

                {/* Notificaciones */}
                <div className="cfg-section">
                    <p className="cfg-section-label">Notificaciones</p>
                    <div className="cfg-card">
                        <CfgToggle
                            icon={<Bell size={15} />}
                            label="Alertas de Portafolio"
                            sublabel="Movimientos inusuales del mercado (±5%)"
                            checked={notif.portfolio}
                            onChange={() => toggleNotif('portfolio')}
                        />
                        <CfgToggle
                            icon={<Bell size={15} />}
                            label="Resumen semanal por email"
                            sublabel="Reporte consolidado los lunes"
                            checked={notif.resumen}
                            onChange={() => toggleNotif('resumen')}
                            last
                        />
                    </div>
                </div>

                {/* Seguridad */}
                <div className="cfg-section">
                    <p className="cfg-section-label">Seguridad</p>
                    <div className="cfg-card">
                        <CfgToggle
                            icon={<Lock size={15} />}
                            label="PIN de Acceso"
                            sublabel={pinEnabled ? 'Requerido al abrir la app' : 'Protege la app con un PIN de 4 dígitos'}
                            checked={pinEnabled}
                            onChange={() => pinEnabled ? openModal('disable') : openModal('setup')}
                        />
                        {pinEnabled && (
                            <>
                                <CfgToggle
                                    icon={<Fingerprint size={15} />}
                                    label="Biometría / Face ID"
                                    sublabel={bioSupported ? 'Desbloquea con huella o Face ID' : 'No disponible en este dispositivo'}
                                    checked={bioEnabled}
                                    onChange={handleBioToggle}
                                    disabled={!bioSupported}
                                />
                                <CfgAction
                                    icon={<KeyRound size={15} />}
                                    label="Cambiar PIN"
                                    sublabel="Actualiza tu PIN de acceso"
                                    onClick={() => openModal('change')}
                                    last
                                />
                            </>
                        )}
                        {!pinEnabled && (
                            <div className="cfg-row cfg-row-last cfg-pin-hint">
                                <Shield size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    El PIN protege tus datos si alguien accede a tu dispositivo.
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Datos */}
                <div className="cfg-section">
                    <p className="cfg-section-label">Mis datos</p>
                    <div className="cfg-card">
                        <CfgAction
                            icon={<Download size={15} />}
                            label={isExporting ? 'Exportando...' : 'Exportar mis datos'}
                            sublabel="Descarga un JSON con toda tu información"
                            onClick={handleExport}
                            disabled={isExporting}
                        />
                        <CfgAction
                            icon={<AlertTriangle size={15} />}
                            label="Eliminar mi cuenta"
                            sublabel="Acción permanente e irreversible"
                            onClick={handleDeleteAccount}
                            danger
                            last
                        />
                    </div>
                </div>

            </div>

            {/* PIN Modal */}
            <Modal isOpen={!!pinModal} onClose={closeModal} title={pinModalTitle}>
                <PinModalContent
                    step={pinStep}
                    input={pinInput}
                    error={pinError}
                    onDigit={handlePinDigit}
                    onDelete={handlePinDelete}
                />
            </Modal>
        </div>
    );
}

/* ── PIN modal content ── */
function PinModalContent({ step, input, error, onDigit, onDelete }) {
    return (
        <div className="cfg-pin-modal">
            <div className="cfg-pin-dots">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`cfg-pin-dot${i < input.length ? ' filled' : ''}`} />
                ))}
            </div>
            {error && (
                <div className="cfg-pin-error">
                    <AlertCircle size={13} /> {error}
                </div>
            )}
            <div className="cfg-pin-pad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <button key={n} className="cfg-pin-key" onClick={() => onDigit(String(n))}>{n}</button>
                ))}
                <div />
                <button className="cfg-pin-key" onClick={() => onDigit('0')}>0</button>
                <button className="cfg-pin-key cfg-pin-key-del" onClick={onDelete}><Delete size={18} /></button>
            </div>
        </div>
    );
}

/* ── Sub-components ── */

function CfgToggle({ icon, label, sublabel, checked, onChange, last, disabled, badge }) {
    return (
        <div className={`cfg-row${last ? ' cfg-row-last' : ''}${disabled ? ' cfg-row-disabled' : ''}`}>
            <span className="cfg-row-icon">{icon}</span>
            <div className="cfg-row-body">
                <div className="cfg-row-label-wrap">
                    <span className="cfg-row-label">{label}</span>
                    {badge && <span className="cfg-badge">{badge}</span>}
                </div>
                {sublabel && <span className="cfg-row-sublabel">{sublabel}</span>}
            </div>
            <label className="cfg-toggle">
                <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
                <span className="cfg-toggle-track" />
            </label>
        </div>
    );
}

function CfgAction({ icon, label, sublabel, onClick, danger, disabled, last }) {
    return (
        <button
            className={`cfg-row cfg-row-btn${last ? ' cfg-row-last' : ''}${danger ? ' cfg-row-danger' : ''}${disabled ? ' cfg-row-disabled' : ''}`}
            onClick={onClick}
            disabled={disabled}
        >
            <span className="cfg-row-icon">{icon}</span>
            <div className="cfg-row-body">
                <span className="cfg-row-label">{label}</span>
                {sublabel && <span className="cfg-row-sublabel">{sublabel}</span>}
            </div>
            <ChevronRight size={15} className="cfg-row-chevron" />
        </button>
    );
}
