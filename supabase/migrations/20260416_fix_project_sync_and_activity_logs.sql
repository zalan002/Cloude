-- ============================================================
-- CONSORTIO - Project Sync Fix + Activity Logging
-- Date: 2026-04-16
-- ============================================================
-- 1. Add snapshot columns to time_entries (preserves what user selected)
-- 2. Create activity_logs table for full audit trail
-- 3. Create trigger for automatic time_entry audit logging
--
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ============================================================
-- PART 1: Snapshot columns on time_entries
-- ============================================================
-- These columns capture the project/task name at the moment
-- the time entry was created. This prevents historical entries
-- from showing wrong names if a sync changes project data.

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS project_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS task_name_snapshot TEXT;


-- ============================================================
-- PART 2: Activity Logs table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  target_table TEXT,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON public.activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);

-- RLS: append-only log, admins can read, authenticated users can insert
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
CREATE POLICY "Admins can view all logs"
  ON public.activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- PART 3: Database trigger for time_entries audit
-- ============================================================
-- Fires AFTER INSERT or DELETE on time_entries.
-- Captures denormalized project name, task name, and user email
-- so the log remains accurate even if project data changes later.

CREATE OR REPLACE FUNCTION public.log_time_entry_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_name TEXT;
  v_task_name TEXT;
  v_user_email TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_project_name FROM minicrm_projects WHERE id = NEW.project_id;
    SELECT name INTO v_task_name FROM tasks WHERE id = NEW.task_id;
    SELECT email INTO v_user_email FROM profiles WHERE id = NEW.user_id;

    INSERT INTO activity_logs (event_type, user_id, user_email, target_table, target_id, details)
    VALUES (
      'time_entry.created',
      NEW.user_id,
      v_user_email,
      'time_entries',
      NEW.id::TEXT,
      jsonb_build_object(
        'project_id', NEW.project_id,
        'project_name', COALESCE(NEW.project_name_snapshot, v_project_name),
        'task_id', NEW.task_id,
        'task_name', COALESCE(NEW.task_name_snapshot, v_task_name),
        'hours', NEW.hours,
        'entry_date', NEW.entry_date,
        'description', NEW.description
      )
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT name INTO v_project_name FROM minicrm_projects WHERE id = OLD.project_id;
    SELECT name INTO v_task_name FROM tasks WHERE id = OLD.task_id;
    SELECT email INTO v_user_email FROM profiles WHERE id = OLD.user_id;

    INSERT INTO activity_logs (event_type, user_id, user_email, target_table, target_id, details)
    VALUES (
      'time_entry.deleted',
      OLD.user_id,
      v_user_email,
      'time_entries',
      OLD.id::TEXT,
      jsonb_build_object(
        'project_id', OLD.project_id,
        'project_name', COALESCE(OLD.project_name_snapshot, v_project_name),
        'task_id', OLD.task_id,
        'task_name', COALESCE(OLD.task_name_snapshot, v_task_name),
        'hours', OLD.hours,
        'entry_date', OLD.entry_date,
        'description', OLD.description
      )
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop existing trigger if present (idempotent)
DROP TRIGGER IF EXISTS trg_time_entry_audit ON public.time_entries;

CREATE TRIGGER trg_time_entry_audit
  AFTER INSERT OR DELETE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.log_time_entry_changes();
