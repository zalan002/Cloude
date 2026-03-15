import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { syncProjects } from '@/app/api/projects/sync/route';

// Vercel Cron calls this endpoint
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/sync-projects", "schedule": "0 6 * * *" }] }
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
    return NextResponse.json(
      { error: 'Cron szinkronizálási hiba: ' + err.message },
      { status: 500 }
    );
  }
}
