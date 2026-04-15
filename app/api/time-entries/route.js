import { NextResponse } from 'next/server';
import { requireUser, createServiceRoleClient } from '@/lib/supabase/server';
import { verifySameOrigin } from '@/lib/security';
import {
  asPositiveInt,
  asNumberInRange,
  asIsoDate,
  asString,
  ValidationError,
} from '@/lib/validation';
import { logServerAudit } from '@/lib/audit.server';
import { checkRate } from '@/lib/rateLimit';

/**
 * Create a time entry. The client passes BOTH the project_id
 * (numeric primary key) AND the project_source_key (stable
 * identity from the sync). The server requires the two to
 * match before inserting, so even if the project row's data
 * was overwritten in place between the page-load and the save,
 * we refuse to attach the entry to the wrong project.
 *
 * Body shape:
 *   {
 *     project_id: number,
 *     project_source_key: string,
 *     task_id: number | null,
 *     entry_date: 'YYYY-MM-DD',
 *     hours: number,
 *     description?: string
 *   }
 */
export async function POST(request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden origin.' }, { status: 403 });
  }

  let session;
  try {
    session = await requireUser();
  } catch (resp) {
    return resp;
  }

  // Per-user rate limit: ~120 entries / hour is plenty.
  const rate = checkRate({
    key: `time-entry-create:${session.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Túl sok bejegyzés egy órán belül.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let projectId, sourceKey, taskId, entryDate, hours, description;
  try {
    projectId = asPositiveInt(body.project_id, 'project_id');
    sourceKey = asString(body.project_source_key, 'project_source_key', { max: 256 });
    taskId =
      body.task_id == null || body.task_id === ''
        ? null
        : asPositiveInt(body.task_id, 'task_id');
    entryDate = asIsoDate(body.entry_date, 'entry_date');
    hours = asNumberInRange(body.hours, 'hours', { min: 0.0167, max: 24 });
    description =
      body.description == null || body.description === ''
        ? null
        : asString(body.description, 'description', { max: 2000, allowEmpty: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
    }
    throw err;
  }

  // Resolve the project row by primary key AND verify its
  // source_key still matches what the UI saw. If the row was
  // overwritten by a sync between page-load and submit, this
  // mismatch will reject the insert instead of attaching the
  // entry to the wrong project.
  const supabase = session.supabase;
  const { data: project, error: projErr } = await supabase
    .from('minicrm_projects')
    .select('id, name, source_key, status')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr) {
    return NextResponse.json({ error: projErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json(
      { error: 'A kiválasztott projekt már nem létezik. Kérjük, válassz újat.' },
      { status: 409 }
    );
  }
  if (project.source_key !== sourceKey) {
    await logServerAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      eventType: 'time_entry.project_mismatch_blocked',
      severity: 'critical',
      entityType: 'minicrm_project',
      entityId: String(projectId),
      payload: {
        expected_source_key: sourceKey,
        actual_source_key: project.source_key,
        project_name: project.name,
      },
      request,
    });
    return NextResponse.json(
      {
        error:
          'A projekt időközben megváltozott. Kérjük, töltsd újra az oldalt és válaszd ki ismét.',
      },
      { status: 409 }
    );
  }
  if (project.status && project.status !== 'active') {
    return NextResponse.json(
      { error: 'A projekt már nem aktív.' },
      { status: 409 }
    );
  }

  // Optional: verify task exists if provided.
  if (taskId != null) {
    const { data: task } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('id', taskId)
      .maybeSingle();
    if (!task || (task.status && task.status !== 'active')) {
      return NextResponse.json({ error: 'A feladat nem érvényes.' }, { status: 409 });
    }
  }

  // Insert via the user's own RLS context — RLS guarantees the
  // user_id will be themselves, the time_entries audit trigger
  // captures the event, and the project is now verified.
  const insertData = {
    user_id: session.user.id,
    project_id: projectId,
    task_id: taskId,
    entry_date: entryDate,
    hours,
    description: description ? description.trim() : null,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('time_entries')
    .insert(insertData)
    .select('id')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: inserted.id });
}
