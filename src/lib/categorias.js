export const CATEGORIAS_EGRESO = [
    'Restaurantes',
    'Comida y Abarrotes',
    'Transporte',
    'Suscripciones',
    'Transferencias',
    'Salud',
    'Entretenimiento',
    'Ropa y Accesorios',
    'Servicios (luz, agua, internet)',
    'Educación',
    'Otros',
];

export const CATEGORIAS_INGRESO = [
    'Sueldo',
    'Freelance',
    'Transferencia recibida',
    'Inversión',
    'Venta',
    'Otros',
];

// All unique categories combined (used for import preview dropdowns)
export const CATEGORIAS_ALL = [
    ...CATEGORIAS_EGRESO,
    ...CATEGORIAS_INGRESO.filter(c => !CATEGORIAS_EGRESO.includes(c)),
];

const REGLAS = [
    [['restaurante', 'restaurant', 'mcdonalds', 'burger', 'pizza', 'sushi', 'taco', 'subway', 'kfc', 'dominos', 'starbucks', 'cafe', 'coffee', 'oxxo comida', 'little caesars', 'vips', 'applebee', 'cinnabon'], 'Restaurantes'],
    [['walmart', 'chedraui', 'soriana', 'costco', 'superama', 'la comer', 'mercado', 'abarrotes', 'bodega aurrera', "sam's", 'oxxo', 'seven eleven', '7-eleven', 'farmacias'], 'Comida y Abarrotes'],
    [['uber', 'didi', 'cabify', 'taxi', 'gasolina', 'pemex', 'estacionamiento', 'caseta', 'metro ', 'autobus', 'camion', 'aeropuerto', 'vuelo', 'aerolinea', 'volaris', 'aeromexico', 'viva aerobus'], 'Transporte'],
    [['netflix', 'spotify', 'amazon prime', 'disney', 'apple', 'youtube premium', 'suscripcion', 'subscription', 'membresia', 'hbo', 'crunchyroll', 'twitch', 'openai', 'claude', 'github', 'vercel', 'chatgpt'], 'Suscripciones'],
    [['transferencia', 'spei', 'transfer', 'envio', 'pago a ', 'comision'], 'Transferencias'],
    [['farmacia', 'medico', 'doctor', 'hospital', 'clinica', 'benavides', 'guadalajara', 'cruz verde', 'laboratorio', 'dentista', 'optica', 'psicologo'], 'Salud'],
    [['cinepolis', 'cinemex', 'teatro', 'concierto', 'evento', 'bar ', 'antro', 'videojuego', 'steam', 'playstation', 'xbox', 'nintendo', 'spotify', 'ticketmaster'], 'Entretenimiento'],
    [['zara', 'h&m', 'liverpool', 'palacio de hierro', 'suburbia', 'shein', 'ropa', 'zapatos', 'moda', 'fashion'], 'Ropa y Accesorios'],
    [['telmex', 'telcel', 'att', 'movistar', 'izzi', 'megacable', 'totalplay', 'cfe', 'agua', ' gas ', 'internet', 'telefono', 'luz '], 'Servicios (luz, agua, internet)'],
    [['colegio', 'universidad', 'escuela', 'colegiatura', 'libro', 'curso', 'udemy', 'platzi', 'coursera', 'educacion'], 'Educación'],
];

export function inferirCategoria(concepto) {
    const texto = (concepto || '').toLowerCase();
    for (const [palabras, categoria] of REGLAS) {
        if (palabras.some(p => texto.includes(p))) return categoria;
    }
    return 'Otros';
}

export function categoriasParaTipo(tipo) {
    const t = (tipo || '').toLowerCase().trim();
    if (t === 'egreso') return CATEGORIAS_EGRESO;
    return CATEGORIAS_INGRESO;
}
