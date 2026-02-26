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
  const [systemId, setSystemId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [message, setMessage] = useState(null);
  const [projects, setProjects] = useState([]);

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
    if (!systemId.trim()) {
      setMessage({ type: 'error', text: 'Add meg a MiniCRM System ID-t!' });
      return;
    }

    setSyncing(true);
    setMessage(null);

    try {
      const body = { systemId: systemId.trim() };
      if (categoryId.trim()) {
        body.categoryId = parseInt(categoryId.trim());
      }

      const res = await fetch('/api/minicrm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Szinkronizálási hiba.' });
        return;
      }

      if (data.categories) {
        setMessage({
          type: 'info',
          text: `Elérhető kategóriák: ${JSON.stringify(data.categories, null, 2)}`,
        });
        return;
      }

      setMessage({
        type: 'success',
        text: `Sikeres szinkronizálás! ${data.synced} projekt szinkronizálva (${data.total_found} talált).`,
      });
      loadProjects();
    } catch {
      setMessage({ type: 'error', text: 'Hálózati hiba történt.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleManualAdd = async () => {
    const name = prompt('Projekt neve:');
    if (!name) return;
    const minicrmId = prompt('MiniCRM ID (szám):');
    if (!minicrmId || isNaN(parseInt(minicrmId))) {
      alert('Érvényes MiniCRM ID szükséges.');
      return;
    }

    const { error } = await supabase.from('minicrm_projects').insert({
      minicrm_id: parseInt(minicrmId),
      name,
      status: 'active',
    });

    if (error) {
      alert('Hiba: ' + error.message);
      return;
    }

    loadProjects();
  };

  const toggleStatus = async (project) => {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    await supabase
      .from('minicrm_projects')
      .update({ status: newStatus })
      .eq('id', project.id);
    loadProjects();
  };

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
        MiniCRM Szinkronizálás
      </h1>

      {/* Sync form */}
      <div className="card mb-6">
        <h3 className="text-lg font-montserrat font-semibold text-deep-blue mb-4">
          Projektek szinkronizálása
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-2">
              MiniCRM System ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              placeholder="pl. 12345"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-2">
              Kategória ID{' '}
              <span className="text-mid-gray font-normal">(opcionális)</span>
            </label>
            <input
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="Üresen hagyva: kategóriák listázása"
              className="input-field"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Szinkronizálás...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
                  </svg>
                  Szinkronizálás
                </>
              )}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
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

      {/* Project list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-montserrat font-semibold text-deep-blue">
            Szinkronizált projektek ({projects.length})
          </h3>
          <button onClick={handleManualAdd} className="btn-secondary text-sm !px-4 !py-2">
            + Manuális hozzáadás
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="text-center text-mid-gray py-8">
            Még nincsenek szinkronizált projektek.
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
                    MiniCRM ID
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
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-pale-blue/50">
                    <td className="py-3 text-sm font-opensans text-dark-text">
                      {p.name}
                    </td>
                    <td className="py-3 text-sm font-opensans text-mid-gray">
                      {p.minicrm_id}
                    </td>
                    <td className="py-3 text-sm font-opensans text-mid-gray">
                      {new Date(p.last_synced_at).toLocaleString('hu-HU')}
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
