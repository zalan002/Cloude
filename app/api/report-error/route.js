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

    const userName = user?.email || 'Ismeretlen felhasználó';

    await sendErrorAlert({
      subject: `Hiba: ${action}`,
      message: `<strong>Felhasználó:</strong> ${userName}<br><strong>Oldal:</strong> ${page}<br><strong>Művelet:</strong> ${action}`,
      context: error,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error report hiba:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
