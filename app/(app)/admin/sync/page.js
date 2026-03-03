'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

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

  useEffect(() => {
    if (profile) loadProjects();
  }, [profile, loadProjects]);

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
        setMessage({ type: 'error', text: data.error || 'Szinkronizálási hiba.' });
        return;
      }

      setMessage({
        type: 'success',
        text: `Sikeres szinkronizálás! ${data.synced} projekt szinkronizálva.\n` +
          `Értékesítés: ${data.sales_count} db | Partnerek: ${data.partner_count} db\n` +
          `Duplikáció szűrve: ${data.duplicates_removed} db | Összesen: ${data.total_found} egyedi projekt`,
      });
      loadProjects();
    } catch {
      setMessage({ type: 'error', text: 'Hálózati hiba történt.' });
    } finally {
      setSyncing(false);
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
      status: 'active',
      last_synced_at: new Date().toISOString(),
    });

    if (error) {
      setMessage({ type: 'error', text: 'Hiba: ' + error.message });
      return;
    }

    setNewProjectName('');
    setShowAddForm(false);
    setMessage({ type: 'success', text: `"${name}" projekt sikeresen hozzáadva!` });
    loadProjects();
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = searchFilter
      ? p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.category_name && p.category_name.toLowerCase().includes(searchFilter.toLowerCase()))
      : true;
    const matchesStatus =
      statusFilter === 'all' ||
      p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg
          className="spinner w-10 h-10 text-medium-blue"
          viewBox="0 0 24 24"
          fill="none"
        >
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
              Google Sheets adatforrás
            </h3>
            <p className="text-sm text-mid-gray mb-4">
              A projektek automatikusan letöltődnek a közzétett Google Sheets dokumentumból.
              Az értékesítési és partner projektek deduplikálva kerülnek importálásra.
            </p>
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
            Ha egy projekt nem szerepel a Google Sheets-ben, itt manuálisan is hozzáadhatod.
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
            {/* Search */}
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
            {/* Status filter */}
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
                    Kategória
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Utolsó szinkron
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Státusz
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-pale-blue/50">
                    <td className="py-3 text-sm font-opensans text-dark-text">
                      {p.name}
                    </td>
                    <td className="py-3 text-sm font-opensans text-mid-gray">
                      {p.category_name || '-'}
                    </td>
                    <td className="py-3 text-sm font-opensans text-mid-gray">
                      {p.last_synced_at
                        ? new Date(p.last_synced_at).toLocaleString('hu-HU')
                        : '-'}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleStatus(p)}
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
