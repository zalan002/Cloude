'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const CATEGORIES = [
  'ÉRTÉKESÍTÉS',
  'JOG',
  'ASSZISZTENCIA',
  'KÖNYVELÉS',
  'MUNKAÜGY',
];

export default function AdminTasksPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('');
  const [message, setMessage] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

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

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('category')
      .order('name');
    setTasks(data || []);
  }, []);

  useEffect(() => {
    if (profile) loadTasks();
  }, [profile, loadTasks]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newTaskName.trim();
    if (!name) return;

    const insertData = {
      name,
      status: 'active',
    };
    if (newTaskCategory) {
      insertData.category = newTaskCategory;
    }

    const { error } = await supabase.from('tasks').insert(insertData);

    if (error) {
      setMessage({ type: 'error', text: 'Hiba: ' + error.message });
      return;
    }

    setNewTaskName('');
    setNewTaskCategory('');
    setShowAddForm(false);
    setMessage({ type: 'success', text: `"${name}" feladat sikeresen hozzáadva!` });
    loadTasks();
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === 'active' ? 'archived' : 'active';
    await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);
    loadTasks();
  };

  const updateCategory = async (task, category) => {
    await supabase
      .from('tasks')
      .update({ category: category || null })
      .eq('id', task.id);
    loadTasks();
  };

  const handleDelete = async (task) => {
    if (!confirm(`Biztosan törölni szeretnéd a "${task.name}" feladatot?`)) return;
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      setMessage({ type: 'error', text: 'Hiba: ' + error.message });
      return;
    }
    loadTasks();
  };

  // Get unique categories from tasks
  const existingCategories = [...new Set(tasks.map((t) => t.category).filter(Boolean))];

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = searchFilter
      ? t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (t.category && t.category.toLowerCase().includes(searchFilter.toLowerCase()))
      : true;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCategory =
      categoryFilter === 'all' ||
      (categoryFilter === 'none' ? !t.category : t.category === categoryFilter);
    return matchesSearch && matchesStatus && matchesCategory;
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
        Feladatok kezelése
      </h1>

      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add task */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-montserrat font-semibold text-deep-blue">
            Új feladat hozzáadása
          </h3>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-secondary text-sm !px-4 !py-2 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Új feladat
            </button>
          )}
        </div>
        {showAddForm ? (
          <form onSubmit={handleAdd} className="space-y-3 mt-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Feladat neve..."
                required
                className="input-field flex-1"
                autoFocus
              />
              <select
                value={newTaskCategory}
                onChange={(e) => setNewTaskCategory(e.target.value)}
                className="input-field !w-auto"
              >
                <option value="">Kategória (opcionális)</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary !py-2 !px-4 text-sm">
                Hozzáadás
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewTaskName(''); setNewTaskCategory(''); }}
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                Mégse
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-mid-gray">
            Itt tudsz feladatokat hozzáadni, amelyeket a felhasználók kiválaszthatnak az időbejegyzéseknél.
          </p>
        )}
      </div>

      {/* Task list */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-montserrat font-semibold text-deep-blue">
            Feladatok ({filteredTasks.length} / {tasks.length})
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
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field !py-2 text-sm !w-auto"
            >
              <option value="all">Minden kategória</option>
              <option value="none">Kategória nélkül</option>
              {existingCategories.sort().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
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

        {filteredTasks.length === 0 ? (
          <p className="text-center text-mid-gray py-8">
            {tasks.length === 0
              ? 'Még nincsenek feladatok. Adj hozzá egyet a fenti gombbal!'
              : 'Nincs találat a szűrési feltételekre.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Feladat neve
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Kategória
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                    Státusz
                  </th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider w-20">
                    Művelet
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-pale-blue/50">
                    <td className="py-3 text-sm font-opensans text-dark-text">
                      {t.name}
                    </td>
                    <td className="py-3">
                      <select
                        value={t.category || ''}
                        onChange={(e) => updateCategory(t, e.target.value)}
                        className="text-xs font-montserrat font-semibold px-2 py-1 rounded-lg border border-gray-200 bg-white text-dark-text focus:outline-none focus:ring-1 focus:ring-medium-blue"
                      >
                        <option value="">— Nincs —</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleStatus(t)}
                        className={`text-xs font-montserrat font-semibold px-3 py-1 rounded-full transition-all ${
                          t.status === 'active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {t.status === 'active' ? 'Aktív' : 'Archivált'}
                      </button>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleDelete(t)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Feladat törlése"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
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
