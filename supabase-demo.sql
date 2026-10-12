-- ============================================================
-- Cuenta de prueba (/demo) — requisitos de esquema
-- Correr en Supabase Dashboard > SQL Editor. Es idempotente.
--
-- El endpoint /api/demo siembra transactions, portfolio_assets, budgets,
-- budget_payments y reminders con el service role (salta RLS). Todo lo demás
-- ya existe; esto solo cubre las columnas que el seed necesita y que no están
-- en los .sql originales.
-- ============================================================

-- El selector de emoji de /budgets escribe `icon`, pero supabase-budgets.sql
-- nunca lo creó. Sin esta columna el seed de metas de ahorro falla.
alter table public.budgets add column if not exists icon text;

-- El rate limit por IP de /api/demo usa esta tabla (ya creada por
-- supabase-anon-rate-limits.sql; se repite aquí para instalaciones nuevas).
create table if not exists public.anon_rate_limits (
    key      text primary key,
    count    int not null default 0,
    reset_at timestamptz not null
);
create index if not exists anon_rate_limits_reset_at_idx on public.anon_rate_limits(reset_at);

-- Consulta de apoyo: cuántas cuentas demo hay vivas y desde cuándo.
--   select email, created_at
--   from auth.users
--   where email like '%@demo.nva.lat'
--   order by created_at desc;
