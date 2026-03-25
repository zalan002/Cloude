import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { syncProjects } from '@/app/api/projects/sync/route';

export const dynamic = 'force-dynamic';

const ERROR_EMAIL = 'CONSORTIO@traininghungary.com';

async function sendErrorEmail(errorMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY nincs beállítva, hiba email nem küldhető.');
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@traininghungary.com',
      to: ERROR_EMAIL,
      subject: 'CONSORTIO - Szinkronizálási hiba',
      html: `
        <h2>Automatikus szinkronizálási hiba</h2>
        <p>Az automatikus MiniCRM szinkronizálás hibát dobott:</p>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px;">${errorMessage}</pre>
        <p>Időpont: ${new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' })}</p>
        <hr>
        <p style="color:#888;font-size:12px;">Ez egy automatikus értesítés a CONSORTIO rendszerből.</p>
      `,
    });
  } catch (emailErr) {
    console.error('Hiba email küldési hiba:', emailErr);
  }
}

// Vercel Cron calls this endpoint
export async function GET(request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key for cron (no user session)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if auto-sync is enabled
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'auto_sync_enabled')
      .single();

    if (setting?.value !== 'true') {
      return NextResponse.json({
        success: true,
        message: 'Auto-sync is disabled. Skipping.',
      });
    }

    const result = await syncProjects(supabase);

    // Update last sync timestamp
    await supabase.from('app_settings').upsert(
      { key: 'last_sync_at', value: new Date().toISOString() },
      { onConflict: 'key' }
    );

    return NextResponse.json({
      ...result,
      triggered_by: 'cron',
    });
  } catch (err) {
    console.error('Cron sync hiba:', err);
    await sendErrorEmail(err.message);
    return NextResponse.json(
      { error: 'Cron szinkronizálási hiba: ' + err.message },
      { status: 500 }
    );
  }
}
