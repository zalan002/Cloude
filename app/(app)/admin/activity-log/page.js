'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const EVENT_TYPES = [
  { value: 'all', label: 'Minden esemény' },
  { value: 'time_entry.created', label: 'Időbejegyzés létrehozva' },
  { value: 'time_entry.deleted', label: 'Időbejegyzés törölve' },
  { value: 'user.login', label: 'Bejelentkezés' },
  { value: 'user.logout', label: 'Kijelentkezés' },
  { value: 'sync.completed', label: 'Szinkronizálás kész' },
  { value: 'admin.role_change', label: 'Szerepkör módosítás' },
  { value: 'admin.user_status_change', label: 'Felhasználó státusz' },
  { value: 'admin.department_change', label: 'Részleg módosítás' },
  { value: 'admin.project_status_change', label: 'Projekt státusz' },
  { value: 'admin.project_manual_add', label: 'Projekt hozzáadva' },
  { value: 'admin.task_add', label: 'Feladat hozzáadva' },
  { value: 'admin.task_status_change', label: 'Feladat státusz' },
  { value: 'admin.task_delete', label: 'Feladat törölve' },
];

function formatDate(isoString) {
  return new Date(isoString).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function eventLabel(eventType) {
  const found = EVENT_TYPES.find((e) => e.value === eventType);
  return found ? found.label : eventType;
}

function eventColor(eventType) {
  if (eventType.startsWith('time_entry.created')) return 'bg-green-100 text-green-700';
  if (eventType.startsWith('time_entry.deleted')) return 'bg-red-100 text-red-700';
  if (eventType.startsWith('user.login')) return 'bg-blue-100 text-blue-700';
  if (eventType.startsWith('user.logout')) return 'bg-gray-100 text-gray-600';
  if (eventType.startsWith('sync.')) return 'bg-purple-100 text-purple-700';
  if (eventType.startsWith('admin.')) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

export default function AdminActivityLogPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [eventFilter, setEventFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [users, setUsers] = useState([]);
  const [userFilter, setUserFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/');
        return;
      }

      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      setUsers(allUsers || []);
      setLoading(false);
    }
    init();
  }, []);

  const loadLogs = useCallback(async () => {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (eventFilter !== 'all') {
      query = query.eq('event_type', eventFilter);
    }
    if (userFilter !== 'all') {
      query = query.eq('user_id', userFilter);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom + 'T00:00:00');
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data } = await query;
    setLogs(data || []);
  }, [eventFilter, userFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    if (!loading) loadLogs();
  }, [loading, loadLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [eventFilter, userFilter, dateFrom, dateTo]);

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
        Aktivitás napló
      </h1>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
          <div>
            <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">
              Esemény típus
            </label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="input-field !w-auto !py-2 text-sm"
            >
              {EVENT_TYPES.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">
              Felhasználó
            </label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="input-field !w-auto !py-2 text-sm"
            >
              <option value="all">Mindenki</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">
              Dátum -tól
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field !w-auto !py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">
              Dátum -ig
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field !w-auto !py-2 text-sm"
            />
          </div>
          {(eventFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setEventFilter('all');
                setUserFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs text-red-500 hover:text-red-700 font-semibold py-2"
            >
              Szűrők törlése
            </button>
          )}
        </div>
      </div>

      {/* Log table */}
      <div className="card">
        {logs.length === 0 ? (
          <p className="text-center text-mid-gray py-8">
            Nincsenek naplóbejegyzések a megadott szűrőkkel.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                      Időpont
                    </th>
                    <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                      Esemény
                    </th>
                    <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                      Felhasználó
                    </th>
                    <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                      Részletek
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-pale-blue/50">
                      <td className="py-3 text-xs text-mid-gray whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3">
                        <span className={`text-xs font-montserrat font-semibold px-2 py-0.5 rounded-full ${eventColor(log.event_type)}`}>
                          {eventLabel(log.event_type)}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-dark-text">
                        {log.user_email || '—'}
                      </td>
                      <td className="py-3 text-xs text-mid-gray max-w-md">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <div className="space-y-0.5">
                            {Object.entries(log.details).map(([key, val]) => (
                              <div key={key}>
                                <span className="font-semibold text-dark-text">{key}:</span>{' '}
                                {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                              </div>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary !py-2 !px-4 text-sm disabled:opacity-50"
              >
                Előző
              </button>
              <span className="text-sm text-mid-gray">
                {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + logs.length} bejegyzés
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={logs.length < PAGE_SIZE}
                className="btn-secondary !py-2 !px-4 text-sm disabled:opacity-50"
              >
                Következő
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
