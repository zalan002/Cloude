-- ============================================================
-- CONSORTIO - Profiles RLS hardening
-- Date: 2026-04-16
-- ============================================================
-- Locks down the public.profiles table so that:
--   * Users can only read / self-update their own row.
--   * Only admins can see every row or modify other users'
--     sensitive fields (role, status, email).
--   * Role/status/email cannot be changed by a non-admin, even
--     for the user's own row (enforced by a BEFORE UPDATE trigger).
--   * All role and status changes are written to audit_log
--     via write_audit_log_internal().
--
-- Depends on: 20260416_01_audit_log.sql
-- ============================================================

-- ============================================================
-- Helper: SECURITY DEFINER admin check
-- ============================================================
-- Must be SECURITY DEFINER so it can read public.profiles even
-- when the caller's own RLS would normally hide other rows.
-- This avoids the classic "RLS references the same table"
-- recursion issue where a policy on profiles cannot safely
-- subquery profiles itself.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- ============================================================
-- Profiles RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Clean slate — drop any pre-existing policies so we have a
-- single, well-understood set going forward.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

-- SELECT: user sees own row
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- SELECT: admin sees every row
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.current_user_is_admin());

-- UPDATE: user may update own row (trigger below restricts which columns)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- UPDATE: admin may update any row
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- NOTE: No INSERT or DELETE policies. Inserts happen via the
-- handle_new_user() trigger on auth.users (SECURITY DEFINER),
-- deletes should only happen via service_role + cascading
-- auth.users delete.

-- ============================================================
-- Column-level guard: non-admins cannot change sensitive fields
-- ============================================================
-- Even though RLS lets a user UPDATE their own row, this trigger
-- prevents them from changing id, email, role, status or
-- department via that path. Only an admin (current_user_is_admin)
-- or the service role (which bypasses RLS and triggers based on
-- session_replication_role) can change those.
CREATE OR REPLACE FUNCTION public.profiles_limit_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Bypass for replication / service_role-driven changes.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.current_user_is_admin();

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin path: block changes to sensitive columns.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Only admins can change email';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only admins can change role';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only admins can change status';
  END IF;

  -- department column may or may not exist depending on schema
  -- history; guard it conditionally.
  BEGIN
    IF NEW.department IS DISTINCT FROM OLD.department THEN
      RAISE EXCEPTION 'Only admins can change department';
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  -- is_active is a legacy boolean column on some deployments;
  -- block non-admin changes there too.
  BEGIN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Only admins can change is_active';
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_limit_self_update_trg ON public.profiles;
CREATE TRIGGER profiles_limit_self_update_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_limit_self_update();

-- ============================================================
-- Audit trigger: log role / status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.profiles_audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.write_audit_log_internal(
        v_actor,
        'profile.role_changed',
        'warn',
        'profile',
        NEW.id::text,
        jsonb_build_object(
          'target_user_id', NEW.id,
          'target_email', NEW.email,
          'old_role', OLD.role,
          'new_role', NEW.role
        )
      );
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.write_audit_log_internal(
        v_actor,
        'profile.status_changed',
        'warn',
        'profile',
        NEW.id::text,
        jsonb_build_object(
          'target_user_id', NEW.id,
          'target_email', NEW.email,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log_internal(
      v_actor,
      'profile.created',
      'info',
      'profile',
      NEW.id::text,
      jsonb_build_object(
        'target_user_id', NEW.id,
        'target_email', NEW.email,
        'role', NEW.role,
        'status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_audit_changes_trg ON public.profiles;
CREATE TRIGGER profiles_audit_changes_trg
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_audit_changes();
