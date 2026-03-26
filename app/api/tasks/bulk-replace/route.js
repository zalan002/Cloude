import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = createClient();

    // Verify admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Nincs jogosultság.' }, { status: 403 });
    }

    const { tasks } = await request.json();

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Érvénytelen feladatlista.' }, { status: 400 });
    }

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

    return NextResponse.json({
      success: true,
      deleted,
      archived,
      inserted: tasks.length,
    });
  } catch (err) {
    console.error('Bulk task replace error:', err);
    return NextResponse.json(
      { error: 'Váratlan hiba: ' + err.message },
      { status: 500 }
    );
  }
}
