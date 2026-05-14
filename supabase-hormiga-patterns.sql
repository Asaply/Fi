-- Run in Supabase SQL Editor
-- Stores memory of detected gastos hormiga patterns per user

create table if not exists public.hormiga_patterns (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    pattern_key text not null,
    label text not null,
    periods_detected int not null default 1,
    total_accumulated numeric not null default 0,
    first_seen date not null default current_date,
    last_seen date not null default current_date,
    is_regularized boolean not null default false,
    unique(user_id, pattern_key)
);

alter table public.hormiga_patterns enable row level security;

create policy "Users manage own hormiga patterns"
    on public.hormiga_patterns for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists hormiga_patterns_user_id_idx on public.hormiga_patterns(user_id);
