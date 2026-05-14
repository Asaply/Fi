import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxType =
  | 'compra'
  | 'pago'
  | 'devolucion'
  | 'interes'
  | 'comision'
  | 'mensualidad_msi'
  | 'compra_msi_origen';

export interface CreditCardStatement {
  banco: 'BBVA';
  tipo_producto: 'TDC';
  numero_tarjeta_ultimos4: string;
  titular: string;
  periodo_inicio: Date;
  periodo_fin: Date;
  fecha_limite_pago: Date;
  pago_sin_intereses: number;
  pago_minimo: number;
  limite_credito: number;
  saldo_deudor_total: number;
  credito_disponible: number;
  adeudo_periodo_anterior: number;
  total_cargos_regulares: number;
  total_cargos_msi_capital: number;
  total_pagos: number;
}

export interface MSIItem {
  fecha_operacion: Date;
  descripcion: string;
  monto_original: number;
  saldo_pendiente: number;
  pago_requerido: number;
  num_pago: number;
  plazo_total: number;
  tasa: number;
}

export interface CreditCardTransaction {
  id: string;
  statement_id: string;

  fecha_operacion: Date;
  fecha_cargo: Date;

  descripcion_raw: string;
  descripcion_limpia: string;
  tarjeta_digital: boolean;

  tipo: TxType;
  categoria: string | null;

  monto_mxn: number;
  monto_original: number | null;
  moneda_original: 'USD' | 'EUR' | 'MXN' | null;
  tipo_cambio: number | null;

  msi_plazo_total: number | null;
  msi_num_pago: number | null;
  msi_monto_original: number | null;
  msi_saldo_pendiente: number | null;
  msi_pago_requerido: number | null;

  spei_referencia: string | null;
  spei_capital: number | null;
  spei_interes: number | null;
  spei_comision: number | null;
}

export interface FNCETransaction {
  id: string;
  user_id: string;
  date: string;
  concept: string;
  amount: number;
  type: 'income' | 'expense' | 'Transferencia';
  categoria: string;
  source: string;
  raw_description: string;
  metadata: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

const BBVA_CATEGORIA_MAP: Record<string, string> = {
  'ALSUPERPLUS': 'supermercado',
  'WAL MART': 'supermercado',
  'WALMART': 'supermercado',
  'ABARR': 'supermercado',
  'SUPERETTE': 'supermercado',
  'ALSUPER': 'supermercado',
  'WM SUPERCENTER': 'supermercado',
  'GASOL': 'gasolina',
  'GAS CARVEL': 'gasolina',
  'MI GASOLINA': 'gasolina',
  'DELIPOLLO': 'restaurante',
  'BURGER KING': 'restaurante',
  'MCDONALD': 'restaurante',
  'WENDYS': 'restaurante',
  'PIZZERIA': 'restaurante',
  'TORTILLERIA': 'restaurante',
  'BURRITOS': 'restaurante',
  'TARAHUMARA': 'restaurante',
  'POPEYE': 'restaurante',
  'LAS GORDITAS': 'restaurante',
  'MONKEY EXPRESS': 'restaurante',
  'PALET Y NEVERIA': 'restaurante',
  'TAMTAMALES': 'restaurante',
  'OXXO': 'conveniencia',
  'CIRCLE K': 'conveniencia',
  'MERPAGO*CARNESMAJOS': 'abarrotes',
  'CARNICE': 'abarrotes',
  'PAG*CARN': 'abarrotes',
  'CFEDC': 'servicios_publicos',
  'NETFLIX': 'entretenimiento',
  'APPLE.COM': 'suscripcion',
  'TELMEX': 'telecomunicaciones',
  'TELCEL': 'telecomunicaciones',
  'QUALITAS': 'seguro',
  'ALLIANZ': 'seguro',
  'BBVA SEGUROS': 'seguro',
  'CASETAS': 'transporte',
  'FAR GUAD': 'farmacia',
  'VICTORIA S SECRET': 'ropa',
  'SMILE INTIMATES': 'ropa',
  'BURLINGTON': 'ropa',
  'MISS ACC': 'ropa',
  'MERPAGO': 'marketplace',
  'AMAZON': 'marketplace',
  'TEMU': 'marketplace',
  'WHISKEY PRODUCCIONES': 'entretenimiento',
  'PGO SPEI': 'pago_tarjeta',
  'VETERINARIA': 'mascotas',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bbvaDateToISO(d: string): string {
  const p = d.split('-');
  if (p.length !== 3) return d;
  const month = MONTH_MAP[p[1].toLowerCase()] ?? '01';
  return `${p[2]}-${month}-${p[0].padStart(2, '0')}`;
}

function parseAmt(s: string): number {
  return parseFloat((s ?? '').replace(/[$,\s]/g, '')) || 0;
}

function cleanDesc(s: string): string {
  return s
    .replace(/;\s*Tarjeta Digital\s+\*+\d+/gi, '')
    .replace(/\s*A\s+0?\d\s+MESES\s+S\/I\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

function isDigitalCard(s: string): boolean {
  return /;\s*Tarjeta Digital\s+\*+\d+/i.test(s);
}

function hashId(banco: string, tarjeta4: string, fechaOp: string, descRaw: string, monto: number): string {
  const input = `${banco}|${tarjeta4}|${fechaOp}|${descRaw}|${monto}`;
  return createHash('sha256').update(input).digest('hex');
}

function categorize(desc: string): string {
  const upper = desc.toUpperCase();
  for (const [key, cat] of Object.entries(BBVA_CATEGORIA_MAP)) {
    if (upper.includes(key.toUpperCase())) return cat;
  }
  return 'otros';
}

function classifyType(desc: string, sign: string): TxType {
  const upper = desc.toUpperCase();
  if (sign === '-' && /PGO\s+SPEI|PAGO\s+SPEI|TRANSFERENCIA\s+SPEI/i.test(desc)) return 'pago';
  if (sign === '-' && /DEVOLUCION|REEMBOLSO/i.test(desc)) return 'devolucion';
  if (sign === '-') return 'devolucion'; // merchant refund / abono
  if (/INTERES/i.test(upper)) return 'interes';
  if (/COMISION|ANUALIDAD/i.test(upper)) return 'comision';
  if (/^\d{2}\s+DE\s+\d{2}\s+/i.test(desc)) return 'mensualidad_msi';
  if (/A\s+0?\d\s+MESES\s+S\/I/i.test(desc)) return 'compra_msi_origen';
  return 'compra';
}

// ─── Section regex ─────────────────────────────────────────────────────────────

// Main tx line format: DD-mes-YYYY  DD-mes-YYYY  DESCRIPTION  +/-  $AMOUNT
const TX_RE = /^(\d{2}-[a-záéíóúü]+-\d{4})\s+(\d{2}-[a-záéíóúü]+-\d{4})\s+(.+?)\s+([+\-])\s*\$\s*([\d,]+\.\d{2})\s*$/i;

// USD continuation line: "USD $X TIPO DE CAMBIO $Y" or "MXP $X TIPO DE CAMBIO $Y"
const FX_RE = /^(USD|EUR|MXP)\s+\$\s*([\d,]+\.\d{2,})\s+TIPO\s+DE\s+CAMBIO\s+\$\s*([\d,.]+)/i;

// IVA/detail line for SPEI: "IVA :$0.00  Interes:$0.00  Comisiones:$0.00  Capital:$115,000.00"
const SPEI_DETAIL_RE = /IVA\s*:\s*\$[\d,.]+\s+Interes\s*:\s*\$([\d,.]+)\s+Comisiones\s*:\s*\$([\d,.]+)\s+Capital\s*:\s*\$([\d,.]+)/i;

// MSI table line: "DD-mes-YYYY  DESCRIPTION  $ORIG  $PEND  $PAG  N de M  TASA%"
const MSI_RE = /^(\d{2}-[a-záéíóúü]+-\d{4})\s+(.+?)\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+(\d+)\s+de\s+(\d+)\s+([\d.]+)%\s*$/i;

// Noise lines to skip
const NOISE_RE = /^(Descripci[oó]n\s+del\s+movimiento|Fecha\s+(op|de\s+la)|N[uú]m\.\s+de\s+pago|Tasa\s+de|P[áa]gina\s+\d|N[uú]mero\s+de\s+cuenta|Saldo\s+(anterior|deudor|disponible)|L[ií]mite|Cr[eé]dito\s+disponible|Pago\s+(m[ií]nimo|para\s+no)|Fecha\s+(l[ií]mite|de\s+corte)|Periodo|IVA\s*:|Capital\s*:|Pago\s+excedente|Capital\s+de\s+promoci|MXP\s+\$|EUR\s+\$|USD\s+\$)/i;

// ─── Header parser ────────────────────────────────────────────────────────────

function parseHeader(text: string): Partial<CreditCardStatement> {
  const g = (re: RegExp) => {
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const gNum = (re: RegExp) => parseAmt(g(re));

  const periodoMatch = text.match(/Periodo[:\s]+(\d{2}-[a-z]+-\d{4})\s+al\s+(\d{2}-[a-z]+-\d{4})/i);
  const fechaCorteMatch = text.match(/Fecha\s+de\s+corte[:\s]+(\d{2}-[a-z]+-\d{4})/i);
  const fechaPagoMatch = text.match(/Fecha\s+l[ií]mite\s+de\s+pago[:\s]+[a-záéíóúü]+,?\s+(\d{2}-[a-z]+-\d{4})/i);

  const cardMatch = text.match(/N[uú]mero de tarjeta[:\s]+([\d\s*]+)/i)
    ?? text.match(/Tarjeta[:\s]+[\d\s*]*(\d{4})\b/i);
  const lastFour = cardMatch ? (cardMatch[1] ?? '').replace(/[\s*]/g, '').slice(-4) : '';

  const titularMatch = text.match(/Titular[:\s]+([^\n]+)/i)
    ?? text.match(/Nombre[:\s]+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]+)/);
  const titular = titularMatch ? titularMatch[1].trim() : '';

  return {
    banco: 'BBVA',
    tipo_producto: 'TDC',
    numero_tarjeta_ultimos4: lastFour,
    titular,
    periodo_inicio: periodoMatch ? new Date(bbvaDateToISO(periodoMatch[1])) : new Date(),
    periodo_fin: fechaCorteMatch ? new Date(bbvaDateToISO(fechaCorteMatch[1]))
      : periodoMatch ? new Date(bbvaDateToISO(periodoMatch[2])) : new Date(),
    fecha_limite_pago: fechaPagoMatch ? new Date(bbvaDateToISO(fechaPagoMatch[1])) : new Date(),
    pago_sin_intereses: gNum(/Pago\s+para\s+no\s+generar\s+intereses[:\s]+\$?([\d,]+\.\d{2})/i),
    pago_minimo: gNum(/Pago\s+m[ií]nimo[:\s]+\$?([\d,]+\.\d{2})/i),
    limite_credito: gNum(/L[ií]mite\s+de\s+cr[eé]dito[:\s]+\$?([\d,]+\.\d{2})/i),
    saldo_deudor_total: gNum(/Saldo\s+deudor\s+total[:\s]+\$?([\d,]+\.\d{2})/i),
    credito_disponible: gNum(/Cr[eé]dito\s+disponible[:\s]+\$?([\d,]+\.\d{2})/i),
    adeudo_periodo_anterior: gNum(/Adeudo\s+periodo\s+anterior[:\s]+\$?([\d,]+\.\d{2})/i),
    total_cargos_regulares: gNum(/Total\s+de\s+cargos\s+regulares[:\s]+\$?([\d,]+\.\d{2})/i),
    total_cargos_msi_capital: gNum(/Total\s+cargos\s+MSI[:\s]+\$?([\d,]+\.\d{2})/i),
    total_pagos: gNum(/Total\s+de\s+pagos[:\s]+\$?([\d,]+\.\d{2})/i),
  };
}

// ─── MSI section parser ───────────────────────────────────────────────────────

function parseMSISection(text: string): MSIItem[] {
  const msiStart = text.indexOf('COMPRAS Y CARGOS DIFERIDOS');
  const msiEnd = text.indexOf('CARGOS,COMPRAS Y ABONOS REGULARES');
  if (msiStart < 0) return [];

  const section = msiEnd > msiStart ? text.slice(msiStart, msiEnd) : text.slice(msiStart);
  const items: MSIItem[] = [];

  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    const m = MSI_RE.exec(trimmed);
    if (!m) continue;

    items.push({
      fecha_operacion: new Date(bbvaDateToISO(m[1])),
      descripcion: m[2].trim(),
      monto_original: parseAmt(m[3]),
      saldo_pendiente: parseAmt(m[4]),
      pago_requerido: parseAmt(m[5]),
      num_pago: parseInt(m[6], 10),
      plazo_total: parseInt(m[7], 10),
      tasa: parseFloat(m[8]),
    });
  }

  return items;
}

// ─── Regular section parser ───────────────────────────────────────────────────

function parseRegularSection(
  text: string,
  msiItems: MSIItem[],
  tarjeta4: string,
  statementId: string,
): { transactions: CreditCardTransaction[]; errors: string[] } {
  const regularStart = text.indexOf('CARGOS,COMPRAS Y ABONOS REGULARES');
  const parseText = regularStart >= 0 ? text.slice(regularStart) : text;

  const transactions: CreditCardTransaction[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = parseText.split('\n');

  // Build MSI lookup: key = "desc_base|fecha_op_iso"
  const msiLookup = new Map<string, MSIItem>();
  for (const item of msiItems) {
    const key = `${item.descripcion.toUpperCase()}|${item.fecha_operacion.toISOString().slice(0, 10)}`;
    msiLookup.set(key, item);
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || NOISE_RE.test(trimmed)) continue;

    const m = TX_RE.exec(trimmed);
    if (!m) continue;

    const fechaOpISO = bbvaDateToISO(m[1]);
    const fechaCargoISO = bbvaDateToISO(m[2]);
    const rawDesc = m[3].trim();
    const sign = m[4];
    const monto = parseAmt(m[5]);

    if (monto === 0 || rawDesc.length < 2) continue;

    // Dedup (section header repeats on each PDF page)
    const key = `${fechaOpISO}|${rawDesc}|${monto}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Check next line for FX or SPEI detail
    const nextLine = (lines[i + 1] ?? '').trim();
    const nextNextLine = (lines[i + 2] ?? '').trim();

    let monto_original: number | null = null;
    let moneda_original: 'USD' | 'EUR' | 'MXN' | null = null;
    let tipo_cambio: number | null = null;

    const fxMatch = FX_RE.exec(nextLine);
    if (fxMatch) {
      const currency = fxMatch[1].toUpperCase();
      if (currency === 'USD' || currency === 'EUR') {
        monto_original = parseAmt(fxMatch[2]);
        moneda_original = currency as 'USD' | 'EUR';
        tipo_cambio = parseFloat(fxMatch[3].replace(/,/g, '.'));
      } else if (currency === 'MXP') {
        moneda_original = 'MXN';
      }
    }

    // SPEI detail
    let spei_referencia: string | null = null;
    let spei_capital: number | null = null;
    let spei_interes: number | null = null;
    let spei_comision: number | null = null;

    const speiDetailLine = fxMatch ? nextNextLine : nextLine;
    const speiMatch = SPEI_DETAIL_RE.exec(speiDetailLine);
    if (speiMatch) {
      spei_interes = parseAmt(speiMatch[1]);
      spei_comision = parseAmt(speiMatch[2]);
      spei_capital = parseAmt(speiMatch[3]);
    }

    const speiRefMatch = rawDesc.match(/PGO\s+SPEI\s+RECIB\/(\d+)/i);
    if (speiRefMatch) spei_referencia = speiRefMatch[1];

    // Type classification
    const tipo = classifyType(rawDesc, sign);

    // Digital card flag
    const tarjeta_digital = isDigitalCard(rawDesc);
    const descripcion_limpia = cleanDesc(rawDesc);

    // MSI enrichment for compra_msi_origen
    let msi_plazo_total: number | null = null;
    let msi_num_pago: number | null = null;
    let msi_monto_original: number | null = null;
    let msi_saldo_pendiente: number | null = null;
    let msi_pago_requerido: number | null = null;

    if (tipo === 'compra_msi_origen') {
      // Match against MSI items by base description
      const baseDesc = descripcion_limpia.toUpperCase();
      for (const [msiKey, msiItem] of msiLookup.entries()) {
        if (msiKey.startsWith(baseDesc) || baseDesc.includes(msiItem.descripcion.toUpperCase())) {
          msi_plazo_total = msiItem.plazo_total;
          msi_num_pago = msiItem.num_pago;
          msi_monto_original = msiItem.monto_original;
          msi_saldo_pendiente = msiItem.saldo_pendiente;
          msi_pago_requerido = msiItem.pago_requerido;
          break;
        }
      }
    }

    if (tipo === 'mensualidad_msi') {
      // "04 DE 06 MERPAGO*MPARRAL1" → num=4, total=6
      const msiDescMatch = rawDesc.match(/^(\d+)\s+DE\s+(\d+)\s+(.+)/i);
      if (msiDescMatch) {
        msi_num_pago = parseInt(msiDescMatch[1], 10);
        msi_plazo_total = parseInt(msiDescMatch[2], 10);
      }
    }

    // Sign convention: + = cargo (positive), - = pago/devolucion (negative)
    const monto_mxn = sign === '-' ? -monto : monto;

    const id = hashId('BBVA', tarjeta4, fechaOpISO, rawDesc, monto_mxn);

    transactions.push({
      id,
      statement_id: statementId,
      fecha_operacion: new Date(fechaOpISO),
      fecha_cargo: new Date(fechaCargoISO),
      descripcion_raw: rawDesc,
      descripcion_limpia,
      tarjeta_digital,
      tipo,
      categoria: categorize(descripcion_limpia),
      monto_mxn,
      monto_original,
      moneda_original,
      tipo_cambio,
      msi_plazo_total,
      msi_num_pago,
      msi_monto_original,
      msi_saldo_pendiente,
      msi_pago_requerido,
      spei_referencia,
      spei_capital,
      spei_interes,
      spei_comision,
    });
  }

  return { transactions, errors };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Synchronous version — for use in the existing sync import flow (bbva-parser.js).
 * Same logic as parseBBVATDCStatement but returns directly without Promise wrapper.
 */
export function parseBBVATDCStatementSync(pdfText: string): {
  statement: CreditCardStatement;
  transactions: CreditCardTransaction[];
  msi_items: MSIItem[];
  errors: string[];
} {
  const headerPartial = parseHeader(pdfText);
  const tarjeta4 = headerPartial.numero_tarjeta_ultimos4 ?? '';
  const periodoISO = headerPartial.periodo_fin?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const statementId = createHash('sha256')
    .update(`BBVA|TDC|${tarjeta4}|${periodoISO}`)
    .digest('hex');

  const msi_items = parseMSISection(pdfText);
  const { transactions, errors } = parseRegularSection(pdfText, msi_items, tarjeta4, statementId);

  const statement: CreditCardStatement = {
    banco: 'BBVA',
    tipo_producto: 'TDC',
    numero_tarjeta_ultimos4: tarjeta4,
    titular: headerPartial.titular ?? '',
    periodo_inicio: headerPartial.periodo_inicio ?? new Date(),
    periodo_fin: headerPartial.periodo_fin ?? new Date(),
    fecha_limite_pago: headerPartial.fecha_limite_pago ?? new Date(),
    pago_sin_intereses: headerPartial.pago_sin_intereses ?? 0,
    pago_minimo: headerPartial.pago_minimo ?? 0,
    limite_credito: headerPartial.limite_credito ?? 0,
    saldo_deudor_total: headerPartial.saldo_deudor_total ?? 0,
    credito_disponible: headerPartial.credito_disponible ?? 0,
    adeudo_periodo_anterior: headerPartial.adeudo_periodo_anterior ?? 0,
    total_cargos_regulares: headerPartial.total_cargos_regulares ?? 0,
    total_cargos_msi_capital: headerPartial.total_cargos_msi_capital ?? 0,
    total_pagos: headerPartial.total_pagos ?? 0,
  };

  return { statement, transactions, msi_items, errors };
}

/**
 * Parse extracted PDF text from a BBVA TDC (credit card) statement.
 * Returns structured data: statement metadata, transactions, MSI items, and parse errors.
 */
export async function parseBBVATDCStatement(pdfText: string): Promise<{
  statement: CreditCardStatement;
  transactions: CreditCardTransaction[];
  msi_items: MSIItem[];
  errors: string[];
}> {
  return parseBBVATDCStatementSync(pdfText);
}

/**
 * Map CreditCardTransaction[] to the FNCE transactions table format.
 */
export function mapToFNCETransactions(
  transactions: CreditCardTransaction[],
  userId: string,
  statementId: string,
): FNCETransaction[] {
  return transactions.map((tx) => {
    const isPago = tx.tipo === 'pago';
    const isDevolucion = tx.tipo === 'devolucion';
    const isIngreso = isDevolucion; // devoluciones = ingreso real
    const isTransferencia = isPago;

    let type: FNCETransaction['type'];
    if (isTransferencia) type = 'Transferencia';
    else if (isIngreso) type = 'income';
    else type = 'expense';

    const msiFields = tx.tipo === 'compra_msi_origen' || tx.tipo === 'mensualidad_msi'
      ? {
          plazo_total: tx.msi_plazo_total,
          num_pago: tx.msi_num_pago,
          monto_original: tx.msi_monto_original,
          saldo_pendiente: tx.msi_saldo_pendiente,
          pago_requerido: tx.msi_pago_requerido,
        }
      : null;

    return {
      id: tx.id,
      user_id: userId,
      date: tx.fecha_operacion.toISOString().slice(0, 10),
      concept: tx.descripcion_limpia,
      amount: Math.abs(tx.monto_mxn),
      type,
      categoria: tx.categoria ?? 'otros',
      source: 'bbva_tdc_pdf',
      raw_description: tx.descripcion_raw,
      metadata: {
        statement_id: statementId,
        banco: 'BBVA',
        tipo_transaccion_tdc: tx.tipo,
        tarjeta_digital: tx.tarjeta_digital,
        moneda_original: tx.moneda_original,
        tipo_cambio: tx.tipo_cambio,
        monto_original_fx: tx.monto_original,
        msi: msiFields,
        spei:
          tx.tipo === 'pago'
            ? {
                referencia: tx.spei_referencia,
                capital: tx.spei_capital,
                interes: tx.spei_interes,
                comision: tx.spei_comision,
              }
            : null,
      },
    };
  });
}
