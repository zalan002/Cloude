'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function MyEntriesPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data } = await supabase
      .from('time_entries')
      .select('*, minicrm_projects(name)')
      .eq('user_id', user.id)
      .gte('entry_date', fourteenDaysAgo)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = async (entryId) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a bejegyzést?')) return;

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      alert('Hiba a törlés során: ' + error.message);
      return;
    }

    loadEntries();
  };

  // Group entries by date
  const grouped = entries.reduce((acc, entry) => {
    const date = entry.entry_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const getDayTotal = (dayEntries) => {
    return dayEntries.reduce((sum, e) => sum + Number(e.hours), 0);
  };

  const formatTime = (hours) => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m} perc`;
    if (m === 0) return `${h} óra`;
    return `${h} óra ${m} perc`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <svg
            className="spinner w-10 h-10 text-medium-blue mx-auto mb-3"
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
          <p className="text-mid-gray">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-montserrat font-bold text-deep-blue">
          Bejegyzéseim
        </h1>
        <Link href="/time-entry" className="btn-primary text-sm">
          + Új bejegyzés
        </Link>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card text-center py-12">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-mid-gray mb-4">
            Még nincsenek bejegyzéseid az elmúlt 14 napban.
          </p>
          <Link href="/time-entry" className="btn-primary inline-block">
            Első bejegyzés rögzítése
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayEntries]) => (
            <div key={date}>
              {/* Day header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-montserrat font-semibold text-dark-text capitalize">
                  {formatDate(date)}
                </h3>
                <span className="text-sm font-montserrat font-bold text-medium-blue bg-medium-blue/10 px-3 py-1 rounded-full">
                  {formatTime(getDayTotal(dayEntries))}
                </span>
              </div>

              {/* Day entries */}
              <div className="space-y-2">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="card !p-4 flex items-center gap-4"
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
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="font-montserrat font-bold text-medium-blue">
                        {formatTime(Number(entry.hours))}
                      </span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                        title="Bejegyzés törlése"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
