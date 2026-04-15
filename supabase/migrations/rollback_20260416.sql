-- ============================================================
-- CONSORTIO - ROLLBACK for 20260416_01_audit_log.sql
--                   and 20260416_02_profiles_rls.sql
-- Date: 2026-04-16
-- ============================================================
-- Reverts the two migrations that were applied to Supabase.
-- Run this in the Supabase SQL Editor as a single transaction.
--
-- What this does:
--   1. Drops the new profiles triggers (fixes the admin lockout).
--   2. Drops the new profiles trigger functions.
--   3. Drops the new profiles RLS policies.
--   4. Drops the current_user_is_admin() helper.
--   5. Re-creates a minimal, standard profiles RLS policy set
--      (SELECT+UPDATE own row) so the app keeps working exactly
--      as it did before migration 2 was applied.
--   6. Drops the audit_log table and all of its functions/triggers.
--
-- Notes:
--   - Wrapped in BEGIN/COMMIT so nothing is half-applied.
--   - SET LOCAL session_replication_role = replica disables the
--     (still broken) triggers so the DROPs run cleanly even if
--     profiles is touched incidentally during the rollback.
--   - Safe to re-run: every statement uses IF EXISTS.
-- ============================================================

BEGIN;

SET LOCAL session_replication_role = replica;

-- ------------------------------------------------------------
-- 1. Drop profiles triggers and their functions
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS profiles_limit_self_update_trg ON public.profiles;
DROP TRIGGER IF EXISTS profiles_audit_changes_trg    ON public.profiles;

DROP FUNCTION IF EXISTS public.profiles_limit_self_update();
DROP FUNCTION IF EXISTS public.profiles_audit_changes();

-- ------------------------------------------------------------
-- 2. Drop the new profiles RLS policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- ------------------------------------------------------------
-- 3. Drop the current_user_is_admin() helper
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.current_user_is_admin();

-- ------------------------------------------------------------
-- 4. Re-create a minimal, standard profiles RLS policy set.
--    These are the conventional Supabase defaults — every user
--    sees and can update only their own row. Admin visibility
--    was previously provided via the server's service role
--    client, which bypasses RLS, so we don't strictly need an
--    admin policy here for the app to function.
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- 5. Drop audit_log infrastructure (migration 01)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
DROP TABLE    IF EXISTS public.audit_log CASCADE;

DROP FUNCTION IF EXISTS public.prevent_audit_log_update();
DROP FUNCTION IF EXISTS public.write_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.write_audit_log_internal(UUID, TEXT, TEXT, TEXT, TEXT, JSONB);

-- ------------------------------------------------------------
-- 6. Make sure your admin account is active (safety net)
-- ------------------------------------------------------------
UPDATE public.profiles
   SET is_active = true
 WHERE role = 'admin';

COMMIT;

-- ============================================================
-- Verification — run these SELECTs after the COMMIT to confirm
-- a clean rollback. Each should return 0 rows (or the admin row).
-- ============================================================

-- Should return 0 rows:
SELECT tgname
  FROM pg_trigger
 WHERE tgname IN ('profiles_limit_self_update_trg','profiles_audit_changes_trg','audit_log_no_update');

-- Should return 0 rows:
SELECT proname
  FROM pg_proc
 WHERE proname IN (
   'profiles_limit_self_update',
   'profiles_audit_changes',
   'current_user_is_admin',
   'write_audit_log',
   'write_audit_log_internal',
   'prevent_audit_log_update'
 );

-- Should return 0 rows:
SELECT to_regclass('public.audit_log') AS audit_log_table;

-- Should show the 2 recreated policies:
SELECT policyname FROM pg_policies WHERE tablename = 'profiles' ORDER BY policyname;

-- Your admin row should have is_active = true:
SELECT id, email, role, is_active FROM public.profiles WHERE role = 'admin';
