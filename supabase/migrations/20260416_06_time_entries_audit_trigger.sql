-- ============================================================
-- CONSORTIO - time_entries audit trigger
-- Date: 2026-04-16
-- ============================================================
-- Logs every INSERT / UPDATE / DELETE on time_entries to the
-- audit_log so we can answer "who logged what time when" and
-- "who edited / deleted this entry" forensically.
--
-- The payload includes BOTH the old and the new project_id /
-- task_id where applicable, so post-hoc debugging can detect
-- silent project_id drift.
--
-- Depends on: 20260416_01_audit_log.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.time_entries_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_payload JSONB;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_payload := jsonb_build_object(
      'time_entry_id', NEW.id,
      'owner_user_id', NEW.user_id,
      'project_id', NEW.project_id,
      'task_id', NEW.task_id,
      'entry_date', NEW.entry_date,
      'hours', NEW.hours
    );
    PERFORM public.write_audit_log_internal(
      COALESCE(v_actor, NEW.user_id),
      'time_entry.created',
      'info',
      'time_entry',
      NEW.id::text,
      v_payload
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_payload := jsonb_build_object(
      'time_entry_id', NEW.id,
      'owner_user_id', NEW.user_id,
      'old', jsonb_build_object(
        'project_id', OLD.project_id,
        'task_id', OLD.task_id,
        'entry_date', OLD.entry_date,
        'hours', OLD.hours
      ),
      'new', jsonb_build_object(
        'project_id', NEW.project_id,
        'task_id', NEW.task_id,
        'entry_date', NEW.entry_date,
        'hours', NEW.hours
      )
    );
    PERFORM public.write_audit_log_internal(
      COALESCE(v_actor, NEW.user_id),
      'time_entry.updated',
      CASE WHEN NEW.project_id IS DISTINCT FROM OLD.project_id
           THEN 'warn' ELSE 'info' END,
      'time_entry',
      NEW.id::text,
      v_payload
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object(
      'time_entry_id', OLD.id,
      'owner_user_id', OLD.user_id,
      'project_id', OLD.project_id,
      'task_id', OLD.task_id,
      'entry_date', OLD.entry_date,
      'hours', OLD.hours
    );
    PERFORM public.write_audit_log_internal(
      COALESCE(v_actor, OLD.user_id),
      'time_entry.deleted',
      'warn',
      'time_entry',
      OLD.id::text,
      v_payload
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS time_entries_audit_trg ON public.time_entries;
CREATE TRIGGER time_entries_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.time_entries_audit();
