// Comprehensive categorization for Mexican bank statements

const CATEGORY_RULES = [
    // Ingresos
    { keywords: /TRANSFERENCIA BPI|ABONO.*NOMINA|NOMINA|NÓMINA|SUELDO|SALARIO/i, category: 'Salario', type: 'ingreso' },
    { keywords: /INTERESES GANADOS|RENDIMIENTO/i, category: 'Intereses', type: 'ingreso' },
    { keywords: /TRASPASO.*RECIB|PAGO RECIBIDO|DEPOSITO CANALES|SPIN BY OXXO/i, category: 'Transferencias', type: 'ingreso' },
    { keywords: /DEVOLUC/i, category: 'Devoluciones', type: 'ingreso' },

    // Supermercado
    { keywords: /OXXO|SEVEN|7-ELEVEN|ALSUPER|COSTCO|WALMART|WAL-MART|SAMS|SAM'S|CHEDRAUI|SORIANA|LA COMER|SUPERETTE|ABARR|MERCS POPULARES/i, category: 'Supermercado' },

    // Restaurantes
    { keywords: /RESTAURANT|DELIPOLLO|BURGER|MCDONALD|KFC|PIZZA HUT|DOMINOS|LITTLE CAESAR|STARBUCKS|CAFET|BURRITOS|POLLO|CARNES|CARNICERIAS|CARNECE/i, category: 'Restaurantes' },
    { keywords: /UBER\s*EATS|RAPPI|DIDI\s*FOOD/i, category: 'Restaurantes' },

    // Gasolina / Transporte
    { keywords: /GASOL|GAS ESTAC|GASOLINERA|PEMEX|SHELL|BP |COMBUSTIBLE/i, category: 'Gasolina' },
    { keywords: /CASETAS|CUOTA|AUTOPISTA/i, category: 'Casetas' },
    { keywords: /\bUBER\b|\bDIDI\b|CABIFY|INDRIVER/i, category: 'Transporte' },

    // Suscripciones
    { keywords: /NETFLIX|SPOTIFY|DISNEY|HBO|APPLE\.COM|APPLE COM|AMAZON PRIME|YOUTUBE PREMIUM/i, category: 'Suscripciones' },
    { keywords: /PADDLE|SETGB|OPENAI|CLAUDE|NETLIFY|PORKBUN|VERCEL/i, category: 'Suscripciones' },

    // Telefonía / Internet
    { keywords: /TELCEL|AT&T|TELMEX|TOTALPLAY|IZZI|MEGACABLE|MOVISTAR|RECARGA\s+CEL/i, category: 'Telefonía' },
    { keywords: /\bCFE\b|LUZ Y FUERZA|AGUA\s+MUN|MUNICIPIO/i, category: 'Servicios del hogar' },

    // Salud
    { keywords: /FARMACIA|FARMA|SIMILAR|BENAVIDES|GUADALAJARA|MEDICA|HOSPITAL|CLINICA|DENTISTA|OPTICA|ORTHOMEDICA/i, category: 'Salud' },

    // Ropa / Moda
    { keywords: /SEARS|LIVERPOOL|PALACIO\s+DE\s+HIERRO|ZARA|H&M|COPPEL|FAMA BOUT|SMILE INTIMATES|VICTORIA.*SECRET|MINISO/i, category: 'Ropa' },

    // Educación
    { keywords: /COLEGIO|ESCUELA|UNIVERSIDAD|UVM|ITESM|CLIP.*CLASES|CLASES|INGLES|ACADEMIA/i, category: 'Educación' },

    // Entretenimiento
    { keywords: /CASINO|CINE|TICKETMASTER|CINEMA|BOLICHE|PARQUE\s+DE\s+DIVERT|STEAM|VIDEOJUEGO/i, category: 'Entretenimiento' },

    // Compras online
    { keywords: /AMAZON|MERCADOPAGO|MERPAGO|PAYPAL|TEMU|EBANX/i, category: 'Compras online' },

    // Seguros
    { keywords: /QUALITAS|ALLIANZ|SEGUROS|GNP|MAPFRE|BBVA SEGUROS/i, category: 'Seguros' },

    // Servicios financieros
    { keywords: /COMISION|ADMINISTRACION RENTA|IVA COMIS|INTERESES\s+COBR|ESTADO\s+DE\s+CUENTA/i, category: 'Comisiones bancarias' },
    { keywords: /RETIRO CAJERO|CAJERO|DISP ATM|\bATM\b/i, category: 'Retiro efectivo' },
    { keywords: /TRANSFERENCIA|PAGO INTERBANCARIO|SPEI|TRASPASO/i, category: 'Transferencias' },

    // Hogar
    { keywords: /FERRE|FERRETERIA|HOME DEPOT|TRUPER|CONSTRURAMA/i, category: 'Hogar' },
    { keywords: /VETERINAR/i, category: 'Mascotas' },
];

/**
 * @param {string} description
 * @param {'ingreso'|'egreso'} tipo
 * @returns {string}
 */
export function categorize(description, tipo) {
    for (const rule of CATEGORY_RULES) {
        if (rule.type && rule.type !== tipo) continue;
        if (rule.keywords.test(description)) return rule.category;
    }
    return tipo === 'ingreso' ? 'Otros ingresos' : 'Otros gastos';
}
