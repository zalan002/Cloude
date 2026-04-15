-- ============================================================
-- CONSORTIO - Data integrity check constraints
-- Date: 2026-04-16
-- ============================================================
-- Adds defensive check constraints so bad data cannot be
-- written via ANY path (UI, API, or direct SQL).
-- All constraints use NOT VALID first then VALIDATE so the
-- migration cannot fail on legacy rows.
-- ============================================================

-- ============================================================
-- time_entries
-- ============================================================
ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_hours_range_chk;
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_hours_range_chk
  CHECK (hours > 0 AND hours <= 24) NOT VALID;

ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_entry_date_sane_chk;
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_entry_date_sane_chk
  CHECK (entry_date >= DATE '2020-01-01'
         AND entry_date <= (CURRENT_DATE + INTERVAL '1 day')) NOT VALID;

ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_description_length_chk;
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_description_length_chk
  CHECK (description IS NULL OR length(description) <= 2000) NOT VALID;

-- Validate constraints (skip silently on legacy rows that
-- might violate them; admin can clean up later).
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.time_entries VALIDATE CONSTRAINT time_entries_hours_range_chk;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Skipping time_entries_hours_range_chk validation: legacy data violates it';
  END;

  BEGIN
    ALTER TABLE public.time_entries VALIDATE CONSTRAINT time_entries_entry_date_sane_chk;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Skipping time_entries_entry_date_sane_chk validation: legacy data violates it';
  END;

  BEGIN
    ALTER TABLE public.time_entries VALIDATE CONSTRAINT time_entries_description_length_chk;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Skipping time_entries_description_length_chk validation: legacy data violates it';
  END;
END $$;

-- ============================================================
-- minicrm_projects
-- ============================================================
ALTER TABLE public.minicrm_projects
  DROP CONSTRAINT IF EXISTS minicrm_projects_name_present_chk;
ALTER TABLE public.minicrm_projects
  ADD CONSTRAINT minicrm_projects_name_present_chk
  CHECK (length(trim(name)) > 0 AND length(name) <= 500) NOT VALID;

ALTER TABLE public.minicrm_projects
  DROP CONSTRAINT IF EXISTS minicrm_projects_source_known_chk;
ALTER TABLE public.minicrm_projects
  ADD CONSTRAINT minicrm_projects_source_known_chk
  CHECK (source IS NULL OR source IN
    ('minicrm_sales', 'minicrm_partner', 'manual', 'legacy')) NOT VALID;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.minicrm_projects VALIDATE CONSTRAINT minicrm_projects_name_present_chk;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Skipping minicrm_projects_name_present_chk validation: legacy data violates it';
  END;

  BEGIN
    ALTER TABLE public.minicrm_projects VALIDATE CONSTRAINT minicrm_projects_source_known_chk;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Skipping minicrm_projects_source_known_chk validation: legacy data violates it';
  END;
END $$;

-- ============================================================
-- tasks
-- ============================================================
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_name_present_chk;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_name_present_chk
  CHECK (length(trim(name)) > 0 AND length(name) <= 500) NOT VALID;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.tasks VALIDATE CONSTRAINT tasks_name_present_chk;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Skipping tasks_name_present_chk validation: legacy data violates it';
  END;
END $$;
