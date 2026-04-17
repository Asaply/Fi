export const DASHBOARD_STEPS = [
    { target: '[data-tour="time-filter"]', title: 'Filtra por período', description: 'Cambia el rango de tiempo para ver tus datos por mes, trimestre o año.', position: 'bottom' },
    { target: '[data-tour="resumen-finanzas"]', title: 'Resumen de Finanzas', description: 'Ingresos, egresos y ganancia neta del período seleccionado.', position: 'bottom' },
    { target: '[data-tour="resumen-trading"]', title: 'Resumen de Trading', description: 'Tu P&L total y win rate de operaciones cerradas.', position: 'bottom' },
    { target: '[data-tour="gastos-categoria"]', title: 'Gastos por categoría', description: 'Visualiza en qué estás gastando y en qué proporción.', position: 'top' },
];

export const FINANZAS_STEPS = [
    { target: '[data-tour="btn-nueva-transaccion"]', title: 'Registra una transacción', description: 'Agrega ingresos, egresos o inversiones manualmente.', position: 'bottom' },
    { target: '[data-tour="btn-importar-csv"]', title: 'Importa tu estado de cuenta', description: 'Soporta CSV de BBVA, Banorte y Santander. Las transacciones se categorizan automáticamente.', position: 'bottom' },
    { target: '[data-tour="filtros-tipo"]', title: 'Filtra por tipo', description: 'Separa entre Ingresos, Egresos, Inversiones o lo que está por cobrar.', position: 'bottom' },
];

export const TRADING_STEPS = [
    { target: '[data-tour="btn-nuevo-trade"]', title: 'Registra un trade', description: 'Agrega operaciones long o short. Al cerrar la posición, FNCE calcula tu P&L automáticamente.', position: 'bottom' },
    { target: '[data-tour="card-winrate"]', title: 'Win Rate', description: 'Porcentaje de trades ganadores sobre el total de operaciones cerradas.', position: 'bottom' },
    { target: '[data-tour="pl-calendar"]', title: 'Calendario P&L', description: 'Vista día a día de tus resultados. Verde = ganador, rojo = perdedor.', position: 'top' },
];

export const PORTFOLIO_STEPS = [
    { target: '[data-tour="btn-agregar-activo"]', title: 'Agrega tus inversiones', description: 'Registra acciones, ETFs o crypto con tu precio de compra promedio.', position: 'bottom' },
    { target: '[data-tour="tabla-activos"]', title: 'Precio en tiempo real', description: 'Los precios se actualizan vía Yahoo Finance y CoinGecko. El P&L se calcula automáticamente.', position: 'top' },
];
