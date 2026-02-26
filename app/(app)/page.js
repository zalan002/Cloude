import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Today's entries
  const { data: todayEntries } = await supabase
    .from('time_entries')
    .select('*, minicrm_projects(name)')
    .eq('user_id', user.id)
    .eq('entry_date', today)
    .order('created_at', { ascending: false });

  // Weekly total
  const { data: weekEntries } = await supabase
    .from('time_entries')
    .select('hours')
    .eq('user_id', user.id)
    .gte('entry_date', weekAgo)
    .lte('entry_date', today);

  // Active projects this week
  const { data: weekProjects } = await supabase
    .from('time_entries')
    .select('project_id')
    .eq('user_id', user.id)
    .gte('entry_date', weekAgo)
    .lte('entry_date', today);

  // All active projects
  const { data: activeProjects } = await supabase
    .from('minicrm_projects')
    .select('*')
    .eq('status', 'active')
    .order('name');

  const todayHours = (todayEntries || []).reduce(
    (sum, e) => sum + Number(e.hours),
    0
  );
  const weeklyHours = (weekEntries || []).reduce(
    (sum, e) => sum + Number(e.hours),
    0
  );
  const uniqueProjects = new Set(
    (weekProjects || []).map((e) => e.project_id)
  ).size;

  const firstName = profile?.full_name?.split(' ')[0] || 'Felhasználó';
  const todayFormatted = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-montserrat font-bold text-deep-blue">
          Üdv, {firstName}!
        </h1>
        <p className="text-mid-gray mt-1 capitalize">{todayFormatted}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-mid-gray font-opensans mb-1">Mai órák</p>
              <p className="stat-number text-gold">{todayHours.toFixed(1)}</p>
            </div>
            <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-mid-gray font-opensans mb-1">Heti összesen</p>
              <p className="stat-number text-medium-blue">{weeklyHours.toFixed(1)}</p>
            </div>
            <div className="w-12 h-12 bg-medium-blue/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-medium-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-mid-gray font-opensans mb-1">Aktív projektek</p>
              <p className="stat-number text-deep-blue">{uniqueProjects}</p>
            </div>
            <div className="w-12 h-12 bg-deep-blue/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-deep-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick entry block */}
      {activeProjects && activeProjects.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-lg font-montserrat font-semibold text-deep-blue mb-4">
            Gyors bejegyzés
          </h2>
          <div className="flex flex-wrap gap-2">
            {activeProjects.map((project) => (
              <Link
                key={project.id}
                href={`/time-entry?project=${project.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-opensans text-dark-text hover:border-medium-blue hover:text-medium-blue hover:shadow-sm transition-all duration-200"
              >
                <svg className="w-4 h-4 text-medium-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {project.name}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card mb-8 text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <p className="text-mid-gray mb-4">Még nincsenek projektek szinkronizálva.</p>
          {profile?.role === 'admin' && (
            <Link href="/admin/sync" className="btn-primary inline-block">
              Szinkronizálás a MiniCRM-ből
            </Link>
          )}
        </div>
      )}

      {/* Today's entries */}
      <div>
        <h2 className="text-lg font-montserrat font-semibold text-deep-blue mb-4">
          Mai bejegyzések
        </h2>
        {todayEntries && todayEntries.length > 0 ? (
          <div className="space-y-3">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="card flex items-center justify-between !p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-montserrat font-semibold text-dark-text text-sm">
                    {entry.minicrm_projects?.name || 'Ismeretlen projekt'}
                  </p>
                  {entry.description && (
                    <p className="text-sm text-mid-gray mt-0.5 truncate">
                      {entry.description}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <span className="font-montserrat font-bold text-medium-blue text-lg">
                    {Number(entry.hours).toFixed(1)}
                  </span>
                  <span className="text-sm text-mid-gray ml-1">óra</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-8">
            <p className="text-mid-gray mb-3">Ma még nincs bejegyzésed.</p>
            <Link href="/time-entry" className="btn-primary inline-block text-sm">
              Új bejegyzés rögzítése
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
