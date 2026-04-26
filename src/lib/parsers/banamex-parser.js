import { categorize } from './categories';

// Banamex — MiCuenta
// KEY RULE: trailing space on amount line = DEPÓSITO (ingreso), no space = RETIRO (egreso)
// '2,500.00 ' → ingreso | '2,500.00' → egreso

const MONTHS = new Set(['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']);

const MONTH_MAP = {
    ENE:'01', FEB:'02', MAR:'03', ABR:'04', MAY:'05', JUN:'06',
    JUL:'07', AGO:'08', SEP:'09', OCT:'10', NOV:'11', DIC:'12',
};

// Exact noise lines injected between transactions
const NOISE_EXACT = new Set([
    'FECHA','CONCEPTO','RETIROS','DEPÓSITOS','SALDO','SALDO ANTERIOR',
    'Centro de Atención Telefónica',
    'Ciudad de México: 55 1226 2639',
    "Resto del país: 800 021 2345",
    'SUC. 4109 PACHECO, CHIHUAHUA,',
    'AVENIDA CARLOS PACHECO VILLA SN',
    'POPULAR', 'POPULAR ',
    'DEREK ARMANDO VALENZUELA MACIAS',
    'Detalle de Operaciones  En pesos Moneda Nacional',
    '0003909', '000190.B26INDA020.AR.0313.01',
    'Resumen Operaciones Tarjeta',
]);

const NOISE_PREFIXES = [
    'Página ','TARJETA ','TOTAL','AHORRO FACIL','**La GAT','MiCuenta',
    'Resumen','Número de contrato','Saldo anterior','(+)','(-)',
    'Intereses','Saldo al','En el período','Saldo promedio','Días del',
    'Tasa de interés','Impuesto','* Expresada','Estado de Cuenta',
    'Período del','Número de sucursal','Número de cuenta',
    'Número de Tarjeta','CLABE','AHORRO','Periodo','GAT Nominal',
    'GAT Real','Número de Contrato','Número de cliente','RFC ',
];

// Fecha en una línea: "16 FEB" o "02 MAR"
const DATE_ONE_LINE = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i;
// Solo número: "16" (mes viene en siguiente línea)
const DATE_NUM_ONLY = /^(\d{1,2})$/;
// Línea de monto: dígitos + comas + decimal + espacio opcional al final
const AMOUNT_LINE   = /^([\d,]+\.\d{2})( ?)$/;

function isNoise(line) {
    const s = line.trim();
    if (!s) return true;
    if (NOISE_EXACT.has(s) || NOISE_EXACT.has(line)) return true;
    if (NOISE_PREFIXES.some(p => s.startsWith(p))) return true;
    if (/^Página\s+\d+/.test(s)) return true;
    // Líneas de referencia técnica: "20260218 75064956047001025192098 683519"
    if (/^\d{8}\s+\d{10,}/.test(s)) return true;
    // Strings numéricos largos (CLABE, números de cuenta)
    if (/^\d{10,}$/.test(s)) return true;
    // Códigos de referencia: "000190.B26INDA020.AR.0313.01"
    if (/^\d{6}\.[A-Z0-9.]+$/.test(s)) return true;
    // Líneas de referencia técnica: "9000/0012"
    if (/^\d{4}\/\d{4}$/.test(s)) return true;
    return false;
}

function parseAmt(s) {
    return parseFloat((s || '').replace(/,/g, '')) || 0;
}

export function parseBanamex(text) {
    // Metadatos
    const accountMatch = text.match(/N[uú]mero de cuenta de cheques\s+(\d+)/i)
        ?? text.match(/N[uú]mero de contrato\s+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const yearMatch = text.match(/del\s+\d+\s+de\s+\w+\s+al\s+\d+\s+de\s+\w+\s+del\s+(\d{4})/i);
    const year = yearMatch?.[1] ?? String(new Date().getFullYear());

    const periodFull = text.match(/Per[ií]odo del\s+(.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';

    const openingBalance = parseAmt(text.match(/Saldo anterior\s+En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/\(\+\)\s+\d+\s+Dep[oó]sitos\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/\(-\)\s+\d+\s+Retiros\/Otros cargos\s+([\d,]+\.\d{2})/i)?.[1]);

    // Extraer TODAS las secciones de detalle (una por página)
    const allLines = [];
    let searchFrom = 0;
    while (true) {
        const idx = text.indexOf('Detalle de Operaciones', searchFrom);
        if (idx < 0) break;
        allLines.push(...text.slice(idx).split('\n'));
        searchFrom = idx + 1;
    }

    // Filtrar ruido
    const lines = allLines.filter(line => !isNoise(line));

    // Máquina de estados
    const transactions = [];
    let currentDate = '';
    let currentLines = [];

    function flushTransaction() {
        if (!currentDate || currentLines.length === 0) return;

        // Índices de todas las líneas que son montos
        const amountIdxs = [];
        for (let j = 0; j < currentLines.length; j++) {
            if (AMOUNT_LINE.test(currentLines[j])) amountIdxs.push(j);
        }

        // Necesitamos al menos 2: [monto, saldo]
        if (amountIdxs.length < 2) return;

        // Monto = penúltimo número, saldo = último
        const montoIdx = amountIdxs[amountIdxs.length - 2];
        const montoLine = currentLines[montoIdx];
        const montoMatch = AMOUNT_LINE.exec(montoLine);
        if (!montoMatch) return;

        // LA REGLA CLAVE: trailing space = depósito
        const isDeposit = montoMatch[2] === ' ';
        const monto = parseAmt(montoMatch[1]);

        if (monto === 0) return;

        // Descripción = líneas antes del monto, limpiadas
        const descLines = currentLines
            .slice(0, montoIdx)
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .filter(l => !/^\d{8}/.test(l))
            .filter(l => !/^\d{10,}/.test(l))
            .filter(l => !/^\d{4}\/\d{4}$/.test(l))
            .filter(l => !l.startsWith('RASTREO'))
            .filter(l => !l.startsWith('CTA.BENEFICIARIO'));

        const concepto = descLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 150);
        if (!concepto) return;

        const tipo = isDeposit ? 'ingreso' : 'egreso';

        transactions.push({
            fecha: currentDate,
            concepto,
            monto,
            tipo,
            categoria: categorize(concepto, tipo),
            banco: 'Banamex',
        });
    }

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const s = line.trim();

        // Caso 1: fecha en una línea "16 FEB"
        const oneLineMatch = DATE_ONE_LINE.exec(s);
        if (oneLineMatch) {
            flushTransaction();
            const day = oneLineMatch[1].padStart(2, '0');
            const mon = oneLineMatch[2].toUpperCase();
            currentDate = `${year}-${MONTH_MAP[mon]}-${day}`;
            currentLines = [];
            i++;
            continue;
        }

        // Caso 2: día solo "16", mes en siguiente línea "FEB"
        const numOnlyMatch = DATE_NUM_ONLY.exec(s);
        const nextLineStr = i + 1 < lines.length ? lines[i + 1].trim().toUpperCase() : '';
        if (numOnlyMatch && MONTHS.has(nextLineStr)) {
            flushTransaction();
            const day = numOnlyMatch[1].padStart(2, '0');
            currentDate = `${year}-${MONTH_MAP[nextLineStr]}-${day}`;
            currentLines = [];
            i += 2;
            continue;
        }

        // Acumular en buffer de transacción actual
        if (currentDate) {
            currentLines.push(line);
        }
        i++;
    }
    // Flush última transacción
    flushTransaction();

    return { banco: 'Banamex', cuenta: accountNumber, periodo: periodFull, transactions };
}
