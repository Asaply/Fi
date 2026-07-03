# Golden test set — extracción de estados de cuenta MX

Verdad de referencia (totales declarados en cada estado) para validar `/api/analyze`.
La extracción reconcilia contra estos números: `sum(egresos) ≈ cargos`, `sum(ingresos) ≈ abonos`,
y `saldo_anterior + ingresos − egresos ≈ saldo_final`.

Para correr un test real hay que colocar los PDFs (anonimizados) junto a este archivo con el
nombre indicado en `file`, y ejecutar el analizador con `ANTHROPIC_API_KEY` configurada.

| file | banco | tipo | saldo_anterior | cargos (egresos) | abonos (ingresos) | saldo_final | n_cargos | n_abonos |
|------|-------|------|----------------|------------------|-------------------|-------------|----------|----------|
| bbva-debito-marce.pdf | BBVA | debito | 216.00 | 97378.97 | 101984.01 | 4821.04 | 62 | 21 |
| banamex-debito.pdf | Citibanamex | debito | 23221.52 | 34610.99 | 12340.00 | 950.53 | 26 | 9 |
| bbva-debito-jose.pdf | BBVA | debito | 9.84 | 9611.84 | 9977.08 | 375.08 | 14 | 9 |
| bbva-credito-oro.pdf | BBVA | credito | 116482.72 | 96632.08 | 116717.76 | 104111.62 | — | — |
| hsbc-debito.pdf | HSBC | debito | 1166.03 | 8464.69 | 8298.00 | 999.34 | — | — |
| inbursa-debito.pdf | Inbursa | debito | 96434.97 | 15482.59 | 9364.31 | 90316.69 | — | — |
| nu-debito.pdf | Nu | debito | 824.22 | 12392.26 | 11690.00 | 122.85 | — | — |
| santander-credito-likeu.pdf | Santander | credito | 12802.18 | 16338.95 | 12802.18 | 21249.36 | — | — |
| santander-debito.pdf | Santander | debito | 8358.02 | 49085.16 | 60345.68 | 19618.54 | — | — |
| scotiabank-debito.pdf | Scotiabank | debito | 3826.23 | 49517.12 | 45695.77 | 4.88 | — | — |

## Notas / trampas por muestra
- **BBVA débito**: columnas de SALDO OPERACION/LIQUIDACION a la derecha — NO son montos. Filas EUR "978" + TC — usar pesos.
- **Banamex**: total de egresos = "Retiros/Otros cargos" (combina retiros + compras). Saldo al corte reconcilia.
- **BBVA crédito**: `saldo_final` = Saldo deudor total 104,111.62. `cargos`/`abonos` = "TOTAL CARGOS/ABONOS" de la lista regular. NO importar el calendario "diferidos a meses" (Monto original/Saldo pendiente).
- **HSBC**: PDF con texto corrupto → depende de lectura de imagen. Filas de moneda extranjera con TC.
- **Inbursa**: "INTERESES GANADOS" es abono (parte de los 9,364.31).
- **Nu**: columna única con signo. NO duplicar con la sección "cajitas".
- **Santander crédito**: `saldo_final` = Saldo deudor total 21,249.36. Columna con signo; "Total de cargos/abonos".
- **Scotiabank / Santander débito**: columnas Depósito/Retiro + Saldo; ignorar Saldo. Conceptos multilínea con SPEI.
