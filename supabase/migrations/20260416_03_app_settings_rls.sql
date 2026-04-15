-- ============================================================
-- CONSORTIO - app_settings RLS
-- Date: 2026-04-16
-- ============================================================
-- Restricts public.app_settings so that:
--   * Any authenticated user can read settings (some pages need
--     to know e.g. last_sync_at).
--   * Only admins can INSERT / UPDATE / DELETE.
--   * The service role still bypasses RLS (used by API routes).
--
-- Depends on: 20260416_02_profiles_rls.sql (current_user_is_admin)
-- ============================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated can write settings" ON public.app_settings;

-- SELECT: any authenticated user
CREATE POLICY "Authenticated can read settings"
  ON public.app_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE: only admins
CREATE POLICY "Admins can manage settings"
  ON public.app_settings
  FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
