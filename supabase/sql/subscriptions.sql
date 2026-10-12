-- Run this in Supabase SQL Editor
-- Creates subscriptions table for paywall

create table if not exists public.subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    status text not null default 'pending', -- pending | active | rejected
    mp_payment_id text,
    mp_payment_data jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id)
);

-- RLS
alter table public.subscriptions enable row level security;

-- Users can only read their own subscription
create policy "Users read own subscription"
    on public.subscriptions for select
    using (auth.uid() = user_id);

-- Only service role can insert/update (webhook uses service role key)
create policy "Service role manages subscriptions"
    on public.subscriptions for all
    using (auth.role() = 'service_role');

-- Index for fast lookups
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

-- ── Subscription model v2 (recurring Stripe + Apple StoreKit) ──────────────
-- Additive columns; safe to run on an existing table.
alter table public.subscriptions add column if not exists source text;                       -- stripe | apple | free
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists stripe_customer_id text;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists apple_original_transaction_id text;

create index if not exists subscriptions_stripe_sub_idx on public.subscriptions(stripe_subscription_id);
create index if not exists subscriptions_apple_otx_idx on public.subscriptions(apple_original_transaction_id);
