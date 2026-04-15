import { NextResponse } from 'next/server';
import { requireUser, createServiceRoleClient } from '@/lib/supabase/server';
import { verifySameOrigin } from '@/lib/security';
import { asUuid, asEnum, ValidationError } from '@/lib/validation';
import { logServerAudit } from '@/lib/audit.server';

export async function POST(request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden origin.' }, { status: 403 });
  }

  let session;
  try {
    session = await requireUser({ admin: true });
  } catch (resp) {
    return resp;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let userId, status;
  try {
    userId = asUuid(body.userId, 'userId');
    status = asEnum(body.status, 'status', ['active', 'inactive']);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  if (userId === session.user.id && status !== 'active') {
    return NextResponse.json(
      { error: 'Saját fiókot nem deaktiválhatsz.' },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();
  // Try the modern `status` column first. If the deployment
  // still uses the legacy boolean `is_active`, fall back to it.
  const updates = { status, is_active: status === 'active' };
  let { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error && /column .* does not exist/i.test(error.message)) {
    // Drop whichever column doesn't exist and retry
    const { error: e2 } = await admin
      .from('profiles')
      .update({ status })
      .eq('id', userId);
    error = e2;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    eventType: 'admin.user.status_updated',
    severity: 'warn',
    entityType: 'profile',
    entityId: userId,
    payload: { target_user_id: userId, new_status: status },
    request,
  });

  return NextResponse.json({ success: true });
}
