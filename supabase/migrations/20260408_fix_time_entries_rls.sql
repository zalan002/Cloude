-- ============================================================
-- CONSORTIO - Time Entries RLS Policy Fix
-- Date: 2026-04-08
-- ============================================================
-- PROBLEM: Users can insert time entries with ANY user_id,
-- and delete ANY entry, because RLS policies are missing
-- or incomplete on the time_entries table.
--
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. Ensure RLS is enabled on time_entries
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any) to recreate clean ones
DROP POLICY IF EXISTS "Users can view own entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can insert own entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can update own entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can delete own entries" ON public.time_entries;
DROP POLICY IF EXISTS "Admins can view all entries" ON public.time_entries;
DROP POLICY IF EXISTS "Service role full access" ON public.time_entries;

-- 3. SELECT: Users can only read their own entries
CREATE POLICY "Users can view own entries"
  ON public.time_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. INSERT: Users can only insert entries with their own user_id
--    This is the CRITICAL fix - prevents inserting as another user
CREATE POLICY "Users can insert own entries"
  ON public.time_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. UPDATE: Users can only update their own entries
CREATE POLICY "Users can update own entries"
  ON public.time_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. DELETE: Users can only delete their own entries
CREATE POLICY "Users can delete own entries"
  ON public.time_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Admins can view ALL entries (for reports)
CREATE POLICY "Admins can view all entries"
  ON public.time_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- Also ensure RLS on tasks and minicrm_projects tables
-- so that users can read them but only admins can manage them
-- ============================================================

-- Tasks table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can manage tasks" ON public.tasks;

CREATE POLICY "Anyone can view active tasks"
  ON public.tasks
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage tasks"
  ON public.tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Projects table
ALTER TABLE public.minicrm_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view projects" ON public.minicrm_projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.minicrm_projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON public.minicrm_projects;

CREATE POLICY "Anyone can view projects"
  ON public.minicrm_projects
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert projects"
  ON public.minicrm_projects
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage projects"
  ON public.minicrm_projects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
