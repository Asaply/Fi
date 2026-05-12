// Comprehensive categorization for Mexican bank statements
// Handles Nu, BBVA, Santander, Banorte, HSBC, Scotiabank formats
// Nu truncates merchant names: "REST NOMBRE" = restaurant, "RESTAUR NOMBRE" = restaurant

// ─── Strip payment processor prefixes ────────────────────────────────────────
// Some banks/processors wrap merchant names: "CLIP MX*REST PALETERIA", "SQ *MERCHANT"
// Strip the prefix so rules match the actual merchant name
function stripProcessorPrefix(desc) {
    return (desc || '')
        .replace(/^CLIP\s*MX\s*\*\s*/i, '')
        .replace(/^SQ\s*\*\s*/i, '')           // Square
        .replace(/^PP\s*\*\s*/i, '')            // PayPal POS
        .replace(/^PAYPAL\s*\*\s*/i, '')
        .replace(/^AMZN\s*MKTP\s*/i, 'AMAZON ')
        .replace(/^COMPRA\s+/i, '')             // Nu / generic "Compra NOMBRE"
        .trim();
}

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
    // NU-SPECIFIC
    // =====================
    // "Depósito en Cajita" / "Cajita Turbo" = Nu savings feature → Inversión
    { keywords: /CAJITA|DEPOSITO EN CAJITA/i, category: 'Inversión' },

    // =====================
    // SUPERMERCADOS / CONVENIENCIA
    // =====================
    { keywords: /OXXO|7[-\s]?ELEVEN|SEVEN|EXTRA\b|CIRCLE\s*K|KIOSKO|GO MART/i, category: 'Conveniencia' },
    { keywords: /WALMART|WAL[-\s]?MART|BODEGA AURRERA|SUPERAMA|SAMS|SAM'?S|COSTCO|CHEDRAUI|SORIANA|LA COMER|CITY MARKET|FRESKO|ALSUPER|HEB|H-E-B|CALIMAX/i, category: 'Supermercado' },

    // =====================
    // RESTAURANTES / COMIDA
    // =====================
    { keywords: /MCDONALD'?S|BURGER KING|KFC|CARL'?S JR|SUBWAY|DOMINO'?S|PIZZA HUT|LITTLE CAESAR|STARBUCKS|VIPS|TOKS|SANBORNS|CHILI'?S|ITALIANNI'?S|WINGSTOP|SHAKE SHACK|DUNKIN|WENDY'?S|WENDYS|HAMBWEND/i, category: 'Restaurantes' },
    { keywords: /TAQUERIA|TACOS|BURRITOS|COCINA|FONDA|CAFETERIA|RESTAURANT|RESTAUR|PIZZERIA|MARISCOS|SUSHI/i, category: 'Restaurantes' },
    // Nu truncates: "REST " at start = restaurant abbreviation
    { keywords: /^REST\s+|^REST$/i, category: 'Restaurantes' },
    // Common food establishments missed by chain-name rules
    { keywords: /PALETERIA|PALETER|HELADERIA|NEVERIA|LONCHERIA|TORTAS|TAMALES|ANTOJITOS|BIRRIA|CARNITAS|POZOLERIA|BARBACOA|CEVICHE|BUFFET|PASTELERIA|PANADERIA|CREMERIA|FRITANGA|TOSTADAS/i, category: 'Restaurantes' },
    { keywords: /\bPOLLO\b|ASADOR|PARRILL|CARNITAS/i, category: 'Restaurantes' },
    { keywords: /UBER\s*EATS|RAPPI|DIDI\s*FOOD|SINDELANTAL/i, category: 'Delivery comida' },

    // =====================
    // GASOLINA / TRANSPORTE
    // =====================
    { keywords: /PEMEX|OXXO GAS|BP\b|SHELL|TOTAL\s*GAS|REPSOL|ARCO|G500|HIDROSINA|FULLGAS|COSTCO GAS|PETROSEVEN|AKRON|LAGAS|ORO NEGRO/i, category: 'Gasolina' },
    { keywords: /GASOL|COMBUSTIBLE|ESTACION DE SERVICIO/i, category: 'Gasolina' },

    { keywords: /UBER\b|DIDI\b|CABIFY|INDRIVER|BEAT/i, category: 'Transporte' },
    { keywords: /\bMETRO\b|METROBUS|RTP\b|TREN SUBURBANO/i, category: 'Transporte público' },
    { keywords: /CASETA|CUOTA|AUTOPISTA|PASE|TAG|IAVE|TELEVIA/i, category: 'Casetas' },

    // Auto parts / taller
    { keywords: /AUTOZONE|O'?REILLY|REFACCIONARIA|LLANTERA|VULCANIZADORA|TALLER\s+MEC|AUTOPARTES|REFACCIONES/i, category: 'Automóvil' },

    // =====================
    // SUSCRIPCIONES / SOFTWARE
    // =====================
    { keywords: /NETFLIX|SPOTIFY|DISNEY|HBO|MAX\b|APPLE\.COM|APPLE COM|ICLOUD|AMAZON PRIME|YOUTUBE PREMIUM|PARAMOUNT/i, category: 'Streaming' },
    { keywords: /OPENAI|CHATGPT|CLAUDE|ANTHROPIC|NOTION|FIGMA|CANVA|ADOBE|ADOBE SYSTEMS|MIDJOURNEY|GITHUB|COPILOT|MICROSOFT|OFFICE 365|XBOX|ONEDRIVE|DROPBOX|EVERNOTE|LASTPASS|1PASSWORD/i, category: 'Software' },
    { keywords: /PADDLE|STRIPE|VERCEL|NETLIFY|RAILWAY|DIGITALOCEAN|AWS|GOOGLE CLOUD|HEROKU/i, category: 'Infraestructura' },
    // Domain registrars
    { keywords: /PORKBUN|NAMECHEAP|GODADDY|NAME\.COM|HOVER\b|CLOUDFLARE|GANDI\b|DYNADOT/i, category: 'Infraestructura' },

    // =====================
    // TELEFONÍA / SERVICIOS
    // =====================
    { keywords: /TELCEL|AT&T|MOVISTAR/i, category: 'Telefonía móvil' },
    { keywords: /TELMEX|IZZI|TOTALPLAY|MEGACABLE/i, category: 'Internet' },
    { keywords: /\bCFE\b|LUZ\b|ENERGIA\b/i, category: 'Electricidad' },
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
    // PAPELERÍA / OFICINA
    // =====================
    { keywords: /OFFICE DEPOT|OFFICEMAX|OFFICE MAX|STAPLES|PAPELERIA|LIBRERIA|IMPRENTA|COPIAS\b/i, category: 'Papelería' },

    // =====================
    // EDUCACIÓN
    // =====================
    { keywords: /UVM|ITESM|UNAM|IPN|COLEGIO|ESCUELA|UNIVERSIDAD/i, category: 'Educación' },
    { keywords: /CURSO|CURSOS|CLASES|ACADEMIA|INGLES|PLATZI|UDEMY|COURSERA/i, category: 'Cursos online' },

    // =====================
    // ENTRETENIMIENTO
    // =====================
    { keywords: /CINEPOLIS|CINEMEX|CINE\b|TEATRO/i, category: 'Cine' },
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
    { keywords: /BARBER|ESTETICA|SPA\b|SALON/i, category: 'Cuidado personal' },

];

/**
 * @param {string} description
 * @param {'ingreso'|'egreso'} tipo
 * @returns {string}
 */
export function categorize(description, tipo) {
    const desc = description || '';
    // Test both original and processor-stripped version — rules run on stripped first
    const stripped = stripProcessorPrefix(desc);
    for (const rule of CATEGORY_RULES) {
        if (rule.type && rule.type !== tipo) continue;
        if (rule.keywords.test(stripped)) return rule.category;
    }
    // Fallback: test original in case stripping removed useful context
    if (stripped !== desc) {
        for (const rule of CATEGORY_RULES) {
            if (rule.type && rule.type !== tipo) continue;
            if (rule.keywords.test(desc)) return rule.category;
        }
    }
    return tipo === 'ingreso' ? 'Otros ingresos' : 'Otros gastos';
}
