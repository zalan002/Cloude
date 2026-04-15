import { NextResponse } from 'next/server';
import { requireUser, createServiceRoleClient } from '@/lib/supabase/server';
import { verifySameOrigin } from '@/lib/security';
import { asUuid, asString, ValidationError } from '@/lib/validation';
import { logServerAudit } from '@/lib/audit.server';

const ALLOWED_DEPARTMENTS = [
  'Értékesítés',
  'Jog',
  'Asszisztencia',
  'Könyvelés',
  'Munkaügy',
];

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

  let userId;
  let department;
  try {
    userId = asUuid(body.userId, 'userId');
    if (body.department === '' || body.department === null || body.department === undefined) {
      department = null;
    } else {
      const d = asString(body.department, 'department', { max: 100 });
      if (!ALLOWED_DEPARTMENTS.includes(d)) {
        return NextResponse.json({ error: 'Ismeretlen részleg.' }, { status: 400 });
      }
      department = d;
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('profiles')
    .update({ department })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    eventType: 'admin.user.department_updated',
    severity: 'info',
    entityType: 'profile',
    entityId: userId,
    payload: { target_user_id: userId, new_department: department },
    request,
  });

  return NextResponse.json({ success: true });
}
