const fs = require('fs');
let code = fs.readFileSync('src/app/finanzas/page.js', 'utf8');

// 1. Add isCreditCard state
code = code.replace(/const \[pendingPdfFile, setPendingPdfFile\] = useState\(null\);/, 
    "const [pendingPdfFile, setPendingPdfFile] = useState(null);\n    const [isCreditCard, setIsCreditCard] = useState(false);");

// 2. Pass isCreditCard to api route
code = code.replace(/formData\.append\('file', pendingPdfFile\);/, 
    "formData.append('file', pendingPdfFile);\n                    formData.append('isCreditCard', isCreditCard ? 'true' : 'false');");

// 3. Pass isCreditCard to local parser
code = code.replace(/let transacciones = rawText\?.trim\(\) \? parseStatementText\(rawText\) : \[\];/,
    "let transacciones = rawText?.trim() ? parseStatementText(rawText, isCreditCard) : [];");

// 4. Add UI toggle
const toggleUI = `
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Tipo de Tarjeta (para clasificar abonos y retiros)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className={\`btn-secondary \${!isCreditCard ? 'active' : ''}\`}
                                    style={{ flex: 1, borderColor: !isCreditCard ? 'var(--brand)' : '', color: !isCreditCard ? 'var(--brand)' : '' }}
                                    onClick={() => setIsCreditCard(false)}
                                >
                                    Débito / Cheques
                                </button>
                                <button
                                    className={\`btn-secondary \${isCreditCard ? 'active' : ''}\`}
                                    style={{ flex: 1, borderColor: isCreditCard ? 'var(--brand)' : '', color: isCreditCard ? 'var(--brand)' : '' }}
                                    onClick={() => setIsCreditCard(true)}
                                >
                                    Crédito
                                </button>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isCreditCard ? 'Los pagos a la tarjeta se registrarán como "Transferencia" (interno) y no sumarán a tus ingresos.' : 'Los depósitos se registrarán como "Ingreso" y los retiros como "Egreso".'}</p>
                        </div>
`;

code = code.replace(/<p style={{ color: 'var\(--text-primary\)', fontSize: '14px' }}>[\s\S]*?<\/p>/, 
    "$&" + toggleUI);

fs.writeFileSync('src/app/finanzas/page.js', code);
console.log('finanzas/page.js updated successfully');
