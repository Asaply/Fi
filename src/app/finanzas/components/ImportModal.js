// Import modal: CSV/PDF upload, column mapping, preview and result.
// Extracted from src/app/finanzas/page.js; state and handlers stay in the page.
import { AlertCircle, CheckCircle2, ChevronRight, Lock, Upload } from 'lucide-react';
import Modal from '@/components/Modal';
import NvaIntelligencePanel from '@/components/NvaIntelligencePanel';
import { CATEGORIAS_ALL } from '@/lib/categorias';

export default function ImportModal({
    csvHeaders,
    csvMapping,
    csvRawRows,
    fileInputRef,
    formatCurrency,
    handleBulkType,
    handleConfirmImport,
    handleFileUpload,
    handlePreview,
    importResult,
    importStep,
    isCreditCard,
    isImportOpen,
    isImporting,
    isParsing,
    nvaIntelligence,
    parsePdfFile,
    pdfBankInfo,
    pdfPassword,
    pdfPasswordError,
    pendingPdfFile,
    pendingRows,
    resetImport,
    setCsvMapping,
    setImportResult,
    setImportStep,
    setIsCreditCard,
    setPdfBankInfo,
    setPdfPassword,
    setPdfPasswordError,
    setPendingPdfFile,
    setPendingRows,
    setShowPdfPassword,
    showPdfPassword,
    updatePendingRow,
}) {
    return (
        <Modal isOpen={isImportOpen} onClose={resetImport} title="Importar Estado de Cuenta">
            <input ref={fileInputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" style={{ display: 'none' }} onChange={handleFileUpload} />

            {/* Result screen */}
            {importResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                    {importResult.ok ? (
                        <>
                            <CheckCircle2 size={48} color="var(--success)" />
                            <p style={{ fontWeight: 600, fontSize: '16px' }}>{importResult.count} transacciones importadas</p>
                            <div style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,135,0,0.07)', border: '1px solid rgba(255,135,0,0.2)', textAlign: 'center' }}>
                                <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    ¿Tienes otra tarjeta o cuenta? Puedes importar múltiples estados de cuenta y ver el análisis de cada una por separado.
                                </p>
                                <button
                                    className="btn-cta-secondary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => { setImportResult(null); setImportStep(1); setPendingRows([]); setPdfBankInfo(null); }}
                                >
                                    <Upload size={14} /> Importar otra tarjeta
                                </button>
                            </div>
                            <button className="btn-primary" style={{ width: '100%' }} onClick={resetImport}>Listo</button>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={48} color="var(--danger)" />
                            <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Error al importar</p>
                            {importResult.errorMsg && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', maxWidth: '320px' }}>{importResult.errorMsg}</p>
                            )}
                            <button className="btn-secondary" onClick={() => setImportResult(null)}>Volver</button>
                        </>
                    )}
                </div>
            ) : importStep === 1 ? (
                /* Step 1: upload + column mapping */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '100px' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                        Sube tu estado de cuenta en PDF o CSV. Compatible con todos los bancos de México: Nu, BBVA, Banorte, Santander, HSBC, Citibanamex, Spin by OXXO, Mercado Pago, Hey Banco, Inbursa, Afirme y más.
                    </p>
                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bg-border)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Puedes importar estados de múltiples tarjetas y cuentas. Cada una tendrá su propio análisis y podrás verlas de forma individual o en vista global.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Tipo de Tarjeta (para clasificar abonos y retiros)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className={`btn-secondary ${!isCreditCard ? 'active' : ''}`}
                                style={{ flex: 1, borderColor: !isCreditCard ? 'var(--brand)' : '', color: !isCreditCard ? 'var(--brand)' : '' }}
                                onClick={() => setIsCreditCard(false)}
                            >
                                Débito / Cheques
                            </button>
                            <button
                                className={`btn-secondary ${isCreditCard ? 'active' : ''}`}
                                style={{ flex: 1, borderColor: isCreditCard ? 'var(--brand)' : '', color: isCreditCard ? 'var(--brand)' : '' }}
                                onClick={() => setIsCreditCard(true)}
                            >
                                Crédito
                            </button>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isCreditCard ? 'Los pagos a la tarjeta se registrarán como "Transferencia" (interno) y no sumarán a tus ingresos.' : 'Los depósitos se registrarán como "Ingreso" y los retiros como "Egreso".'}</p>
                    </div>


                    {isParsing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '28px 16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ width: 36, height: 36, border: '3px solid rgba(255,122,26,0.2)', borderTopColor: '#FF7A1A', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Analizando con IA...</p>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Esto puede tomar hasta 2 minutos</p>
                            </div>
                        </div>
                    ) : !showPdfPassword ? (
                        <button
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '12px', border: '2px dashed var(--border-color)', borderRadius: '8px', width: '100%' }}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isParsing}
                        >
                            <Upload size={18} />
                            {csvHeaders.length > 0 ? `Archivo cargado (${csvRawRows.length} filas)` : 'Seleccionar archivo .pdf o .csv'}
                        </button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Lock size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                <div>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>PDF protegido con contraseña</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Ingresa la contraseña para continuar</p>
                                </div>
                            </div>
                            <input
                                type="password"
                                className="select-filter"
                                style={{ width: '100%', fontSize: '14px', padding: '8px 12px', borderColor: pdfPasswordError ? 'var(--danger)' : undefined }}
                                placeholder="Contraseña del PDF"
                                value={pdfPassword}
                                onChange={e => { setPdfPassword(e.target.value); setPdfPasswordError(false); }}
                                onKeyDown={e => e.key === 'Enter' && !isParsing && pdfPassword && parsePdfFile(pendingPdfFile, pdfPassword)}
                                autoFocus
                            />
                            {pdfPasswordError && (
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--danger)' }}>Contraseña incorrecta. Intenta de nuevo.</p>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="btn-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => { setShowPdfPassword(false); setPendingPdfFile(null); setPdfPassword(''); setPdfPasswordError(false); }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn-primary"
                                    style={{ flex: 1 }}
                                    disabled={isParsing || !pdfPassword}
                                    onClick={() => parsePdfFile(pendingPdfFile, pdfPassword)}
                                >
                                    {isParsing ? 'Procesando...' : 'Continuar'}
                                </button>
                            </div>
                        </div>
                    )}

                    {csvHeaders.length > 0 && (
                        <>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '-8px' }}>Mapeo de columnas</p>
                            {[
                                { key: 'date', label: 'Fecha *' },
                                { key: 'concept', label: 'Concepto *' },
                                { key: 'amount', label: 'Monto (columna única, + = ingreso)' },
                                { key: 'charge', label: 'Cargo / Retiro (débito)' },
                                { key: 'credit', label: 'Abono / Depósito (crédito)' },
                            ].map(({ key, label }) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</label>
                                    <select
                                        className="select-filter"
                                        style={{ fontSize: '13px', padding: '4px 8px', minWidth: '160px' }}
                                        value={csvMapping[key]}
                                        onChange={e => setCsvMapping(prev => ({ ...prev, [key]: e.target.value }))}
                                    >
                                        <option value="">— ignorar —</option>
                                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                                <button className="btn-secondary" onClick={resetImport}>Cancelar</button>
                                <button
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={handlePreview}
                                    disabled={!csvMapping.date || !csvMapping.concept || (!csvMapping.amount && !csvMapping.charge && !csvMapping.credit)}
                                >
                                    Previsualizar <ChevronRight size={16} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                /* Step 2: preview + confirm */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Summary stats */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                {isCreditCard ? 'PAGOS' : 'INGRESOS'}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--positive)' }}>
                                {formatCurrency(pendingRows.filter(r => r.type === (isCreditCard ? 'Transferencia' : 'Ingreso')).reduce((s, r) => s + r.amount, 0))}
                            </div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                {isCreditCard ? 'CARGOS' : 'EGRESOS'}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--negative)' }}>
                                {formatCurrency(pendingRows.filter(r => r.type === 'Egreso').reduce((s, r) => s + r.amount, 0))}
                            </div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>TRANSACCIONES</div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{pendingRows.length}</div>
                        </div>
                    </div>

                    {pdfBankInfo && (pdfBankInfo.saldo_anterior > 0 || pdfBankInfo.saldo_final > 0) && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1, background: 'rgba(255,135,0,0.08)', border: '1px solid rgba(255,135,0,0.25)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>SALDO ANTERIOR</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#FF8700' }}>
                                    {formatCurrency(pdfBankInfo.saldo_anterior)}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{pdfBankInfo.banco}</div>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(255,135,0,0.08)', border: '1px solid rgba(255,135,0,0.25)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>SALDO AL CORTE</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#FF8700' }}>
                                    {formatCurrency(pdfBankInfo.saldo_final)}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{pdfBankInfo.periodo || pdfBankInfo.banco}</div>
                            </div>
                        </div>
                    )}

                    {nvaIntelligence && (
                        <div className="mb-4">
                            <NvaIntelligencePanel intelligence={nvaIntelligence} />
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Revisa y ajusta tipo y categoría antes de importar.
                        </p>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Todo:</span>
                            {isCreditCard ? (
                                <>
                                    <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType('Transferencia')}>Pago</button>
                                    <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType('Egreso')}>Cargo</button>
                                    <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType('Ingreso')}>Ajuste</button>
                                </>
                            ) : (
                                ['Ingreso', 'Egreso', 'Inversión', 'Por Cobrar'].map(t => (
                                    <button key={t} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType(t)}>{t}</button>
                                ))
                            )}
                        </div>
                    </div>

                    <div style={{ overflowX: 'hidden', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <div className="import-rows-list">
                            {pendingRows.map(r => (
                                <div key={r._idx} className="import-row-card">
                                    <div className="import-row-top">
                                        <span className="import-row-info">
                                            <span className="import-row-date">{r.date}</span>
                                            <span className="import-row-concept" title={r.concept}>{r.concept}</span>
                                        </span>
                                        <span className="import-row-amount">{formatCurrency(r.amount)}</span>
                                    </div>
                                    <div className="import-row-controls">
                                        <select
                                            className="select-filter"
                                            value={r.type}
                                            onChange={e => updatePendingRow(r._idx, 'type', e.target.value)}
                                        >
                                            {isCreditCard ? (
                                                <>
                                                    <option value="Transferencia">Pago</option>
                                                    <option value="Egreso">Cargo</option>
                                                    <option value="Ingreso">Ajuste</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Ingreso">Ingreso</option>
                                                    <option value="Egreso">Egreso</option>
                                                    <option value="Inversión">Inversión</option>
                                                    <option value="Por Cobrar">Por Cobrar</option>
                                                </>
                                            )}
                                        </select>
                                        <select
                                            className="select-filter"
                                            value={r.categoria || 'Otros'}
                                            onChange={e => updatePendingRow(r._idx, 'categoria', e.target.value)}
                                        >
                                            {CATEGORIAS_ALL.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', marginTop: '-4px', background: 'linear-gradient(to top, var(--bg-card) 70%, transparent)' }}>
                        <button className="btn-secondary" onClick={() => setImportStep(1)}>Volver</button>
                        <button
                            className="btn-primary"
                            onClick={handleConfirmImport}
                            disabled={isImporting || pendingRows.length === 0}
                        >
                            {isImporting ? 'Importando...' : `Importar ${pendingRows.length} transacciones`}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
