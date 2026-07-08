-- Parser Engine v2 — persistencia de layouts (PROPUESTA, no aplicada).
-- 4 tablas: definición, versiones, uso, fallas. Los layouts curados viven
-- además en el repo (docs/parser-engine/layouts/*.json); estas tablas guardan
-- los APRENDIDOS en runtime y las estadísticas de todos.

-- ── Definición: un renglón por layout lógico (independiente de versión) ──────
create table layout_definition (
  id              text primary key,              -- 'inbursa-debito'
  bank            text not null,                 -- etiqueta informativa
  tipo_cuenta     text not null check (tipo_cuenta in ('debito','credito')),
  maturity        text not null default 'provisional'
                    check (maturity in ('provisional','trusted','curated')),
  validation_count int not null default 0,       -- estados independientes que reconciliaron
  active_version  int not null default 1,
  fingerprint     jsonb not null,                -- { keywordHash, columnSignature, fontStats, ... }
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Versiones: el JSON de reglas por versión (deriva de formato → nueva versión) ─
create table layout_versions (
  id              uuid primary key default gen_random_uuid(),
  layout_id       text not null references layout_definition(id) on delete cascade,
  version         int not null,
  rules           jsonb not null,                -- el layout.json (LayoutSchema v1)
  source          text not null default 'generated'
                    check (source in ('generated','curated','migrated')),
  created_at      timestamptz not null default now(),
  unique (layout_id, version)
);

-- ── Uso: una fila por procesamiento (métricas del confidence.md) ─────────────
create table layout_usage (
  id                uuid primary key default gen_random_uuid(),
  layout_id         text references layout_definition(id) on delete set null,
  layout_version    int,
  regime            text check (regime in ('declared','undeclared')),
  route             text not null,               -- v2_trusted | v2_provisional | claude_partial | claude_full
  n_expected        int,
  n_extracted       int,
  delta_cargos      numeric(14,2),
  delta_abonos      numeric(14,2),
  confidence        numeric(5,4),
  unknown_rows      numeric(5,4),
  processing_ms     int,
  corrected_amount_date_tipo boolean default false,  -- error real del parser (señal)
  corrected_categoria        boolean default false,  -- gusto del usuario (ruido)
  user_id           uuid,                             -- para consentimiento/borrado
  created_at        timestamptz not null default now()
);

-- ── Fallas: detector de deriva. Cuando un layout trusted empieza a fallar. ───
create table layout_failures (
  id                uuid primary key default gen_random_uuid(),
  layout_id         text references layout_definition(id) on delete set null,
  layout_version    int,
  fingerprint       jsonb not null,              -- firma del PDF que falló
  reason            text,                        -- 'reconciliation' | 'balance' | 'unknown_rows' | ...
  delta_cargos      numeric(14,2),
  delta_abonos      numeric(14,2),
  regenerated       boolean default false,       -- ¿se generó una versión nueva?
  new_version       int,
  created_at        timestamptz not null default now()
);

-- Preguntas que estas tablas responden:
--   ¿Qué layout falla más?           select layout_id, count(*) from layout_failures group by 1 order by 2 desc;
--   ¿Cuál cambió recientemente?      select * from layout_versions order by created_at desc;
--   ¿Cuál lleva 6 meses sin usarse?  select id from layout_definition d where not exists
--                                       (select 1 from layout_usage u where u.layout_id=d.id
--                                        and u.created_at > now() - interval '6 months');
--   ¿Cuáles tienen menor confianza?  select layout_id, avg(confidence) from layout_usage group by 1 order by 2 asc;

create index on layout_usage (layout_id, created_at desc);
create index on layout_failures (layout_id, created_at desc);
