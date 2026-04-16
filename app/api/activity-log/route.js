import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_type, target_table, target_id, details } = body;

    if (!event_type) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
    }

    const { error } = await supabase.from('activity_logs').insert({
      event_type,
      user_id: user.id,
      user_email: user.email,
      target_table: target_table || null,
      target_id: target_id || null,
      details: details || {},
    });

    if (error) {
      console.error('Activity log insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Activity log error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
