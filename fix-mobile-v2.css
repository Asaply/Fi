fix-mobile-v2.md # Fix: Mobile v2 — Portfolio Health y layout issues ## Lee primero: - src/app/portfolio-health/page.js - src/app/dashboard/page.js - Todos los CSS de portfolio-health --- ## 1. PORTFOLIO HEALTH — HEADER EN MOBILE ```css @media (max-width: 768px) {

    /* Título en una sola línea */
    .portfolio-header h1,
    .portfolio-title {
        font-size: 1.4rem !important;
        white-space: nowrap;
    }

    /* Header: stack vertical en mobile */
    .portfolio-header {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 12px !important;
    }

    /* Selector de período ocupa ancho completo */
    .portfolio-periodo-selector {
        width: 100%;
        justify-content: space-between;
    }

    /* Botón Agregar Activo — ancho completo */
    .btn-agregar-activo {
        width: 100% !important;
        justify-content: center !important;
    }
}

``` --- ## 2. GRÁFICA PORTAFOLIO VS MERCADO — TÍTULO EN MOBILE ```css @media (max-width: 768px) {

    /* Contenedor título + selector en columna */
    .chart-header {
        flex-direction: column !important;
        gap: 8px !important;
    }

    .chart-title {
        font-size: 1rem !important;
        line-height: 1.3 !important;
    }

    /* Selector de tiempo compacto */
    .chart-time-selector {
        align-self: flex-start;
        font-size: 0.8rem !important;
    }
}

``` --- ## 3. RESUMEN PORTFOLIO HEALTH EN DASHBOARD — TOP 3 ACTIVOS El card tiene 3 columnas (valor, dona, top3) que en mobile se cortan. ```css @media (max-width: 768px) {

    /* Stack vertical */
    .portfolio-summary-grid {
        flex-direction: column !important;
        gap: 16px !important;
    }

    /* Dona centrada */
    .portfolio-donut-wrapper {
        display: flex;
        justify-content: center;
        width: 100% !important;
    }

    /* Top 3 — cada fila sin overflow */
    .top-activos-list {
        width: 100% !important;
    }

    .top-activo-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        overflow: hidden;
    }

    .top-activo-monto {
        flex-shrink: 0;
        font-size: 0.85rem !important;
    }

    .top-activo-nombre {
        font-size: 0.85rem !important;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 120px;
    }
}

``` --- ## 4. CALENDARIO RECORDATORIOS — LAYOUT EN MOBILE El calendario con dos columnas (calendario + lista) en mobile debe stackearse: ```css @media (max-width: 768px) {
    .recordatorios-layout {
        flex-direction: column !important;
    }

    .recordatorios-calendario {
        width: 100% !important;
    }

    .recordatorios-lista {
        width: 100% !important;
        margin-top: 16px;
    }
}

``` --- ## 5. GASTOS POR CATEGORÍA EN DASHBOARD — DONA EN MOBILE La dona se corta en mobile porque el contenedor no tiene ancho suficiente: ```css @media (max-width: 768px) {
    .gastos-categoria-card {
        padding: 16px !important;
    }

    /* Layout vertical */
    .gastos-layout {
        flex-direction: column !important;
        align-items: center !important;
    }

    /* Recharts ResponsiveContainer necesita width explícito en mobile */
    .donut-recharts-wrapper {
        width: 100% !important;
        height: 220px !important;
    }

    .gastos-leyenda {
        width: 100% !important;
        margin-top: 16px !important;
    }
}

``` ## Notas - No romper layout desktop. - Probar en 375px y 390px de ancho. - Si los nombres de clase no coinciden exactamente,
buscar los equivalentes reales en el código antes de aplicar.