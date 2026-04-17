-- ============================================================
-- FNCE v1 — Row Level Security Setup
-- Run this in the Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Add user_id column to each table (safe if already exists)
ALTER TABLE transactions      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE trading_operations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE portfolio_assets  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 2. Enable Row Level Security on each table
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_operations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets   ENABLE ROW LEVEL SECURITY;

-- 3. Create policies — each user sees only their own rows
--    (DROP IF EXISTS first so re-running is safe)

DROP POLICY IF EXISTS "users_own_transactions"       ON transactions;
DROP POLICY IF EXISTS "users_own_trading_operations" ON trading_operations;
DROP POLICY IF EXISTS "users_own_portfolio_assets"   ON portfolio_assets;

CREATE POLICY "users_own_transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_trading_operations"
  ON trading_operations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_portfolio_assets"
  ON portfolio_assets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Also enable in Supabase Dashboard (manual steps):
--   Authentication > Providers > Email  → Enable Email/Password
--   Authentication > Providers > Google → Enable + add Client ID/Secret
--     (Google credentials from: console.cloud.google.com)
-- ============================================================
