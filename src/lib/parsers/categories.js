// Comprehensive categorization for Mexican bank statements

const CATEGORY_RULES = [

    // =====================
    // INGRESOS
    // =====================
    { keywords: /CASHBACK|CASH\s*BACK|RECOMPENSA|BONIFICACION|BONIFICACIÓN/i, category: 'Cashback', type: 'ingreso' },
    { keywords: /TRANSFERENCIA BPI|ABONO.*NOMINA|NOMINA|NÓMINA|SUELDO|SALARIO|PAYROLL/i, category: 'Salario', type: 'ingreso' },
    { keywords: /INTERESES GANADOS|RENDIMIENTO|INTERES ABONADO/i, category: 'Intereses', type: 'ingreso' },
    { keywords: /TRASPASO.*RECIB|PAGO RECIBIDO|DEPOSITO CANALES|SPIN BY OXXO|SPEI RECIBIDO/i, category: 'Transferencias', type: 'ingreso' },
    { keywords: /DEVOLUC|REFUND/i, category: 'Devoluciones', type: 'ingreso' },

    // =====================
    // SUPERMERCADOS / CONVENIENCIA
    // =====================
    { keywords: /OXXO|7[-\s]?ELEVEN|SEVEN|EXTRA|CIRCLE\s*K|KIOSKO|GO MART/i, category: 'Conveniencia' },
    { keywords: /WALMART|WAL[-\s]?MART|BODEGA AURRERA|SUPERAMA|SAMS|SAM'?S|COSTCO|CHEDRAUI|SORIANA|LA COMER|CITY MARKET|FRESKO|ALSUPER|HEB|H-E-B|CALIMAX/i, category: 'Supermercado' },

    // =====================
    // RESTAURANTES / COMIDA
    // =====================
    { keywords: /MCDONALD'?S|BURGER KING|KFC|CARL'?S JR|SUBWAY|DOMINO'?S|PIZZA HUT|LITTLE CAESAR|STARBUCKS|VIPS|TOKS|SANBORNS|CHILI'?S|ITALIANNI'?S|WINGSTOP|SHAKE SHACK|DUNKIN/i, category: 'Restaurantes' },
    { keywords: /TAQUERIA|TACOS|BURRITOS|COCINA|FONDA|CAFETERIA|RESTAURANT|PIZZERIA|POLLO|MARISCOS|SUSHI/i, category: 'Restaurantes' },
    { keywords: /UBER\s*EATS|RAPPI|DIDI\s*FOOD|SINDELANTAL/i, category: 'Delivery comida' },

    // =====================
    // GASOLINA / TRANSPORTE
    // =====================
    { keywords: /PEMEX|OXXO GAS|BP\b|SHELL|TOTAL|REPSOL|ARCO|G500|HIDROSINA|FULLGAS|COSTCO GAS|PETROSEVEN|AKRON|LAGAS|ORO NEGRO/i, category: 'Gasolina' },
    { keywords: /GASOL|COMBUSTIBLE|ESTACION DE SERVICIO/i, category: 'Gasolina' },

    { keywords: /UBER\b|DIDI\b|CABIFY|INDRIVER|BEAT/i, category: 'Transporte' },
    { keywords: /METRO|METROBUS|RTP|TREN SUBURBANO/i, category: 'Transporte público' },

    { keywords: /CASETA|CUOTA|AUTOPISTA|PASE|TAG|IAVE|TELEVIA/i, category: 'Casetas' },

    // =====================
    // SUSCRIPCIONES / SOFTWARE
    // =====================
    { keywords: /NETFLIX|SPOTIFY|DISNEY|HBO|MAX|APPLE\.COM|APPLE COM|ICLOUD|AMAZON PRIME|YOUTUBE PREMIUM|PARAMOUNT/i, category: 'Streaming' },
    { keywords: /OPENAI|CHATGPT|CLAUDE|ANTHROPIC|NOTION|FIGMA|CANVA|ADOBE|ADOBE SYSTEMS|MIDJOURNEY|GITHUB|COPILOT/i, category: 'Software' },
    { keywords: /PADDLE|STRIPE|VERCEL|NETLIFY|RAILWAY|DIGITALOCEAN|AWS|GOOGLE CLOUD|HEROKU/i, category: 'Infraestructura' },

    // =====================
    // TELEFONÍA / SERVICIOS
    // =====================
    { keywords: /TELCEL|AT&T|MOVISTAR/i, category: 'Telefonía móvil' },
    { keywords: /TELMEX|IZZI|TOTALPLAY|MEGACABLE/i, category: 'Internet' },
    { keywords: /\bCFE\b|LUZ|ENERGIA/i, category: 'Electricidad' },
    { keywords: /AGUA|SACMEX/i, category: 'Agua' },
    { keywords: /GAS NATURAL|GAS LP/i, category: 'Gas hogar' },

    // =====================
    // SALUD
    // =====================
    { keywords: /FARMACIA|SIMILARES|BENAVIDES|GUADALAJARA|DEL AHORRO/i, category: 'Farmacia' },
    { keywords: /HOSPITAL|CLINICA|MEDICO|DOCTOR|DENTISTA|OPTICA|LABORATORIO/i, category: 'Salud' },

    // =====================
    // ROPA / RETAIL
    // =====================
    { keywords: /ZARA|H&M|BERSHKA|PULL&BEAR|STRADIVARIUS|MANGO|LIVERPOOL|SEARS|PALACIO DE HIERRO|COPPEL|SUBURBIA/i, category: 'Ropa' },
    { keywords: /NIKE|ADIDAS|PUMA|INNOVASPORT/i, category: 'Ropa deportiva' },

    // =====================
    // EDUCACIÓN
    // =====================
    { keywords: /UVM|ITESM|UNAM|IPN|COLEGIO|ESCUELA|UNIVERSIDAD/i, category: 'Educación' },
    { keywords: /CURSO|CURSOS|CLASES|ACADEMIA|INGLES|PLATZI|UDEMY|COURSERA/i, category: 'Cursos online' },

    // =====================
    // ENTRETENIMIENTO
    // =====================
    { keywords: /CINEPOLIS|CINEMEX|CINE|TEATRO/i, category: 'Cine' },
    { keywords: /TICKETMASTER|BOLETO|EVENTO/i, category: 'Eventos' },
    { keywords: /STEAM|PLAYSTATION|XBOX|NINTENDO|EPIC GAMES/i, category: 'Videojuegos' },

    // =====================
    // ECOMMERCE
    // =====================
    { keywords: /AMAZON|MERCADO\s*LIBRE|MERCADOPAGO|PAYPAL|TEMU|SHEIN|ALIEXPRESS|EBANX/i, category: 'Compras online' },

    // =====================
    // SEGUROS / FINANZAS
    // =====================
    { keywords: /QUALITAS|GNP|AXA|MAPFRE|ALLIANZ/i, category: 'Seguros' },
    { keywords: /COMISION|ANUALIDAD|IVA COMIS|INTERES COBRADO/i, category: 'Comisiones bancarias' },
    { keywords: /CAJERO|ATM|RETIRO/i, category: 'Retiro efectivo' },
    { keywords: /SPEI|TRANSFERENCIA|TRASPASO|PAGO INTERBANCARIO/i, category: 'Transferencias' },

    // =====================
    // HOGAR / OTROS
    // =====================
    { keywords: /HOME DEPOT|TRUPER|FERRETERIA|CONSTRURAMA/i, category: 'Hogar' },
    { keywords: /VETERINARIA|PETCO|MASKOTA/i, category: 'Mascotas' },
    { keywords: /BARBER|ESTETICA|SPA|SALON/i, category: 'Cuidado personal' },

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
