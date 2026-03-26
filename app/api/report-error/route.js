import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendErrorAlert } from '@/lib/email';

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

    const body = await request.json();
    const { page, action, error } = body;

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const userName = esc(user?.email || 'Ismeretlen felhasználó');

    await sendErrorAlert({
      subject: `Hiba: ${esc(action)}`,
      message: `<strong>Felhasználó:</strong> ${userName}<br><strong>Oldal:</strong> ${esc(page)}<br><strong>Művelet:</strong> ${esc(action)}`,
      context: esc(error),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error report hiba:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
