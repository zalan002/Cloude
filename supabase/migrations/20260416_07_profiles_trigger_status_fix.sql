-- ============================================================
-- CONSORTIO - Profiles trigger fix: guard NEW.status references
-- Date: 2026-04-16
-- ============================================================
-- The 20260416_02_profiles_rls.sql migration installed two
-- triggers that reference NEW.status / OLD.status unconditionally.
-- On deployments where the profiles table only has the legacy
-- `is_active` boolean column and no `status` column, those
-- triggers raise "column status does not exist" at runtime,
-- breaking every UPDATE on profiles.
--
-- This migration re-installs both trigger functions with the
-- status check wrapped in BEGIN / EXCEPTION WHEN undefined_column
-- so they degrade gracefully on schemas without the column,
-- matching how is_active and department are already handled.
--
-- Depends on: 20260416_02_profiles_rls.sql
-- ============================================================

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

  -- status column may or may not exist depending on schema
  -- history; guard it conditionally.
  BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only admins can change status';
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

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

-- ============================================================
-- Audit trigger: log role / status / is_active changes
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

    -- status column may or may not exist.
    BEGIN
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
    EXCEPTION
      WHEN undefined_column THEN
        NULL;
    END;

    -- is_active is the legacy equivalent of status on some deployments.
    BEGIN
      IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        PERFORM public.write_audit_log_internal(
          v_actor,
          'profile.is_active_changed',
          'warn',
          'profile',
          NEW.id::text,
          jsonb_build_object(
            'target_user_id', NEW.id,
            'target_email', NEW.email,
            'old_is_active', OLD.is_active,
            'new_is_active', NEW.is_active
          )
        );
      END IF;
    EXCEPTION
      WHEN undefined_column THEN
        NULL;
    END;
  ELSIF TG_OP = 'INSERT' THEN
    -- Build the payload piece by piece so we can tolerate either
    -- status or is_active being absent.
    DECLARE
      v_payload jsonb := jsonb_build_object(
        'target_user_id', NEW.id,
        'target_email', NEW.email,
        'role', NEW.role
      );
    BEGIN
      BEGIN
        v_payload := v_payload || jsonb_build_object('status', NEW.status);
      EXCEPTION WHEN undefined_column THEN NULL;
      END;
      BEGIN
        v_payload := v_payload || jsonb_build_object('is_active', NEW.is_active);
      EXCEPTION WHEN undefined_column THEN NULL;
      END;

      PERFORM public.write_audit_log_internal(
        v_actor,
        'profile.created',
        'info',
        'profile',
        NEW.id::text,
        v_payload
      );
    END;
  END IF;

  RETURN NEW;
END;
$$;
