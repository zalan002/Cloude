import { requireUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { verifySameOrigin } from '@/lib/security';
import { logServerAudit } from '@/lib/audit.server';
import { asString } from '@/lib/validation';

export async function POST(request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden origin.' }, { status: 403 });
    }

    let session;
    try {
      session = await requireUser({ admin: true });
    } catch (resp) {
      return resp;
    }
    const supabase = session.supabase;

    const body = await request.json();
    const tasksRaw = body?.tasks;

    if (!Array.isArray(tasksRaw) || tasksRaw.length === 0 || tasksRaw.length > 1000) {
      return NextResponse.json({ error: 'Érvénytelen feladatlista.' }, { status: 400 });
    }

    // Validate each task entry
    const tasks = tasksRaw.map((t, i) => {
      const name = asString(t?.name, `tasks[${i}].name`, { max: 500 });
      const out = { name, status: 'active' };
      if (t?.category) out.category = asString(t.category, `tasks[${i}].category`, { max: 100 });
      return out;
    });

    // Get all existing tasks
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id');

    const existingIds = (existingTasks || []).map((t) => t.id);

    // Check which tasks are referenced by time entries
    let referencedIds = [];
    if (existingIds.length > 0) {
      const { data: usedTasks } = await supabase
        .from('time_entries')
        .select('task_id')
        .in('task_id', existingIds);

      referencedIds = [...new Set((usedTasks || []).map((e) => e.task_id))];
    }

    const deletableIds = existingIds.filter((id) => !referencedIds.includes(id));

    // Archive referenced tasks (can't delete due to FK)
    let archived = 0;
    if (referencedIds.length > 0) {
      await supabase
        .from('tasks')
        .update({ status: 'archived' })
        .in('id', referencedIds);
      archived = referencedIds.length;
    }

    // Delete unreferenced tasks
    let deleted = 0;
    if (deletableIds.length > 0) {
      await supabase
        .from('tasks')
        .delete()
        .in('id', deletableIds);
      deleted = deletableIds.length;
    }

    // Insert new tasks
    const { error: insertError } = await supabase
      .from('tasks')
      .insert(tasks);

    if (insertError) {
      return NextResponse.json(
        { error: 'Hiba a feladatok beszúrásakor: ' + insertError.message },
        { status: 500 }
      );
    }

    await logServerAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      eventType: 'admin.tasks.bulk_replaced',
      severity: 'warn',
      entityType: 'task',
      payload: { deleted, archived, inserted: tasks.length },
      request,
    });

    return NextResponse.json({
      success: true,
      deleted,
      archived,
      inserted: tasks.length,
    });
  } catch (err) {
    if (err?.name === 'ValidationError') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Bulk task replace error:', err);
    return NextResponse.json(
      { error: 'Váratlan hiba: ' + err.message },
      { status: 500 }
    );
  }
}
