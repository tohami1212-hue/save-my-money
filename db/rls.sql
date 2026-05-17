-- Row-Level Security for Railway PostgreSQL.
-- Run this in your Railway PostgreSQL console (or psql) AFTER running drizzle-kit push.
--
-- Strategy: We use application-level security as the primary layer (Drizzle
-- always filters by household_id from the JWT session). This RLS is a defense-in-depth
-- layer protecting against application bugs. It relies on a session variable
-- set by the app before each query:
--   SET LOCAL app.current_household_id = '<uuid>';
--
-- For a private two-person household app, application-level filtering in Drizzle
-- is sufficient for MVP. Enable full RLS below when you want the extra safety layer.

-- ─── OPTION A: Application-level only (MVP default) ───────────────────────────
-- No SQL needed — Drizzle queries always include .where(eq(table.householdId, householdId))
-- from the session. This is safe for a private app; add RLS below for extra hardening.

-- ─── OPTION B: Full PostgreSQL RLS (run when ready) ──────────────────────────

-- Create the session variable helper
-- The app sets this via: SET LOCAL app.current_household_id = '...';
-- In Drizzle: db.execute(sql`SET LOCAL app.current_household_id = ${householdId}`);

CREATE OR REPLACE FUNCTION current_household_id()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_household_id', true), '')::uuid
$$;

-- transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_household ON transactions
  USING (household_id = current_household_id());

-- accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_household ON accounts
  USING (household_id = current_household_id());

-- merchants
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY merchants_household ON merchants
  USING (household_id = current_household_id());

-- recurring_expenses
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY recurring_household ON recurring_expenses
  USING (household_id = current_household_id());

-- monthly_snapshots
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_household ON monthly_snapshots
  USING (household_id = current_household_id());

-- insights
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY insights_household ON insights
  USING (household_id = current_household_id());

-- recommendations
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY recommendations_household ON recommendations
  USING (household_id = current_household_id());

-- categories (system categories visible to all)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_visible ON categories
  USING (household_id IS NULL OR household_id = current_household_id());

-- audit_logs (read-only via app; writes use superuser/service role)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_read ON audit_logs
  FOR SELECT USING (household_id = current_household_id());
