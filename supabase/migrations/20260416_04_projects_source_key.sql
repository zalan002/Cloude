-- ============================================================
-- CONSORTIO - minicrm_projects stable identity (source_key)
-- Date: 2026-04-16
-- ============================================================
-- BACKGROUND
--   The current sync uses ON CONFLICT (minicrm_id) where
--   minicrm_id is computed from a numeric source_id when
--   available, falling back to a hash of the name. Two real
--   problems:
--     1. The same numeric source_id can appear in BOTH the
--        sales CSV and the partners CSV (independent ID
--        spaces), so they collide and the partner row
--        OVERWRITES the sales row in place. Time entries
--        already linked to the original row now silently
--        point at a completely different project.
--     2. Hash-collision resolution is non-deterministic
--        across runs (minicrm_id++ in JS), so even rows that
--        wouldn't conflict can drift on subsequent syncs.
--
-- FIX
--   Introduce source_key TEXT UNIQUE that encodes WHERE the
--   row came from, e.g.
--     'minicrm_sales:<source_id>'
--     'minicrm_partner:<source_id>'
--     'manual:<minicrm_id>'
--   Use source_key as the upsert conflict target. Hard-block
--   any UPDATE that mutates source_key or source via a
--   trigger (with audit log entry for blocked attempts).
--
-- Depends on: 20260416_01_audit_log.sql
-- ============================================================

-- Make sure the columns we rely on exist (defensive — sync
-- route already writes them, but older deployments may not
-- have them defined explicitly).
ALTER TABLE public.minicrm_projects
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.minicrm_projects
  ADD COLUMN IF NOT EXISTS source_key TEXT;

-- Backfill source_key for existing rows. We never overwrite
-- a non-null source_key, only fill in NULLs.
UPDATE public.minicrm_projects
SET source_key = CASE
  WHEN source IN ('minicrm_sales', 'minicrm_partner')
       AND raw_data ? 'Id' THEN
    source || ':' || (raw_data->>'Id')
  WHEN source IN ('minicrm_sales', 'minicrm_partner')
       AND raw_data ? 'id' THEN
    source || ':' || (raw_data->>'id')
  WHEN source IN ('minicrm_sales', 'minicrm_partner') THEN
    -- No usable source_id in raw_data — fall back to the
    -- numeric minicrm_id so we still get a stable, unique key.
    source || ':mid_' || minicrm_id::text
  WHEN source = 'manual' OR category_name = 'Manuális' THEN
    'manual:mid_' || minicrm_id::text
  ELSE
    'legacy:mid_' || minicrm_id::text
END
WHERE source_key IS NULL;

-- If two rows ended up with the same backfilled source_key
-- (shouldn't happen given minicrm_id is unique, but be safe),
-- disambiguate by appending the row id.
WITH dups AS (
  SELECT id, source_key,
         ROW_NUMBER() OVER (PARTITION BY source_key ORDER BY id) AS rn
  FROM public.minicrm_projects
)
UPDATE public.minicrm_projects p
SET source_key = p.source_key || '#' || p.id::text
FROM dups
WHERE dups.id = p.id AND dups.rn > 1;

-- Make source_key authoritative.
ALTER TABLE public.minicrm_projects
  ALTER COLUMN source_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS minicrm_projects_source_key_uniq
  ON public.minicrm_projects (source_key);

-- ============================================================
-- Identity guard trigger
-- ============================================================
-- Any UPDATE that tries to change source_key (or downgrade
-- source) is blocked and audit-logged. This is the safety net
-- that guarantees a row's identity never silently changes,
-- even if a future code path passes the wrong upsert target.
CREATE OR REPLACE FUNCTION public.minicrm_projects_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_key IS DISTINCT FROM OLD.source_key THEN
    PERFORM public.write_audit_log_internal(
      auth.uid(),
      'project.identity_change_blocked',
      'critical',
      'minicrm_project',
      OLD.id::text,
      jsonb_build_object(
        'old_source_key', OLD.source_key,
        'new_source_key', NEW.source_key,
        'old_name', OLD.name,
        'new_name', NEW.name
      )
    );
    RAISE EXCEPTION 'minicrm_projects.source_key is immutable (row id %)', OLD.id;
  END IF;

  IF NEW.source IS DISTINCT FROM OLD.source THEN
    PERFORM public.write_audit_log_internal(
      auth.uid(),
      'project.source_change_blocked',
      'critical',
      'minicrm_project',
      OLD.id::text,
      jsonb_build_object(
        'old_source', OLD.source,
        'new_source', NEW.source
      )
    );
    RAISE EXCEPTION 'minicrm_projects.source is immutable (row id %)', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS minicrm_projects_identity_guard_trg ON public.minicrm_projects;
CREATE TRIGGER minicrm_projects_identity_guard_trg
  BEFORE UPDATE ON public.minicrm_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.minicrm_projects_identity_guard();
