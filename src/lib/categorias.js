export const CATEGORIAS_EGRESO = [
    'Restaurantes',
    'Comida y Abarrotes',
    'Transporte',
    'Automóvil',
    'Suscripciones',
    'Transferencias',
    'Salud',
    'Entretenimiento',
    'Ropa y Accesorios',
    'Papelería',
    'Servicios (luz, agua, internet)',
    'Educación',
    'Viaje / Hospedaje',
    'Seguros',
    'Inversión',
    'Otros',
];

export const CATEGORIAS_INGRESO = [
    'Sueldo',
    'Freelance',
    'Transferencia recibida',
    'Inversión',
    'Venta',
    'Cashback',
    'Devoluciones',
    'Intereses',
    'Otros',
];

// All unique categories combined (used for import preview dropdowns)
export const CATEGORIAS_ALL = [
    ...CATEGORIAS_EGRESO,
    ...CATEGORIAS_INGRESO.filter(c => !CATEGORIAS_EGRESO.includes(c)),
];

// Payment-processor / aggregator prefixes that wrap the real merchant name on a
// bank statement (e.g. "PAYCLIP*REST MERCATO", "SQ *CAFE", "MP*UBER"). We strip
// them so the underlying merchant can be matched by the rules and by memory.
const PROCESSOR_PREFIXES = [
    'payclip', 'clip', 'sq', 'sqc', 'squ', 'square', 'pp', 'paypal', 'mp',
    'merpago', 'mercadopago', 'mercado pago', 'dlo', 'dlocal', 'ebanx', 'stripe',
    'conekta', 'openpay', 'izettle', 'sr pago', 'srpago', 'netpay', 'billpocket',
    'aplazo', 'kueski', 'smartpy', 'smart py',
    'ztl', 'pagando', 'pointmp', 'point mp', 'spin de', 'spin',
];

// Normalize a raw statement concept for matching: lowercase, strip accents,
// treat *,/,- as separators, drop leading processor prefixes and long digit
// refs, collapse whitespace.
export function normalizarConcepto(concepto) {
    let s = (concepto || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[*/\\|#.,;:]+/g, ' ')                    // separators → space
        .replace(/\b\d[\d\s-]{3,}\b/g, ' ')               // long digit refs / card tails
        .replace(/\s+/g, ' ')
        .trim();
    // Peel off leading processor tokens ("payclip rest mercato" → "rest mercato").
    let changed = true;
    while (changed) {
        changed = false;
        for (const p of PROCESSOR_PREFIXES) {
            if (s === p) { s = ''; break; }
            if (s.startsWith(p + ' ')) { s = s.slice(p.length + 1); changed = true; break; }
        }
    }
    return s.trim();
}

// Stable merchant key used to look up what the user categorized this merchant as
// before. Keeps the first few significant tokens (drops trailing store/city
// noise so "OXXO ZIBATA" and "OXXO JURICA" share a key when short, but distinct
// full names stay distinct).
export function claveComercio(concepto) {
    const norm = normalizarConcepto(concepto);
    if (!norm) return '';
    return norm.split(' ').filter(Boolean).slice(0, 3).join(' ');
}

// Each rule: [tokens, category]. Matched against the NORMALIZED concept, so no
// accents and processor prefixes already removed. Ordered by priority.
const REGLAS = [
    [['restaurante', 'restaurant', ' rest ', 'resto', 'taqueria', ' taco', 'tacos', 'cocina', 'kitchen', 'grill', 'parrilla', 'asador', 'marisco', 'sushi', 'ramen', 'pizza', 'burger', 'burguer', 'hamburgues', 'wings', 'alitas', 'comedor', 'fonda', 'cantina', 'birrieria', 'pozole', 'antojitos', 'buffet', 'mariscos', 'carnes', 'steak', 'bbq', 'deli', 'bistro', 'brasa',
        'mcdonald', 'burger king', 'kfc', 'subway', 'dominos', 'little caesar', 'carls jr', 'wendys', 'popeyes', 'sirloin', 'vips', 'toks', 'sanborns', 'applebee', 'chilis', 'wingstop', 'starbucks', 'cafe', 'coffee', 'panaderia', 'pasteleria', 'heladeria', 'nieve', 'churro', 'cinnabon', 'krispy', 'dunkin', 'mercato', 'sonora grill', 'la casa de tono', 'el fogoncito',
        'pret a manger', 'autogrill', 'gelateria', 'gelato', 'ristorante', 'trattoria', 'osteria', 'pizzeria', 'paninoteca', 'panino', 'forno', 'sapori', 'singular coff', 'cookies', 'bakery', 'gastro', 'tavola', 'enoteca', 'sushi', 'poke', 'hamb', 'wendys',
        'burrito', 'burritos', 'gordita', 'gorditas', 'neveria', 'paleteria', 'palet y', 'tamales', 'flautas', 'tortas', 'menudo', 'barbacoa', 'carnitas', 'birria', 'cenaduria', 'loncheria', 'sueco', 'las gorditas',
        'dairy queen', 'caffenio', 'buffal', 'delipollo', 'pollo', 'elote', 'baker', 'lonche', 'lonches', 'dogo', 'hot dog', 'hotdog', 'pozoleria', 'cafeteria', 'bar ', 'tamtamales'], 'Restaurantes'],
    [['oxxo', 'seven', '7-eleven', 'seven eleven', 'circle k', 'super', 'abarrote', 'walmart', 'chedraui', 'soriana', 'costco', 'sam', 'bodega aurrera', 'aurrera', 'la comer', 'comercial mexicana', 'heb', 'h-e-b', 'city market', 'fresko', 'merza', 'kiosko', 'tienda', 'minisuper', 'abarr', 'fruteria', 'carniceria', 'verduleria', 'tortilleria', 'mercado', 'central de abasto', 'smart and final', 'calimax',
        'al super', 'alsuper', 'fresh market', 'supermercado', 'lidl', 'carrefour', 'mercadona', 'alcampo', 'eroski', 'consum', 'conad', 'esselunga', 'coop', 'aldi', 'spar', 'grocery', 'supermarket', 'maquinas vending', 'vending', 'gate retail',
        'wal mart', 'wal-mart', 'abts', 'carnice', 'carn', 'quesos', 'licor', 'licores', 'vinos y lico', 'vinos', 'cremeria', 'salchichoneria', 'perales', 'alim', 'tda '], 'Comida y Abarrotes'],
    [['uber', 'didi', 'cabify', 'indriver', 'taxi', 'gasolin', 'pemex', 'oxxo gas', 'gas ', 'shell', 'mobil', 'combustible', 'estacionamiento', 'parking', 'parkimovil', 'caseta', 'peaje', 'capufe', 'metro', 'metrobus', 'autobus', 'camion', 'ado', 'primera plus', 'etn', 'aeropuerto', 'vuelo', 'aerolinea', 'volaris', 'aeromexico', 'viva aerobus', 'vivaaerobus', 'jetblue', 'american airlines', 'bird', 'jump', 'ecobici',
        'wizz air', 'wizz', 'ryanair', 'easyjet', 'vueling', 'iberia', 'ita airways', 'alitalia', 'lufthansa', 'renfe', 'trenitalia', 'italo treno', 'atm milano', 'fgv', 'aeroport', 'aeroporto', 'malpensa', 'fiumicino', 'autostrade', 'telepass', 'bolt', 'freenow', 'trenord', 'flixbus',
        'usfuel', 'fuel', 'gasol', 'aeroter', 'casetas'], 'Transporte'],
    [['taller', 'refaccion', 'autozone', 'refaccionaria', 'llantas', 'vulcaniz', 'verificentro', 'verificacion', 'tenencia', 'agencia', 'mecanico', 'lavado auto', 'autolavado', 'seguro auto', 'kavak', 'gnp auto'], 'Automóvil'],
    [['netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'star plus', 'hbo', 'paramount', 'crunchyroll', 'youtube premium', 'apple.com', 'apple com', 'itunes', 'icloud', 'google storage', 'google one', 'suscripcion', 'subscription', 'membresia', 'membership', 'openai', 'chatgpt', 'claude', 'anthropic', 'github', 'vercel', 'notion', 'canva', 'adobe', 'dropbox', 'microsoft', 'office 365', 'linkedin', 'twitch', 'patreon', 'audible', 'deezer', 'tidal', 'amazon', 'amzn', 'holafly', 'esim', 'airalo',
        'netlify', 'porkbun', 'godaddy', 'namecheap', 'cloudflare', 'hostinger', 'digitalocean', 'heroku', 'render com', 'supabase', 'firebase', 'atlassian', 'figma', 'openrouter', 'anthropic', 'cursor', 'replit',
        'hotmart', 'twinkl', 'recurrente', 'carg recur', 'cargo recur', 'domain', 'dominio', 'plan anual', 'plan mensual'], 'Suscripciones'],
    [['transferencia', 'spei', 'transfer', 'traspaso', 'envio de dinero', 'deposito a', 'pago a tercero', 'pago cuenta de tercero', 'pago tarjeta de credito', 'pago de tarjeta', 'pago tdc', 'su pago', 'clabe', 'dimo', 'codi', 'cajero', 'retiro de efectivo', 'retiro efectivo', 'disposicion de efectivo', 'disposicion cred', 'disp de efec', 'disposicion efec'], 'Transferencias'],
    [['farmacia', 'benavides', 'guadalajara', 'del ahorro', 'san pablo', 'similares', 'cruz verde', 'medico', 'doctor', 'hospital', 'clinica', 'sanatorio', 'laboratorio', 'chopo', 'salud digna', 'dentista', 'dental', 'odonto', 'optica', 'lentes', 'psicolog', 'nutriolog', 'consultorio', 'imss', 'issste', 'medicamento', 'far guad', 'farmacias guad', 'veterinaria', 'veterinario', 'clinica vet', 'ortho', 'ortopedia', 'orthomedica', 'medica', 'farmacon', 'droguer', 'farm ', 'bio healt'], 'Salud'],
    [['cinepolis', 'cinemex', 'cinema', 'teatro', 'concierto', 'evento', 'ticketmaster', 'boletia', 'stubhub', 'museo', 'parque', 'feria', 'antro', ' bar ', 'cerveceria', 'pub ', 'billar', 'boliche', 'karaoke', 'casino', 'videojuego', 'gaming', 'steam', 'playstation', 'ps store', 'xbox', 'nintendo', 'epic games', 'riot', 'twitch', 'gimnasio', 'gym', 'smart fit', 'crossfit', 'spa', 'masaje', 'wellness', 'museo', 'club social', 'estet', 'gypsy', 'whiskey', 'cerveza', 'mezcal'], 'Entretenimiento'],
    [['zara', 'h&m', 'h y m', 'pull&bear', 'bershka', 'stradivarius', 'liverpool', 'palacio de hierro', 'sears', 'suburbia', 'coppel', 'shein', 'nike', 'adidas', 'puma', 'converse', 'vans', 'levis', 'american eagle', 'forever 21', 'ropa', 'zapateria', 'zapatos', 'calzado', 'boutique', 'joyeria', 'reloj', 'perfumeria', 'sephora', 'sally', 'moda', 'fashion', 'flexi', 'andrea', 'price shoes',
        'victoria s secret', 'victoria secret', 'intimates', 'burlington', 'five below', 'temu', 'aeropostale', 'gap', 'old navy', 'ross', 'tj maxx', 'marshalls',
        'shasa', 'miniso', 'revolve', 'accesorio', 'miss acc', 'bershka', 'cklass', 'price shoes', 'dportenis', 'innova sport', 'marti'], 'Ropa y Accesorios'],
    [['papeleria', 'office depot', 'officemax', 'lumen', 'tania', 'imprenta', 'copias', 'libreria', 'gonvill', 'porrua', 'ghandi'], 'Papelería'],
    [['telmex', 'telcel', 'at&t', 'att ', 'movistar', 'unefon', 'bait', 'izzi', 'megacable', 'totalplay', 'dish', 'sky', 'cfe', 'comision federal', 'agua', 'sacmex', 'siapa', 'gas natural', 'naturgy', 'gas lp', 'internet', 'telefono', 'recarga', 'recibo', 'predial', 'servicio de luz'], 'Servicios (luz, agua, internet)'],
    [['colegio', 'univ', 'instituto', 'escuela', 'preparatoria', 'kinder', 'colegiatura', 'inscripcion', 'curso', 'diplomado', 'udemy', 'platzi', 'coursera', 'domestika', 'duolingo', 'clase', 'academia', 'tutoria', 'libro de texto', 'isep', 'to school', 'zooec'], 'Educación'],
    [['airbnb', 'booking', 'hotel', 'hostal', 'hostel', 'motel', 'resort', 'trivago', 'expedia', 'despegar', 'hoteles', 'marriott', 'hilton', 'hyatt', 'holiday inn', 'city express', 'fiesta inn', 'posada', 'lodging'], 'Viaje / Hospedaje'],
    [['seguros', 'seguro', 'allianz', 'qualitas', 'poliza', 'polizas', 'gnp', 'axa', 'metlife', 'mapfre', 'chubb', 'zurich', 'aseguradora', 'inbursa seguros', 'aba seguros', 'primero seguros'], 'Seguros'],
    [['gbm', 'kuspit', 'bitso', 'binance', 'coinbase', 'etoro', 'cetesdirecto', 'fondeadora', 'inversion', 'afore', 'broker', 'trading'], 'Inversión'],
];

// Ingreso-side rules (matched only for tipo ingreso).
const REGLAS_INGRESO = [
    [['nomina', 'sueldo', 'salario', 'quincena', 'pago de nomina'], 'Sueldo'],
    [['freelance', 'honorarios', 'servicios profesionales', 'factura'], 'Freelance'],
    [['reembolso', 'devolucion', 'reverso', 'bonificacion'], 'Devoluciones'],
    [['cashback', 'recompensa', 'puntos', 'reward'], 'Cashback'],
    [['interes', 'rendimiento', 'dividendo'], 'Intereses'],
    [['venta', 'cobro', 'deposito de'], 'Venta'],
    [['transferencia', 'spei', 'recibido', 'deposito'], 'Transferencia recibida'],
];

// Match a token at a word boundary as a PREFIX, so brand prefixes still hit
// ("oxxo" → "oxxopaseo", "netflix" → "netflix com") but mid-word substrings do
// not ("ado" must not match "suministrador"). Tokens are already space-form
// because normalizarConcepto stripped punctuation.
function tokenMatch(norm, token) {
    const t = token.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!t) return false;
    return new RegExp('\\b' + t).test(norm);
}

// Common Mexican/Spanish first names. Used to spot a concept that is just a
// person's name (a P2P transfer whose merchant text is only the recipient), so
// it goes to Transferencias instead of Otros. A dictionary (not a shape rule)
// avoids sweeping in businesses like "Atelier Prato" or "Suprem Pinazo".
const NOMBRES = new Set([
    'jose', 'juan', 'luis', 'carlos', 'jorge', 'miguel', 'francisco', 'javier',
    'antonio', 'manuel', 'pedro', 'alberto', 'ricardo', 'fernando', 'roberto',
    'eduardo', 'sergio', 'raul', 'hector', 'oscar', 'osmar', 'arturo', 'alejandro',
    'daniel', 'david', 'diego', 'emilio', 'gabriel', 'gerardo', 'gustavo', 'ivan',
    'leonardo', 'marco', 'mario', 'martin', 'omar', 'pablo', 'rafael', 'ramon',
    'rodrigo', 'ruben', 'salvador', 'santiago', 'saul', 'tomas', 'victor', 'abel',
    'adrian', 'agustin', 'andres', 'angel', 'benjamin', 'cesar', 'cristian',
    'enrique', 'esteban', 'felipe', 'guillermo', 'ignacio', 'isaac', 'joaquin',
    'julio', 'lorenzo', 'lucas', 'marcos', 'mateo', 'mauricio', 'nicolas', 'noe',
    'rene', 'sebastian', 'vicente', 'ernesto', 'armando', 'alfredo', 'aldo',
    'maria', 'guadalupe', 'juana', 'margarita', 'ana', 'rosa', 'blanca', 'laura',
    'veronica', 'patricia', 'sofia', 'gabriela', 'monica', 'adriana', 'alejandra',
    'andrea', 'carmen', 'claudia', 'daniela', 'diana', 'elena', 'fernanda',
    'isabel', 'jimena', 'karla', 'leticia', 'lucia', 'luz', 'maribel', 'martha',
    'mariana', 'marisol', 'natalia', 'norma', 'paola', 'paulina', 'raquel',
    'regina', 'silvia', 'susana', 'teresa', 'valeria', 'vanessa', 'ximena', 'yolanda',
    'brenda', 'cecilia', 'dulce', 'erika', 'karen', 'lorena', 'nancy', 'rocio', 'wendy',
    'estela', 'karina', 'isela', 'ada', 'anabel', 'abraham', 'griselda', 'irma', 'gloria',
    'beatriz', 'alicia', 'josefina', 'elizabeth', 'liliana', 'miriam', 'perla', 'sandra',
    'roxana', 'viridiana', 'anahi', 'itzel', 'citlali', 'edith', 'evelin', 'jessica',
]);

// True when the concept is (essentially) a person's name — a P2P transfer whose
// text is just the recipient. Two shapes:
//   1. 1–3 alphabetic tokens, first is a known first name ("luis torres").
//   2. A full name (first TWO tokens are both known first names, e.g. "blanca
//      estela ...", "joaquin arturo ...") with up to 6 alpha tokens, allowing
//      trailing surnames plus a note word ("deposito", "hospedaje"). Requiring
//      two given names avoids sweeping in businesses like "Andrea Boutique".
function esNombrePersona(norm) {
    const tokens = norm.split(' ').filter(Boolean);
    if (!tokens.every(t => /^[a-z]+$/.test(t))) return false;
    if (tokens.length >= 1 && tokens.length <= 3 && NOMBRES.has(tokens[0])) return true;
    if (tokens.length >= 2 && tokens.length <= 6
        && NOMBRES.has(tokens[0]) && NOMBRES.has(tokens[1])) return true;
    return false;
}

function aplicarReglas(norm, reglas) {
    for (const [palabras, categoria] of reglas) {
        if (palabras.some(p => tokenMatch(norm, p))) return categoria;
    }
    return null;
}

// Infer a category from the concept text alone (no history). `tipo` selects the
// ingreso vs egreso rule set.
export function inferirCategoria(concepto, tipo) {
    const norm = normalizarConcepto(concepto);
    const esIngreso = String(tipo || '').toLowerCase().startsWith('ing')
        || String(tipo || '').toLowerCase() === 'abono';
    if (!norm) {
        // A non-empty concept that normalized to nothing was pure processor
        // wrapper (e.g. "MERCADO PAGO", "SPEI") — a bare transfer/payment.
        if (concepto && String(concepto).trim()) return esIngreso ? 'Transferencia recibida' : 'Transferencias';
        return 'Otros';
    }
    if (esIngreso) {
        return aplicarReglas(norm, REGLAS_INGRESO) || 'Otros';
    }
    const cat = aplicarReglas(norm, REGLAS);
    if (cat) return cat;
    // Heuristic fallback: a concept naming an "app" (e.g. "STRIPE *TEQUILA APP",
    // "ALGUNA APP") is almost always a digital subscription. Whole-word so it
    // doesn't catch "apparel"/"apple".
    if (/\bapp\b/.test(norm)) return 'Suscripciones';
    // A bare person name (no merchant signal) is a P2P transfer.
    if (esNombrePersona(norm)) return 'Transferencias';
    return 'Otros';
}

// Build a memory of how the user has categorized each merchant before, from
// their existing transactions. Only counts real (non-Otros) categories and picks
// the most frequent per merchant key. Pass this to `resolverCategoria` so
// repeated merchants inherit the user's own choice instead of falling to Otros.
export function construirMemoriaCategorias(transactions) {
    const counts = new Map(); // clave → Map(categoria → n)
    for (const t of transactions || []) {
        const cat = t.categoria || t.category;
        if (!cat || cat === 'Otros') continue;
        const clave = claveComercio(t.concept || t.concepto || '');
        if (!clave) continue;
        if (!counts.has(clave)) counts.set(clave, new Map());
        const m = counts.get(clave);
        m.set(cat, (m.get(cat) || 0) + 1);
    }
    const memoria = new Map();
    for (const [clave, m] of counts) {
        let best = null, bestN = 0;
        for (const [cat, n] of m) if (n > bestN) { best = cat; bestN = n; }
        if (best) memoria.set(clave, best);
    }
    return memoria;
}

// Resolve the best category with priority:
//   1. user's history (memoria) for this merchant,
//   2. an already-good category coming from the source (not Otros),
//   3. keyword rules,
//   4. Otros.
export function resolverCategoria(concepto, categoriaPrevia, memoria, tipo) {
    if (memoria && memoria.size) {
        const clave = claveComercio(concepto);
        if (clave && memoria.has(clave)) return memoria.get(clave);
    }
    if (categoriaPrevia && categoriaPrevia !== 'Otros') return categoriaPrevia;
    return inferirCategoria(concepto, tipo);
}

export function categoriasParaTipo(tipo) {
    const t = (tipo || '').toLowerCase().trim();
    if (t === 'egreso') return CATEGORIAS_EGRESO;
    return CATEGORIAS_INGRESO;
}
