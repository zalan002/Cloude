'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ProjectSelector from '@/components/ProjectSelector';

export default function TimeEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [minutes, setMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase
        .from('minicrm_projects')
        .select('*')
        .eq('status', 'active')
        .order('name');
      setProjects(data || []);

      const preselected = searchParams.get('project');
      if (preselected) {
        setProjectId(preselected);
      }
    }
    loadProjects();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Nem vagy bejelentkezve.');
        return;
      }

      const { error: insertError } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.id,
          project_id: parseInt(projectId),
          entry_date: entryDate,
          hours: parseInt(minutes) / 60,
          description: description.trim() || null,
        });

      if (insertError) {
        setError('Hiba a mentés során: ' + insertError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/my-entries');
      }, 1500);
    } catch {
      setError('Váratlan hiba történt.');
    } finally {
      setLoading(false);
    }
  };

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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project select */}
          <div>
            <label
              className="block text-sm font-semibold text-dark-text mb-2"
            >
              Projekt <span className="text-red-500">*</span>
            </label>
            <ProjectSelector
              projects={projects}
              value={projectId}
              onChange={setProjectId}
              required
            />
          </div>

          {/* Date input */}
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-semibold text-dark-text mb-2"
            >
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
            <label
              htmlFor="minutes"
              className="block text-sm font-semibold text-dark-text mb-2"
            >
              Időtartam (perc) <span className="text-red-500">*</span>
            </label>
            <input
              id="minutes"
              type="number"
              step="5"
              min="5"
              max="1440"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="pl. 30"
              required
              className="input-field"
            />
            {minutes && parseInt(minutes) >= 5 && (
              <p className="text-xs text-mid-gray mt-1">
                = {Math.floor(parseInt(minutes) / 60)} óra {parseInt(minutes) % 60} perc
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-semibold text-dark-text mb-2"
            >
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
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg
                    className="spinner w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Mentés...
                </>
              ) : (
                'Mentés'
              )}
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
      </div>
    </div>
  );
}
