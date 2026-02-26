'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const TABS = [
  { id: 'monthly', label: 'Havi összesítő' },
  { id: 'projects', label: 'Projektek' },
  { id: 'weekly', label: 'Heti nézet' },
];

const DAY_NAMES = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];

export default function ReportsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('monthly');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Monthly state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState([]);

  // Project state
  const [projectData, setProjectData] = useState([]);

  // Weekly state
  const [weeklyData, setWeeklyData] = useState([]);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  // Load monthly data
  const loadMonthly = useCallback(async () => {
    if (!profile) return;

    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0)
      .toISOString()
      .split('T')[0];

    let query = supabase
      .from('time_entries')
      .select('user_id, hours, profiles(full_name)')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data } = await query;

    // Aggregate by user
    const userMap = {};
    (data || []).forEach((entry) => {
      const uid = entry.user_id;
      if (!userMap[uid]) {
        userMap[uid] = {
          name: entry.profiles?.full_name || 'Ismeretlen',
          hours: 0,
        };
      }
      userMap[uid].hours += Number(entry.hours);
    });

    const result = Object.values(userMap).sort((a, b) => b.hours - a.hours);
    setMonthlyData(result);
  }, [profile, selectedMonth]);

  // Load project data
  const loadProjects = useCallback(async () => {
    if (!profile) return;

    let query = supabase
      .from('time_entries')
      .select('project_id, hours, minicrm_projects(name)');

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data } = await query;

    const projectMap = {};
    (data || []).forEach((entry) => {
      const pid = entry.project_id;
      if (!projectMap[pid]) {
        projectMap[pid] = {
          name: entry.minicrm_projects?.name || 'Ismeretlen',
          hours: 0,
        };
      }
      projectMap[pid].hours += Number(entry.hours);
    });

    const result = Object.values(projectMap).sort((a, b) => b.hours - a.hours);
    setProjectData(result);
  }, [profile]);

  // Load weekly data
  const loadWeekly = useCallback(async () => {
    if (!profile) return;

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().split('T')[0]);
    }

    const startDate = days[0];
    const endDate = days[days.length - 1];

    let query = supabase
      .from('time_entries')
      .select('entry_date, hours')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data } = await query;

    const dayMap = {};
    (data || []).forEach((entry) => {
      if (!dayMap[entry.entry_date]) dayMap[entry.entry_date] = 0;
      dayMap[entry.entry_date] += Number(entry.hours);
    });

    const result = days.map((date) => {
      const d = new Date(date + 'T00:00:00');
      const dayOfWeek = d.getDay();
      return {
        date,
        label: DAY_NAMES[dayOfWeek],
        hours: dayMap[date] || 0,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        dayNum: d.getDate(),
      };
    });

    setWeeklyData(result);
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'monthly') loadMonthly();
    if (activeTab === 'projects') loadProjects();
    if (activeTab === 'weekly') loadWeekly();
  }, [activeTab, loadMonthly, loadProjects, loadWeekly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg
          className="spinner w-10 h-10 text-medium-blue"
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
      </div>
    );
  }

  const maxMonthlyHours = 160;
  const maxProjectHours = Math.max(...projectData.map((p) => p.hours), 1);
  const maxWeeklyHours = Math.max(...weeklyData.map((d) => d.hours), 1);

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-montserrat font-bold text-deep-blue mb-6">
        Riportok
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-gray-100 shadow-sm overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-montserrat font-semibold transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-medium-blue text-white shadow-sm'
                : 'text-mid-gray hover:text-deep-blue hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Monthly tab */}
      {activeTab === 'monthly' && (
        <div className="card">
          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-semibold text-dark-text">
              Hónap:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-field !w-auto"
            />
          </div>

          {monthlyData.length === 0 ? (
            <p className="text-center text-mid-gray py-8">
              Nincs adat a kiválasztott hónapra.
            </p>
          ) : (
            <div className="space-y-4">
              {monthlyData.map((user, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-32 md:w-48 flex-shrink-0">
                    <p className="text-sm font-montserrat font-semibold text-dark-text truncate">
                      {user.name}
                    </p>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-medium-blue to-deep-blue transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (user.hours / maxMonthlyHours) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-montserrat font-bold text-medium-blue w-20 text-right flex-shrink-0">
                    {user.hours.toFixed(1)} óra
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projects tab */}
      {activeTab === 'projects' && (
        <div className="card">
          {projectData.length === 0 ? (
            <p className="text-center text-mid-gray py-8">
              Nincsenek projekt adatok.
            </p>
          ) : (
            <div className="space-y-4">
              {projectData.map((project, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-32 md:w-48 flex-shrink-0">
                    <p className="text-sm font-montserrat font-semibold text-dark-text truncate">
                      {project.name}
                    </p>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-medium-blue to-deep-blue transition-all duration-500"
                      style={{
                        width: `${(project.hours / maxProjectHours) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-montserrat font-bold text-medium-blue w-20 text-right flex-shrink-0">
                    {project.hours.toFixed(1)} óra
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly tab */}
      {activeTab === 'weekly' && (
        <div className="card">
          <div className="flex items-end gap-1 md:gap-2 h-64 pt-8">
            {weeklyData.map((day, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                {/* Hours label */}
                <span
                  className={`text-xs font-montserrat font-bold mb-1 ${
                    day.hours > 0 ? 'text-medium-blue' : 'text-transparent'
                  }`}
                >
                  {day.hours > 0 ? day.hours.toFixed(1) : '0'}
                </span>
                {/* Bar */}
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${
                    day.isWeekend
                      ? 'bg-medium-blue/30'
                      : 'bg-gradient-to-t from-deep-blue to-medium-blue'
                  }`}
                  style={{
                    height:
                      day.hours > 0
                        ? `${Math.max(
                            (day.hours / maxWeeklyHours) * 100,
                            5
                          )}%`
                        : '2px',
                    minHeight: day.hours > 0 ? '8px' : '2px',
                  }}
                />
                {/* Day label */}
                <div className="mt-2 text-center">
                  <p
                    className={`text-xs font-montserrat font-semibold ${
                      day.isWeekend ? 'text-gray-400' : 'text-dark-text'
                    }`}
                  >
                    {day.label}
                  </p>
                  <p className="text-[10px] text-mid-gray">{day.dayNum}.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
