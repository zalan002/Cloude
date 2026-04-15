'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ProjectSelector from '@/components/ProjectSelector';
import TaskSelector from '@/components/TaskSelector';
import { reportError } from '@/lib/reportError';

export default function TimeEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [minutes, setMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [projectsRes, tasksRes] = await Promise.all([
        supabase
          .from('minicrm_projects')
          .select('id, name, source_key, status, category_name')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('tasks')
          .select('*')
          .eq('status', 'active')
          .order('name'),
      ]);
      setProjects(projectsRes.data || []);
      setTasks(tasksRes.data || []);

      const preselected = searchParams.get('project');
      if (preselected) {
        setProjectId(preselected);
      }
    }
    loadData();
  }, [searchParams]);

  // Step 1: Validate and show confirmation
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const parsedProjectId = parseInt(projectId);
    const parsedMinutes = parseInt(minutes);

    if (!parsedProjectId || isNaN(parsedProjectId)) {
      setError('Kérjük, válasszon projektet.');
      return;
    }
    if (!taskId) {
      setError('Kérjük, válasszon feladatot.');
      return;
    }
    if (!parsedMinutes || isNaN(parsedMinutes) || parsedMinutes < 1) {
      setError('Kérjük, adjon meg érvényes időtartamot.');
      return;
    }
    if (!entryDate) {
      setError('Kérjük, adjon meg dátumot.');
      return;
    }

    setShowConfirm(true);
  };

  // Step 2: Actually save after confirmation
  const handleConfirmedSave = async () => {
    setLoading(true);
    setError('');

    try {
      const parsedProjectId = parseInt(projectId);
      const parsedMinutes = parseInt(minutes);

      // Look up the source_key from the in-memory project list.
      // The server requires it and re-validates that it still
      // matches the row in the DB — this is the safeguard that
      // prevents an entry from being attached to a different
      // project than the user picked.
      const projectInList = projects.find(
        (p) => String(p.id) === String(parsedProjectId)
      );
      if (!projectInList || !projectInList.source_key) {
        setError('A kiválasztott projekt nem található. Töltsd újra az oldalt.');
        setShowConfirm(false);
        return;
      }

      const payload = {
        project_id: parsedProjectId,
        project_source_key: projectInList.source_key,
        task_id: taskId ? parseInt(taskId) : null,
        entry_date: entryDate,
        hours: parsedMinutes / 60,
        description: description.trim() || null,
      };

      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || 'Ismeretlen hiba';
        setError('Hiba a mentés során: ' + msg);
        setShowConfirm(false);
        reportError({ page: 'Időbejegyzés', action: 'Időbejegyzés mentése', error: msg });
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/my-entries');
      }, 1500);
    } catch (err) {
      setError('Váratlan hiba történt.');
      setShowConfirm(false);
      reportError({ page: 'Időbejegyzés', action: 'Időbejegyzés mentése', error: err?.message || 'Ismeretlen hiba' });
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find((p) => String(p.id) === String(projectId));
  const selectedTask = tasks.find((t) => String(t.id) === String(taskId));
  const parsedMinutesDisplay = parseInt(minutes) || 0;

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="success-check inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <p className="text-lg font-montserrat font-semibold text-deep-blue">
            Bejegyzés mentve!
          </p>
          <p className="text-sm text-mid-gray mt-1">
            Átirányítás a bejegyzéseidhez...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-montserrat font-bold text-deep-blue mb-6">
        Új időbejegyzés
      </h1>

      <div className="card max-w-2xl">
        {showConfirm ? (
          /* Confirmation view */
          <div>
            <p className="text-sm font-semibold text-deep-blue mb-4">Kérjük, ellenőrizze a bejegyzés adatait:</p>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-mid-gray w-24 flex-shrink-0">Projekt</span>
                <span className="text-sm text-dark-text font-semibold">{selectedProject?.name || '—'}</span>
              </div>
              <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-mid-gray w-24 flex-shrink-0">Feladat</span>
                <span className="text-sm text-dark-text">{selectedTask?.name || '—'}{selectedTask?.category ? <span className="text-xs text-mid-gray ml-1">({selectedTask.category})</span> : ''}</span>
              </div>
              <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-mid-gray w-24 flex-shrink-0">Dátum</span>
                <span className="text-sm text-dark-text">{new Date(entryDate + 'T00:00:00').toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
              </div>
              <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-mid-gray w-24 flex-shrink-0">Időtartam</span>
                <span className="text-sm text-dark-text font-semibold">{Math.floor(parsedMinutesDisplay / 60)} óra {parsedMinutesDisplay % 60} perc</span>
              </div>
              {description.trim() && (
                <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-mid-gray w-24 flex-shrink-0">Leírás</span>
                  <span className="text-sm text-dark-text">{description.trim()}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmedSave}
                disabled={loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Mentés...
                  </>
                ) : (
                  'Mentés'
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn-secondary"
              >
                Módosítás
              </button>
            </div>
          </div>
        ) : (
          /* Entry form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project select */}
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-2">
                Projekt <span className="text-red-500">*</span>
              </label>
              <ProjectSelector
                projects={projects}
                value={projectId}
                onChange={setProjectId}
                required
              />
            </div>

            {/* Task select */}
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-2">
                Feladat <span className="text-red-500">*</span>
              </label>
              <TaskSelector
                tasks={tasks}
                value={taskId}
                onChange={setTaskId}
                required
              />
            </div>

            {/* Date input */}
            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-dark-text mb-2">
                Dátum <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="input-field"
              />
            </div>

            {/* Minutes input */}
            <div>
              <label htmlFor="minutes" className="block text-sm font-semibold text-dark-text mb-2">
                Időtartam (perc) <span className="text-red-500">*</span>
              </label>
              <input
                id="minutes"
                type="number"
                step="1"
                min="1"
                max="1440"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="pl. 30"
                required
                className="input-field"
              />
              {minutes && parseInt(minutes) >= 1 && (
                <p className="text-xs text-mid-gray mt-1">
                  = {Math.floor(parseInt(minutes) / 60)} óra {parseInt(minutes) % 60} perc
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-dark-text mb-2">
                Leírás <span className="text-mid-gray font-normal">(opcionális)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mit csináltál ezen a projekten?"
                rows={3}
                className="input-field resize-none"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-4 pt-2">
              <button type="submit" className="btn-primary">
                Tovább
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-secondary"
              >
                Mégse
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
