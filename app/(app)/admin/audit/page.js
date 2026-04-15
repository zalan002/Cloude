'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const SEVERITIES = ['info', 'warn', 'error', 'critical'];

const SEVERITY_COLOR = {
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-800',
};

export default function AdminAuditPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [emailFilter, setEmailFilter] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_log')
      .select('id, created_at, user_email, event_type, severity, entity_type, entity_id, payload, ip_address')
      .order('created_at', { ascending: false })
      .limit(500);

    if (severityFilter !== 'all') {
      query = query.eq('severity', severityFilter);
    }
    if (eventFilter) {
      query = query.ilike('event_type', `%${eventFilter}%`);
    }
    if (emailFilter) {
      query = query.ilike('user_email', `%${emailFilter}%`);
    }

    const { data } = await query;
    setEntries(data || []);
    setLoading(false);
  }, [severityFilter, eventFilter, emailFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-montserrat font-bold text-deep-blue mb-6">
        Audit napló
      </h1>

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            placeholder="Esemény típus (pl. time_entry)"
            className="input-field text-sm"
          />
          <input
            type="text"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            placeholder="Felhasználó email"
            className="input-field text-sm"
          />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="input-field text-sm"
          >
            <option value="all">Minden szint</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-mid-gray mt-3">
          Legutóbbi 500 esemény. Csak adminok számára látható.
        </p>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-center text-mid-gray py-8">Betöltés...</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-mid-gray py-8">Nincs találat.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase">Időpont</th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase">Felhasználó</th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase">Esemény</th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase">Szint</th>
                  <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase">Entitás</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-pale-blue/50 cursor-pointer"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <td className="py-2 text-xs text-mid-gray whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('hu-HU')}
                    </td>
                    <td className="py-2 text-xs text-dark-text">{e.user_email || '—'}</td>
                    <td className="py-2 text-xs font-mono text-dark-text">{e.event_type}</td>
                    <td className="py-2">
                      <span className={`text-xs font-montserrat font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLOR[e.severity] || ''}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-mid-gray">
                      {e.entity_type ? `${e.entity_type}#${e.entity_id || '-'}` : '—'}
                      {expanded === e.id && (
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-[10px] whitespace-pre-wrap">
                          {JSON.stringify(e.payload, null, 2)}
                        </pre>
                      )}
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
