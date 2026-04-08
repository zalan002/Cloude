'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { reportError } from '@/lib/reportError';

const TASK_CATEGORIES = [
  'EGYÉB FELADATOK',
  'ÉRTÉKESÍTÉS',
  'JOG',
  'ASSZISZTENCIA/FELSZÁMOLÁS',
  'KÖNYVELÉS',
  'MUNKAÜGY',
];

export default function AddItemPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Project form
  const [projectName, setProjectName] = useState('');
  const [projectSaving, setProjectSaving] = useState(false);
  const [projects, setProjects] = useState([]);

  // Task form
  const [taskName, setTaskName] = useState('');
  const [taskCategory, setTaskCategory] = useState('');
  const [taskSaving, setTaskSaving] = useState(false);
  const [tasks, setTasks] = useState([]);

  // Search/filter
  const [projectSearch, setProjectSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setLoading(false);
    }
    init();
  }, []);

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from('minicrm_projects')
      .select('id, name, status')
      .eq('status', 'active')
      .order('name');
    setProjects(data || []);
  }, []);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, name, category, status')
      .eq('status', 'active')
      .order('category')
      .order('name');
    setTasks(data || []);
  }, []);

  useEffect(() => {
    if (!loading) {
      loadProjects();
      loadTasks();
    }
  }, [loading, loadProjects, loadTasks]);

  const handleAddProject = async (e) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name || projectSaving) return;

    setProjectSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('minicrm_projects')
      .insert({ name, status: 'active' });

    setProjectSaving(false);

    if (error) {
      setMessage({ type: 'error', text: 'Hiba: ' + error.message });
      reportError({ page: 'Új rögzítése', action: 'Projekt hozzáadása', error: error.message });
      return;
    }

    setProjectName('');
    setMessage({ type: 'success', text: `"${name}" projekt sikeresen hozzáadva!` });
    loadProjects();
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const name = taskName.trim();
    if (!name || taskSaving) return;

    setTaskSaving(true);
    setMessage(null);

    const insertData = { name, status: 'active' };
    if (taskCategory) insertData.category = taskCategory;

    const { error } = await supabase.from('tasks').insert(insertData);

    setTaskSaving(false);

    if (error) {
      setMessage({ type: 'error', text: 'Hiba: ' + error.message });
      reportError({ page: 'Új rögzítése', action: 'Feladat hozzáadása', error: error.message });
      return;
    }

    setTaskName('');
    setTaskCategory('');
    setMessage({ type: 'success', text: `"${name}" feladat sikeresen hozzáadva!` });
    loadTasks();
  };

  const filteredProjects = projectSearch
    ? projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
    : projects;

  const filteredTasks = taskSearch
    ? tasks.filter(
        (t) =>
          t.name.toLowerCase().includes(taskSearch.toLowerCase()) ||
          (t.category && t.category.toLowerCase().includes(taskSearch.toLowerCase()))
      )
    : tasks;

  // Group tasks by category
  const groupedTasks = {};
  filteredTasks.forEach((t) => {
    const cat = t.category || 'Egyéb';
    if (!groupedTasks[cat]) groupedTasks[cat] = [];
    groupedTasks[cat].push(t);
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
        Új projekt / feladat rögzítése
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Project */}
        <div className="card">
          <h2 className="text-lg font-montserrat font-semibold text-deep-blue mb-4">
            Új projekt hozzáadása
          </h2>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-amber-800 font-semibold mb-1">Fontos!</p>
            <p className="text-xs text-amber-700">
              Kérjük, először ellenőrizze az alábbi listában, hogy a projekt nem szerepel-e már! Csak akkor vegyen fel újat, ha biztosan nincs megfelelő.
            </p>
          </div>

          {/* Existing projects list */}
          <div className="mb-4">
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-mid-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Keresés a meglévő projektek között..."
                className="input-field !pl-9 !py-2 text-sm"
              />
            </div>
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {filteredProjects.length === 0 ? (
                <p className="px-4 py-3 text-sm text-mid-gray text-center">
                  {projectSearch ? 'Nincs találat.' : 'Nincsenek projektek.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredProjects.map((p) => (
                    <li key={p.id} className="px-4 py-2 text-sm text-dark-text">
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-mid-gray mt-1">{projects.length} aktív projekt</p>
          </div>

          {/* Add form */}
          <form onSubmit={handleAddProject} className="space-y-3 border-t border-gray-200 pt-4">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Új projekt neve..."
              required
              className="input-field"
            />
            <button
              type="submit"
              disabled={projectSaving || !projectName.trim()}
              className="btn-primary !py-2 text-sm w-full disabled:opacity-50"
            >
              {projectSaving ? 'Mentés...' : 'Projekt hozzáadása'}
            </button>
          </form>
        </div>

        {/* New Task */}
        <div className="card">
          <h2 className="text-lg font-montserrat font-semibold text-deep-blue mb-4">
            Új feladat hozzáadása
          </h2>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-amber-800 font-semibold mb-1">Fontos!</p>
            <p className="text-xs text-amber-700">
              Kérjük, először ellenőrizze az alábbi listában, hogy a feladat nem szerepel-e már! Csak akkor vegyen fel újat, ha biztosan nincs megfelelő.
            </p>
          </div>

          {/* Existing tasks list */}
          <div className="mb-4">
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-mid-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Keresés a meglévő feladatok között..."
                className="input-field !pl-9 !py-2 text-sm"
              />
            </div>
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <p className="px-4 py-3 text-sm text-mid-gray text-center">
                  {taskSearch ? 'Nincs találat.' : 'Nincsenek feladatok.'}
                </p>
              ) : (
                <div>
                  {Object.keys(groupedTasks).sort().map((cat) => (
                    <div key={cat}>
                      <div className="px-4 py-1.5 text-xs font-montserrat font-bold text-medium-blue uppercase tracking-wider bg-pale-blue/50 sticky top-0">
                        {cat}
                      </div>
                      {groupedTasks[cat].map((t) => (
                        <div key={t.id} className="px-4 py-2 text-sm text-dark-text pl-6 border-b border-gray-50">
                          {t.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-mid-gray mt-1">{tasks.length} aktív feladat</p>
          </div>

          {/* Add form */}
          <form onSubmit={handleAddTask} className="space-y-3 border-t border-gray-200 pt-4">
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Új feladat neve..."
              required
              className="input-field"
            />
            <select
              value={taskCategory}
              onChange={(e) => setTaskCategory(e.target.value)}
              className="input-field"
            >
              <option value="">Kategória (opcionális)</option>
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={taskSaving || !taskName.trim()}
              className="btn-primary !py-2 text-sm w-full disabled:opacity-50"
            >
              {taskSaving ? 'Mentés...' : 'Feladat hozzáadása'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
