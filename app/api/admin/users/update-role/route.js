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

  let userId, role;
  try {
    userId = asUuid(body.userId, 'userId');
    role = asEnum(body.role, 'role', ['admin', 'employee']);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Defense in depth: never let an admin demote themselves to
  // employee — keeps at least one admin available on the rare
  // self-update case. (Other admins can still demote them.)
  if (userId === session.user.id && role !== 'admin') {
    return NextResponse.json(
      { error: 'Saját admin szerepkör nem vehető el.' },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    eventType: 'admin.user.role_updated',
    severity: 'warn',
    entityType: 'profile',
    entityId: userId,
    payload: { target_user_id: userId, new_role: role },
    request,
  });

  return NextResponse.json({ success: true });
}
