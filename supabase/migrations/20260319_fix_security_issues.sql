-- ============================================================
-- CONSORTIO Supabase Security Fixes
-- Date: 2026-03-19
-- ============================================================
-- This migration fixes all Supabase Lint errors and warnings.
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ============================================================
-- ERROR 1 & 2: Fix SECURITY DEFINER views
-- Change to SECURITY INVOKER so RLS policies of the
-- querying user are enforced (not the view creator's).
-- ============================================================

-- Fix monthly_summary view
ALTER VIEW public.monthly_summary SET (security_invoker = on);

-- Fix project_summary view
ALTER VIEW public.project_summary SET (security_invoker = on);


-- ============================================================
-- WARNING 1: Fix handle_new_user search_path
-- Set an immutable search_path to prevent search_path hijacking.
-- ============================================================

-- First, get the current function definition and recreate with fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'employee',
    'active'
  );
  RETURN NEW;
END;
$$;


-- ============================================================
-- WARNING 2: Fix update_updated_at search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================
-- WARNING 3: Leaked password protection
-- This CANNOT be fixed via SQL. You must enable it manually:
--
-- 1. Go to Supabase Dashboard
-- 2. Navigate to: Authentication > Providers > Email
-- 3. Enable "Leaked password protection"
-- 4. Save
-- ============================================================
