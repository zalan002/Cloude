'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { reportError } from '@/lib/reportError';

const SYNC_SCHEDULES = [
  { value: '0 5 * * *', label: '05:00' },
  { value: '0 6 * * *', label: '06:00' },
  { value: '0 7 * * *', label: '07:00' },
  { value: '0 8 * * *', label: '08:00' },
  { value: '0 12 * * *', label: '12:00' },
  { value: '0 18 * * *', label: '18:00' },
  { value: '0 22 * * *', label: '22:00' },
];

export default function AdminSyncPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [projects, setProjects] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [expandedProject, setExpandedProject] = useState(null);

  // Schedule settings
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncSchedule, setSyncSchedule] = useState('0 6 * * *');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data?.role !== 'admin') {
        router.push('/');
        return;
      }

      setProfile(data);
      setLoading(false);
    }
    init();
  }, []);

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from('minicrm_projects')
      .select('*')
      .order('name');
    setProjects(data || []);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['auto_sync_enabled', 'sync_schedule', 'last_sync_at']);

    if (data) {
      data.forEach((s) => {
        if (s.key === 'auto_sync_enabled') setAutoSyncEnabled(s.value === 'true');
        if (s.key === 'sync_schedule') setSyncSchedule(s.value || '0 6 * * *');
        if (s.key === 'last_sync_at') setLastSyncAt(s.value);
      });
    }
  }, []);

  useEffect(() => {
    if (profile) {
      loadProjects();
      loadSettings();
    }
  }, [profile, loadProjects, loadSettings]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/projects/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: 'A szinkronizálás sikertelen. Kérjük, vegye fel a kapcsolatot: CONSORTIO@traininghungary.com' });
        reportError({ page: 'Szinkronizálás', action: 'Manuális szinkronizálás', error: data.error || `HTTP ${res.status}` });
        return;
      }

      let details = `Sikeres szinkronizálás! ${data.synced} projekt szinkronizálva.\n` +
        `Értékesítés: ${data.sales_count} db | Partnerek: ${data.partner_count} db\n` +
        `Duplikáció szűrve: ${data.duplicates_removed} db | Összesen: ${data.total_found} egyedi projekt`;
      if (data.errors > 0) details += `\nHibák: ${data.errors}`;
      if (data.sales_mapping) {
        details += `\n\nÉrtékesítés oszlopok: [${data.sales_mapping.headers?.join(', ')}]`;
        details += `\n  Név oszlop: "${data.sales_mapping.nameCol}" | ID oszlop: "${data.sales_mapping.idCol}" | Kategória: "${data.sales_mapping.catCol}"`;
      }
      if (data.partner_mapping) {
        details += `\nPartner oszlopok: [${data.partner_mapping.headers?.join(', ')}]`;
        details += `\n  Név oszlop: "${data.partner_mapping.nameCol}" | ID oszlop: "${data.partner_mapping.idCol}" | Kategória: "${data.partner_mapping.catCol}"`;
      }
      setMessage({ type: 'success', text: details });
      loadProjects();
      loadSettings();
    } catch (err) {
      setMessage({ type: 'error', text: 'A szinkronizálás sikertelen. Kérjük, vegye fel a kapcsolatot: CONSORTIO@traininghungary.com' });
      reportError({ page: 'Szinkronizálás', action: 'Manuális szinkronizálás', error: err?.message || 'Hálózati hiba' });
    } finally {
      setSyncing(false);
    }
  };

  const saveScheduleSettings = async () => {
    setSavingSettings(true);
    try {
      await supabase.from('app_settings').upsert(
        { key: 'auto_sync_enabled', value: autoSyncEnabled ? 'true' : 'false' },
        { onConflict: 'key' }
      );
      await supabase.from('app_settings').upsert(
        { key: 'sync_schedule', value: syncSchedule },
        { onConflict: 'key' }
      );
      setMessage({ type: 'success', text: 'Mentve!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Hiba történt a mentés során. Kérjük, vegye fel a kapcsolatot: CONSORTIO@traininghungary.com' });
      reportError({ page: 'Szinkronizálás', action: 'Ütemezési beállítások mentése', error: err?.message || 'Ismeretlen hiba' });
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleStatus = async (project) => {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    await supabase
      .from('minicrm_projects')
      .update({ status: newStatus })
      .eq('id', project.id);
    loadProjects();
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;

    const minicrm_id = Math.abs(
      Array.from(name.toLowerCase()).reduce(
        (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) & 0x7fffffff,
        0
      )
    );

    const { error } = await supabase.from('minicrm_projects').insert({
      minicrm_id,
      name,
      category_name: 'Manuális',
      source: 'manual',
      status: 'active',
      last_synced_at: new Date().toISOString(),
    });

    if (error) {
      setMessage({ type: 'error', text: 'Hiba: ' + error.message });
      reportError({ page: 'Szinkronizálás', action: 'Manuális projekt hozzáadása', error: error.message });
      return;
    }

    setNewProjectName('');
    setShowAddForm(false);
    setMessage({ type: 'success', text: `"${name}" projekt sikeresen hozzáadva!` });
    loadProjects();
  };

  const sourceLabel = (source) => {
    switch (source) {
      case 'minicrm_sales': return 'MiniCRM Értékesítés';
      case 'minicrm_partner': return 'MiniCRM Partner';
      case 'manual': return 'Manuális';
      default: return source || 'MiniCRM';
    }
  };

  const sourceColor = (source) => {
    switch (source) {
      case 'minicrm_sales': return 'bg-blue-100 text-blue-700';
      case 'minicrm_partner': return 'bg-purple-100 text-purple-700';
      case 'manual': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = searchFilter
      ? p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.category_name && p.category_name.toLowerCase().includes(searchFilter.toLowerCase()))
      : true;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSource = sourceFilter === 'all' ||
      (sourceFilter === 'minicrm' ? (p.source === 'minicrm_sales' || p.source === 'minicrm_partner' || !p.source) : p.source === sourceFilter);
    return matchesSearch && matchesStatus && matchesSource;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="spinner w-10 h-10 text-medium-blue" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-montserrat font-bold text-deep-blue mb-6">
        Projekt Szinkronizálás
      </h1>

      {/* Sync card */}
      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-medium-blue/10 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-medium-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-montserrat font-semibold text-deep-blue mb-1">
              MiniCRM adatforrás
            </h3>
            <p className="text-sm text-mid-gray mb-2">
              A projektek a közzétett Google Sheets dokumentumból töltődnek le (MiniCRM export).
              Az értékesítési és partner projektek deduplikálva kerülnek importálásra.
              Az összes MiniCRM mező eltárolásra kerül.
            </p>
            {lastSyncAt && (
              <p className="text-xs text-mid-gray mb-3">
                Utolsó szinkronizálás: <span className="font-semibold">{new Date(lastSyncAt).toLocaleString('hu-HU')}</span>
              </p>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Szinkronizálás folyamatban...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
                  </svg>
                  Szinkronizálás indítása
                </>
              )}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : message.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-blue-50 border border-blue-200 text-blue-700'
            }`}
          >
            <pre className="whitespace-pre-wrap font-opensans">{message.text}</pre>
          </div>
        )}
      </div>

      {/* Schedule settings */}
      <div className="card mb-6">
        <h3 className="text-lg font-montserrat font-semibold text-deep-blue mb-4">
          Automatikus szinkronizálás ütemezése
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-checked:bg-medium-blue rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <span className="text-sm font-semibold text-dark-text">
                Automatikus napi szinkronizálás
              </span>
            </label>
          </div>
          {autoSyncEnabled && (
            <div>
              <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">
                Időpont (UTC)
              </label>
              <select
                value={syncSchedule}
                onChange={(e) => setSyncSchedule(e.target.value)}
                className="input-field !w-auto !py-2 text-sm"
              >
                {SYNC_SCHEDULES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={saveScheduleSettings}
            disabled={savingSettings}
            className="btn-secondary !py-2 !px-4 text-sm"
          >
            {savingSettings ? 'Mentés...' : 'Beállítások mentése'}
          </button>
        </div>
        {autoSyncEnabled && (
          <p className="text-xs text-mid-gray mt-3">
            A szinkronizálás naponta egyszer automatikusan fut (06:00 UTC).
          </p>
        )}
      </div>

      {/* Manual add */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-montserrat font-semibold text-deep-blue">
            Manuális projekt hozzáadás
          </h3>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-secondary text-sm !px-4 !py-2 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Új projekt
            </button>
          )}
        </div>
        {showAddForm && (
          <form onSubmit={handleManualAdd} className="flex gap-2 mt-3">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Projekt neve..."
              required
              className="input-field flex-1"
              autoFocus
            />
            <button type="submit" className="btn-primary !py-2 !px-4 text-sm">
              Hozzáadás
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewProjectName(''); }}
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              Mégse
            </button>
          </form>
        )}
        {!showAddForm && (
          <p className="text-sm text-mid-gray">
            A manuálisan hozzáadott projektek elkülönülnek a MiniCRM-ből importáltaktól, és a szinkronizálás nem érinti őket.
          </p>
        )}
      </div>

      {/* Project list */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-montserrat font-semibold text-deep-blue">
            Projektek ({filteredProjects.length} / {projects.length})
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-mid-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Keresés..."
                className="input-field !pl-9 !py-2 text-sm"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input-field !py-2 text-sm !w-auto"
            >
              <option value="all">Minden forrás</option>
              <option value="minicrm">MiniCRM (összes)</option>
              <option value="minicrm_sales">MiniCRM Értékesítés</option>
              <option value="minicrm_partner">MiniCRM Partner</option>
              <option value="manual">Manuális</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field !py-2 text-sm !w-auto"
            >
              <option value="all">Mind</option>
              <option value="active">Aktív</option>
              <option value="archived">Archivált</option>
            </select>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <p className="text-center text-mid-gray py-8">
            {projects.length === 0
              ? 'Még nincsenek szinkronizált projektek. Kattints a fenti gombra az indításhoz!'
              : 'Nincs találat a szűrési feltételekre.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Projekt neve
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Forrás
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider hidden md:table-cell">
                    Kategória
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider hidden md:table-cell">
                    Utolsó szinkron
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Státusz
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-pale-blue/50 cursor-pointer ${expandedProject === p.id ? 'bg-pale-blue/30' : ''}`}
                    onClick={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                  >
                    <td className="py-3 text-sm font-opensans text-dark-text">
                      <div className="flex items-center gap-1">
                        <svg
                          className={`w-3 h-3 text-mid-gray transition-transform flex-shrink-0 ${expandedProject === p.id ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                        {p.name}
                      </div>
                      {expandedProject === p.id && p.raw_data && (
                        <div className="mt-2 ml-4 p-3 bg-gray-50 rounded-lg text-xs space-y-1" onClick={(e) => e.stopPropagation()}>
                          <p className="font-montserrat font-bold text-mid-gray uppercase tracking-wider mb-2">MiniCRM adatok</p>
                          {Object.entries(p.raw_data).map(([key, val]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-mid-gray font-semibold min-w-[120px]">{key}:</span>
                              <span className="text-dark-text">{val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {expandedProject === p.id && !p.raw_data && (
                        <div className="mt-2 ml-4 p-3 bg-gray-50 rounded-lg text-xs text-mid-gray" onClick={(e) => e.stopPropagation()}>
                          Nincs további MiniCRM adat (manuálisan hozzáadott projekt).
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-montserrat font-semibold px-2 py-0.5 rounded-full ${sourceColor(p.source)}`}>
                        {sourceLabel(p.source)}
                      </span>
                    </td>
                    <td className="py-3 text-sm font-opensans text-mid-gray hidden md:table-cell">
                      {p.category_name || '-'}
                    </td>
                    <td className="py-3 text-sm font-opensans text-mid-gray hidden md:table-cell">
                      {p.last_synced_at
                        ? new Date(p.last_synced_at).toLocaleString('hu-HU')
                        : '-'}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStatus(p); }}
                        className={`text-xs font-montserrat font-semibold px-3 py-1 rounded-full transition-all ${
                          p.status === 'active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p.status === 'active' ? 'Aktív' : 'Archivált'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
