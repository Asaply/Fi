-- Reminders: monthly repeat + budget link
-- Run in Supabase SQL Editor

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS repeat_monthly boolean DEFAULT false;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS amount numeric;
