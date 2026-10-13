-- Bank sync core: provider links, accounts and bank columns on transactions.
-- Additive and idempotent: safe to run before any code that uses it.

create table if not exists public.bank_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    provider_link_id text not null unique,
    institution_name text,
    institution_code text,
    status text not null default 'syncing'
        check (status in ('syncing', 'valid', 'token_required', 'invalid', 'disconnected')),
    last_synced_at timestamptz,
    last_manual_sync_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists bank_links_user_id_idx on public.bank_links(user_id);

create table if not exists public.bank_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    link_id uuid not null references public.bank_links(id) on delete cascade,
    provider_account_id text not null unique,
    name text,
    number_masked text,
    account_type text not null check (account_type in ('debito', 'credito')),
    currency text not null default 'MXN',
    balance_current numeric,
    balance_available numeric,
    credit_limit numeric,
    cutoff_date date,
    payment_due_date date,
    minimum_payment numeric,
    no_interest_payment numeric,
    connected boolean not null default true,
    updated_at timestamptz not null default now()
);
create index if not exists bank_accounts_link_id_idx on public.bank_accounts(link_id);
create index if not exists bank_accounts_user_id_idx on public.bank_accounts(user_id);

alter table public.transactions
    add column if not exists source text not null default 'manual',
    add column if not exists external_id text,
    add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null,
    add column if not exists bank_status text,
    add column if not exists categoria_origen text,
    add column if not exists transfer_group_id uuid,
    add column if not exists merchant text;

-- One row per provider transaction per user. NULL external_id (manual rows) never conflicts.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'transactions_user_external_key') then
        alter table public.transactions
            add constraint transactions_user_external_key unique (user_id, external_id);
    end if;
end $$;
create index if not exists transactions_transfer_group_idx
    on public.transactions(transfer_group_id) where transfer_group_id is not null;
create index if not exists transactions_bank_account_date_idx
    on public.transactions(bank_account_id, date) where bank_account_id is not null;

-- Users read their own links/accounts; only Edge Functions (service role) write.
alter table public.bank_links enable row level security;
alter table public.bank_accounts enable row level security;

drop policy if exists "bank_links_select_own" on public.bank_links;
create policy "bank_links_select_own" on public.bank_links
    for select to authenticated using (auth.uid() = user_id);

drop policy if exists "bank_accounts_select_own" on public.bank_accounts;
create policy "bank_accounts_select_own" on public.bank_accounts
    for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.bank_links, public.bank_accounts from anon, authenticated;
