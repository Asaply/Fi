-- Run in Supabase SQL Editor
-- Distributed rate limiting for anonymous free-tier analysis

create table if not exists public.anon_rate_limits (
    key text primary key,
    count int not null default 0,
    reset_at timestamptz not null
);

-- No RLS — only accessed via service role from API routes
-- Clean up expired rows periodically (optional cron job)
create index if not exists anon_rate_limits_reset_at_idx on public.anon_rate_limits(reset_at);
