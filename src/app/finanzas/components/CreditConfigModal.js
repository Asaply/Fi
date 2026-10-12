// Credit card settings modal (limit, cutoff/payment days, balances).
// Extracted from src/app/finanzas/page.js; state and handlers stay in the page.
import CurrencyInput from '@/components/CurrencyInput';
import InfoTip from '@/components/InfoTip';
import Modal from '@/components/Modal';

export default function CreditConfigModal({
    creditConfig,
    handleSaveCreditConfig,
    isEditingCreditConfig,
    setCreditConfig,
    setIsEditingCreditConfig,
}) {
    return (
        <Modal isOpen={isEditingCreditConfig} onClose={() => setIsEditingCreditConfig(false)} title="Configuración de Tarjeta">
            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleSaveCreditConfig}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Ajusta los parámetros de tu tarjeta para calcular tu utilización, saldo y cuenta regresiva.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Límite de Crédito</label>
                    <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="Ej: 50,000" value={creditConfig.limit} onChange={e => setCreditConfig(p => ({ ...p, limit: e.target.value }))} required />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Día de Corte</label>
                        <input type="number" className="select-filter" style={{ width: '100%' }} placeholder="Ej: 18" min="1" max="31" value={creditConfig.cutoffDate} onChange={e => setCreditConfig(p => ({ ...p, cutoffDate: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Día Límite de Pago</label>
                        <input type="number" className="select-filter" style={{ width: '100%' }} placeholder="Ej: 25" min="1" max="31" value={creditConfig.paymentDate} onChange={e => setCreditConfig(p => ({ ...p, paymentDate: e.target.value }))} />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Saldo al corte</label>
                    <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={creditConfig.statementBalance} onChange={e => setCreditConfig(p => ({ ...p, statementBalance: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Pago mínimo</label>
                    <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={creditConfig.pagoMinimo || ''} onChange={e => setCreditConfig(p => ({ ...p, pagoMinimo: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Pago para no generar intereses<InfoTip title="Pago para no generar intereses" text="El monto exacto que debes pagar antes de la fecha límite para que la tarjeta NO te cobre intereses. Viene impreso en tu estado de cuenta. Pagar menos que esto activa intereses sobre todo el saldo." /></label>
                    <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={creditConfig.noInterestPayment} onChange={e => setCreditConfig(p => ({ ...p, noInterestPayment: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsEditingCreditConfig(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary">Guardar</button>
                </div>
            </form>
        </Modal>
    );
}
