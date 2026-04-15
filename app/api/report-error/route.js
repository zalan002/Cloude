import { NextResponse } from 'next/server';
import { sendErrorAlert } from '@/lib/email';
import { requireUser } from '@/lib/supabase/server';
import { verifySameOrigin } from '@/lib/security';
import { checkRate, getClientIp } from '@/lib/rateLimit';
import { logServerAudit } from '@/lib/audit.server';

export async function POST(request) {
  // 1. Same-origin check (CSRF defense).
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden origin.' }, { status: 403 });
  }

  // 2. Auth required — anonymous users cannot trigger emails.
  let session;
  try {
    session = await requireUser();
  } catch (resp) {
    return resp;
  }

  // 3. Rate limit per user: at most 10 reports / 5 minutes.
  const rate = checkRate({
    key: `report-error:${session.user.id}`,
    limit: 10,
    windowMs: 5 * 60 * 1000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Túl sok hibajelentés egy időszak alatt.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Defensive truncation — values become email content.
  const trim = (s, n) => (s == null ? '' : String(s).slice(0, n));
  const page = trim(body.page, 200);
  const action = trim(body.action, 200);
  const error = trim(body.error, 4000);

  await sendErrorAlert({
    subject: `Hiba: ${action}`,
    message: `Felhasználó: ${session.user.email}\nOldal: ${page}\nMűvelet: ${action}`,
    context: error,
  });

  await logServerAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    eventType: 'client.error_reported',
    severity: 'warn',
    entityType: 'client_error',
    entityId: null,
    payload: { page, action, error_excerpt: error.slice(0, 500) },
    request,
  });

  return NextResponse.json({ success: true });
}
