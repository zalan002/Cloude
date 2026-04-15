import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Server-side audit logger. Writes directly to public.audit_log
 * via the service-role key so that:
 *   1. Failures here NEVER block the calling request from
 *      finishing — auditing is best-effort, the action itself
 *      is the source of truth.
 *   2. The caller can pass an explicit user_id (the actor),
 *      which the DB-level RPC requires anyway.
 *
 * Usage:
 *   await logServerAudit({
 *     userId,
 *     eventType: 'time_entry.created',
 *     severity: 'info',
 *     entityType: 'time_entry',
 *     entityId: String(entryId),
 *     payload: { project_id, hours },
 *     request,   // optional NextRequest, used to capture IP/UA
 *   });
 */
export async function logServerAudit({
  userId = null,
  userEmail = null,
  eventType,
  severity = 'info',
  entityType = null,
  entityId = null,
  payload = {},
  request = null,
}) {
  if (!eventType) return;

  try {
    const supabase = createServiceRoleClient();

    let ip = null;
    let userAgent = null;
    if (request && typeof request.headers?.get === 'function') {
      ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null;
      userAgent = request.headers.get('user-agent') || null;
    }

    await supabase.from('audit_log').insert({
      user_id: userId,
      user_email: userEmail,
      event_type: String(eventType).slice(0, 64),
      severity: ['info', 'warn', 'error', 'critical'].includes(severity)
        ? severity
        : 'info',
      entity_type: entityType,
      entity_id: entityId ? String(entityId).slice(0, 128) : null,
      payload: payload || {},
      ip_address: ip,
      user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    });
  } catch (err) {
    // Never throw from audit. We log to console as a last resort.
    // eslint-disable-next-line no-console
    console.error('audit_log write failed', err?.message || err);
  }
}
