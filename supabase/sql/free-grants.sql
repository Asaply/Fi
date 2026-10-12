-- Run this in Supabase SQL Editor
-- First-150-users free lifetime tier + race-safe claim function.

create table if not exists public.free_grants (
    seq        bigint generated always as identity primary key,  -- 1..N claim order
    user_id    uuid not null unique references auth.users(id) on delete cascade,
    granted_at timestamptz not null default now()
);

create unique index if not exists free_grants_user_idx on public.free_grants(user_id);

-- RLS: users may read their own grant; only service role writes.
alter table public.free_grants enable row level security;

create policy "Users read own free grant"
    on public.free_grants for select
    using (auth.uid() = user_id);

create policy "Service role manages free grants"
    on public.free_grants for all
    using (auth.role() = 'service_role');

-- Atomic claim. Race-safe: pg_advisory_xact_lock serializes the count+insert
-- critical section across concurrent callers, so no more than p_limit grants
-- can ever be issued. The user_id unique constraint is a second backstop.
-- Idempotent: a user who already claimed gets their existing slot back.
create or replace function public.claim_free_slot(p_user_id uuid, p_limit int default 150)
returns table(granted boolean, slot bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing bigint;
    v_count    bigint;
    v_slot     bigint;
begin
    select seq into v_existing from free_grants where user_id = p_user_id;
    if v_existing is not null then
        return query select true, v_existing;
        return;
    end if;

    perform pg_advisory_xact_lock(hashtext('free_grants_claim'));

    select count(*) into v_count from free_grants;
    if v_count >= p_limit then
        return query select false, null::bigint;
        return;
    end if;

    insert into free_grants(user_id) values (p_user_id) returning seq into v_slot;
    return query select true, v_slot;
end;
$$;

-- Only the service role (server-side) may call it.
revoke all on function public.claim_free_slot(uuid, int) from public, anon, authenticated;
