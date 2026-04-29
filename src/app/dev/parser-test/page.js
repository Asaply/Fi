"use client";
import React, { useState, useRef } from "react";
import { parseStatementText } from "@/lib/statementParser";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ParserTestPage() {
    const [results, setResults] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const fileInputRef = useRef(null);

    const extractTextFromPdf = async (file) => {
        if (!window.pdfjsLib) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const pdfjsLib = window.pdfjsLib;
        const buffer = await file.arrayBuffer();

        // Pass an empty string as password to suppress automatic password prompt, we catch the error if it's protected
        const loadingTask = pdfjsLib.getDocument({
            data: buffer,
            password: '',
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
        });

        const pdfDoc = await loadingTask.promise;
        let rawText = '';
        
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const content = await page.getTextContent();
            
            const items = content.items.filter(item => item.str.trim().length > 0);
            items.sort((a, b) => {
                const yA = a.transform[5];
                const yB = b.transform[5];
                if (Math.abs(yA - yB) > 5) return yB - yA;
                return a.transform[4] - b.transform[4];
            });

            let lastY;
            let pageText = '';
            for (const item of items) {
                const y = item.transform[5];
                if (lastY !== undefined && Math.abs(lastY - y) > 5) {
                    pageText += '\n';
                } else if (lastY !== undefined) {
                    pageText += ' ';
                }
                pageText += item.str.trim();
                lastY = y;
            }
            rawText += pageText + '\n\n';
        }

        return rawText;
    };

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        
        setIsParsing(true);
        const newResults = [];

        for (const file of files) {
            try {
                const text = await extractTextFromPdf(file);
                const transactions = parseStatementText(text);

                // Calcular balance extraído matemáticamente
                const ingresos = transactions.filter(t => t.tipo === 'ingreso').reduce((a, b) => a + b.monto, 0);
                const egresos = transactions.filter(t => t.tipo === 'egreso').reduce((a, b) => a + b.monto, 0);

                newResults.push({
                    id: Math.random().toString(),
                    filename: file.name,
                    status: 'success',
                    transactions,
                    ingresos,
                    egresos,
                    error: null
                });
            } catch (err) {
                console.error("Error parsing file", file.name, err);
                newResults.push({
                    id: Math.random().toString(),
                    filename: file.name,
                    status: 'error',
                    transactions: [],
                    error: err.name === 'PasswordException' ? 'PDF Encriptado o con Contraseña' : err.message || 'Error Desconocido'
                });
            }
        }

        setResults(prev => [...newResults, ...prev]);
        setIsParsing(false);
        e.target.value = ''; // reset input
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ marginBottom: '30px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Sandbox de Parseo PDF</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Sube múltiples estados de cuenta aquí. Esta herramienta no guarda los datos en tu base de datos Supabase, es puramente local en el navegador para validar que el algoritmo (`statementParser.js`) funcione bien con diferentes bancos.
                </p>
            </div>

            <div 
                style={{ 
                    border: '2px dashed var(--bg-border)', 
                    borderRadius: '12px', 
                    padding: '40px', 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    background: 'var(--bg-elevated)',
                    transition: 'all 0.2s ease',
                    marginBottom: '30px'
                }}
                onClick={() => fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    multiple 
                    accept="application/pdf"
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleFiles} 
                />
                <Upload size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {isParsing ? 'Analizando documentos...' : 'Haz clic para seleccionar PDFs'}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Puedes seleccionar múltiples archivos a la vez.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {results.map((res) => (
                    <div key={res.id} style={{ 
                        background: 'var(--bg-elevated)', 
                        border: '1px solid var(--bg-border)', 
                        borderRadius: '12px', 
                        overflow: 'hidden' 
                    }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText size={18} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{ fontWeight: 500, fontSize: '15px' }}>{res.filename}</span>
                            </div>
                            
                            {res.status === 'success' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontSize: '13px', fontWeight: 500 }}>
                                    <CheckCircle2 size={16} /> 
                                    {res.transactions.length} Registros Detectados
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)', fontSize: '13px', fontWeight: 500 }}>
                                    <AlertTriangle size={16} /> 
                                    Error: {res.error}
                                </div>
                            )}
                        </div>

                        {res.status === 'success' && (
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                                    <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', flex: 1 }}>
                                        <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase' }}>Suma de Ingresos</div>
                                        <div style={{ fontSize: '18px', color: 'var(--green)', fontWeight: 700 }}>${res.ingresos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', flex: 1 }}>
                                        <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase' }}>Suma de Egresos</div>
                                        <div style={{ fontSize: '18px', color: 'var(--red)', fontWeight: 700 }}>${res.egresos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>

                                {res.transactions.length > 0 ? (
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--bg-border)', borderRadius: '8px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elevated)', boxShadow: '0 1px 0 var(--bg-border)' }}>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Fecha</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Concepto</th>
                                                    <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Monto</th>
                                                    <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Tipo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {res.transactions.map((tx, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                                                        <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>{tx.fecha}</td>
                                                        <td style={{ padding: '10px 14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{tx.concepto}</td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'right', color: tx.tipo === 'ingreso' ? 'var(--green)' : 'var(--text-primary)', fontWeight: 500 }}>
                                                            ${tx.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                                            <span style={{ 
                                                                background: tx.tipo === 'ingreso' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-border)', 
                                                                color: tx.tipo === 'ingreso' ? 'var(--green)' : 'var(--text-secondary)',
                                                                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' 
                                                            }}>
                                                                {tx.tipo}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                        No se pudo parsear ninguna transacción del PDF.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
