-- Budgets feature
-- Run in Supabase SQL Editor

create table if not exists budgets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    target_amount numeric not null,
    color text default '#FF7A1A',
    description text,
    created_at timestamptz default now()
);

create table if not exists budget_payments (
    id uuid primary key default gen_random_uuid(),
    budget_id uuid references budgets(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    amount numeric not null,
    date date not null default current_date,
    note text,
    created_at timestamptz default now()
);

-- RLS
alter table budgets enable row level security;
drop policy if exists "budgets_own" on budgets;
create policy "budgets_own" on budgets
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

alter table budget_payments enable row level security;
drop policy if exists "budget_payments_own" on budget_payments;
create policy "budget_payments_own" on budget_payments
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
