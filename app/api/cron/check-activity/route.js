import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendInactivityAlert } from '@/lib/email';

export const dynamic = 'force-dynamic';

const INACTIVITY_DAYS = 3;

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY szükséges az aktivitás ellenőrzéshez.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check the most recent time entry as activity indicator
    const threeDaysAgo = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentEntries, error } = await supabase
      .from('time_entries')
      .select('id')
      .gte('created_at', threeDaysAgo)
      .limit(1);

    if (error) {
      console.error('Aktivitás ellenőrzési hiba:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!recentEntries || recentEntries.length === 0) {
      // No activity in the last 3 days - also check auth users
      const { data: authData } = await supabase.auth.admin.listUsers();

      const lastLoginDates = (authData?.users || [])
        .map((u) => u.last_sign_in_at)
        .filter(Boolean)
        .sort()
        .reverse();

      const lastLogin = lastLoginDates[0];
      let daysSince = INACTIVITY_DAYS;

      if (lastLogin) {
        daysSince = Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24));
      }

      if (daysSince >= INACTIVITY_DAYS) {
        await sendInactivityAlert(daysSince);
        return NextResponse.json({
          alert_sent: true,
          days_since_last_activity: daysSince,
          last_login: lastLogin || 'Nincs adat',
        });
      }
    }

    return NextResponse.json({
      alert_sent: false,
      message: 'Rendszeres aktivitás észlelve.',
    });
  } catch (err) {
    console.error('Activity check hiba:', err);
    return NextResponse.json(
      { error: 'Aktivitás ellenőrzési hiba: ' + err.message },
      { status: 500 }
    );
  }
}
