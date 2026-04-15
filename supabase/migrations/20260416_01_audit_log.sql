-- ============================================================
-- CONSORTIO - Audit log infrastructure
-- Date: 2026-04-16
-- ============================================================
-- Creates an append-only audit_log table and a SECURITY DEFINER
-- RPC (write_audit_log) for client-side logging. A second internal
-- function (write_audit_log_internal) is used by other SECURITY
-- DEFINER functions (e.g. triggers) to write entries on behalf of
-- a specific user_id without an auth session.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error','critical')),
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  request_id UUID,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_created_idx ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON public.audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_severity_idx
  ON public.audit_log (severity, created_at DESC)
  WHERE severity IN ('warn','error','critical');
CREATE INDEX IF NOT EXISTS audit_log_payload_gin_idx ON public.audit_log USING GIN (payload);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit log.
DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- No INSERT/UPDATE/DELETE policies — writes flow through the RPC
-- (SECURITY DEFINER) or directly via the service role.

-- Block UPDATE even from the service role to guarantee append-only.
CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();

-- ============================================================
-- Client-facing RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'info',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_email TEXT;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_event_type IS NULL OR length(p_event_type) = 0 THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  IF p_severity NOT IN ('info','warn','error','critical') THEN
    p_severity := 'info';
  END IF;

  IF length(p_event_type) > 64 THEN
    p_event_type := substring(p_event_type for 64);
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.audit_log (user_id, user_email, event_type, severity, entity_type, entity_id, payload)
  VALUES (v_uid, v_email, p_event_type, p_severity, p_entity_type, p_entity_id, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================================
-- Internal helper used from other SECURITY DEFINER functions
-- (e.g. trigger-based auditing on profiles/time_entries).
-- Not granted to end users.
-- ============================================================
CREATE OR REPLACE FUNCTION public.write_audit_log_internal(
  p_user_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_payload JSONB
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_email TEXT;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  END IF;

  INSERT INTO public.audit_log (user_id, user_email, event_type, severity, entity_type, entity_id, payload)
  VALUES (
    p_user_id,
    v_email,
    COALESCE(p_event_type, 'unknown'),
    COALESCE(p_severity, 'info'),
    p_entity_type,
    p_entity_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log_internal(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
