-- Run in Supabase SQL Editor
-- Distributed rate limiting for anonymous free-tier analysis

create table if not exists public.anon_rate_limits (
    key text primary key,
    count int not null default 0,
    reset_at timestamptz not null
);

-- RLS on with no policies: only the service role (API routes) can read or
-- write. Without it, anyone with the anon key could delete rows and reset
-- their own rate limit.
alter table public.anon_rate_limits enable row level security;
-- Clean up expired rows periodically (optional cron job)
create index if not exists anon_rate_limits_reset_at_idx on public.anon_rate_limits(reset_at);
