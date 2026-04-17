# FNCE — CONTEXT-DB.md
> Cargar junto a CONTEXT.md solo en tareas que tocan base de datos.

**Supabase Project ID:** `rdmvynbidxfesvdkuqga`

---

## Tablas

### `transactions`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| tipo | text | `'Ingreso'` · `'Egreso'` · `'Gasto Personal'` · `'Inversión'` |
| monto | numeric | Positivo siempre; el tipo define si es ingreso/egreso |
| categoria | text | Ya existe — no recrear |
| descripcion | text | |
| fecha | date | |
| created_at | timestamptz | |

### `trading_operations`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| ticker | text | |
| tipo | text | `'Long'` · `'Short'` |
| entrada | numeric | |
| salida | numeric | Null si trade abierto |
| cantidad | numeric | |
| fecha_entrada | date | |
| fecha_salida | date | Null si abierto |
| resultado | numeric | P&L calculado |

### `portfolio_assets`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| ticker | text | |
| tipo | text | `'stock'` · `'etf'` · `'crypto'` |
| cantidad | numeric | |
| precio_promedio | numeric | Precio de compra promedio |

### `clients` / `prospects`
Ocultos en v1. No modificar esquema.

---

## Row Level Security
- Sprint 5 implementa RLS por `user_id`
- En desarrollo local RLS puede estar desactivado — no asumir que está activo
