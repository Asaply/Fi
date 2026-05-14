import { categorize } from './categories.js';

/**
 * Nu (Nubank) Mexico Statement Parser
 * Supports: Nu Débito / Nu Cuenta
 */

const MONTH_MAP = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
};

export function parseNu(text, isCreditCard = false) {
    const transactions = [];
    
    // Detect period
    const periodMatch = text.match(/Periodo:\s+del\s+(\d+)\s+al\s+(\d+)\s+([a-z]{3})\s+(\d{4})/i);
    const year = periodMatch ? periodMatch[4] : new Date().getFullYear().toString();
    const month = periodMatch ? (MONTH_MAP[periodMatch[3].toLowerCase()] || '01') : '01';
    const period = periodMatch ? `${year}-${month}-${periodMatch[1]} al ${year}-${month}-${periodMatch[2]}` : '';

    // Detect account
    const accountMatch = text.match(/Cuenta Nu:\s+(\d+)/i);
    const account = accountMatch ? `****${accountMatch[1].slice(-4)}` : '';

    // Nu Débito parser logic
    // Format is vertical:
    // FECHA (DD MMM YYYY)
    // DESCRIPTION
    // MONTO EN PESOS MEXICANOS
    // SIGNED AMOUNT (+/-$1,234.56)
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    for (let i = 0; i < lines.length; i++) {
        const dateMatch = lines[i].match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
        if (dateMatch) {
            const day = dateMatch[1].padStart(2, '0');
            const mStr = dateMatch[2].toLowerCase();
            const y = dateMatch[3];
            const isoDate = `${y}-${MONTH_MAP[mStr] || '01'}-${day}`;
            
            // Description is usually the next line
            let desc = lines[i+1] || '';
            
            // Look ahead for the amount
            // Usually amount is prefixed by "MONTO EN PESOS MEXICANOS" or just follows the description
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const amtMatch = lines[j].match(/^([+\-])\s*\$\s*([\d,]+\.\d{2})$/);
                if (amtMatch) {
                    const sign = amtMatch[1];
                    const amount = parseFloat(amtMatch[2].replace(/,/g, ''));
                    const tipo = sign === '+' ? 'ingreso' : 'egreso';
                    
                    // If description is just "MONTO EN PESOS MEXICANOS", use the previous line
                    if (desc === 'MONTO EN PESOS MEXICANOS' && lines[j-2]) {
                        desc = lines[j-2];
                    }

                    transactions.push({
                        fecha: isoDate,
                        concepto: desc,
                        monto: amount,
                        tipo,
                        categoria: categorize(desc, tipo),
                        banco: 'Nu'
                    });
                    
                    // Move outer loop index to avoid re-parsing same block
                    i = j;
                    break;
                }
                
                // Keep building description if it's multiline
                if (j === i + 1 && lines[j] !== 'MONTO EN PESOS MEXICANOS') {
                    // stays desc
                } else if (lines[j] !== 'MONTO EN PESOS MEXICANOS' && !lines[j].match(/^([+\-])\s*\$\s*/)) {
                    // desc += ' ' + lines[j];
                }
            }
        }
    }

    return {
        banco: 'Nu',
        cuenta: account,
        periodo: period,
        transactions
    };
}
