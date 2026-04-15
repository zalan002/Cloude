import { createClient } from '@/lib/supabase/client';

/**
 * Client-side audit logger. Calls the write_audit_log RPC,
 * which runs SECURITY DEFINER under the caller's auth context.
 *
 * NEVER pass passwords, tokens or other secrets in `payload`.
 * Best-effort: failures are swallowed so they cannot break UX.
 */
export async function logClientAudit({
  eventType,
  severity = 'info',
  entityType = null,
  entityId = null,
  payload = {},
}) {
  if (!eventType) return;
  try {
    const supabase = createClient();
    await supabase.rpc('write_audit_log', {
      p_event_type: String(eventType).slice(0, 64),
      p_severity: ['info', 'warn', 'error', 'critical'].includes(severity)
        ? severity
        : 'info',
      p_entity_type: entityType,
      p_entity_id: entityId ? String(entityId).slice(0, 128) : null,
      p_payload: payload || {},
    });
  } catch {
    // swallow
  }
}
