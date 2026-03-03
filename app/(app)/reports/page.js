'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const TABS = [
  { id: 'monthly', label: 'Havi összesítő' },
  { id: 'projects', label: 'Projektek' },
  { id: 'weekly', label: 'Heti nézet' },
];

const DAY_NAMES = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];

function formatTime(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} perc`;
  if (m === 0) return `${h} óra`;
  return `${h} óra ${m} perc`;
}

function formatTimeShort(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}p`;
  if (m === 0) return `${h}ó`;
  return `${h}ó ${m}p`;
}

export default function ReportsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('monthly');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  // Monthly state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState([]);

  // Project state
  const [projectData, setProjectData] = useState([]);
  const [projectUserFilter, setProjectUserFilter] = useState('all');
  const [projectDetailData, setProjectDetailData] = useState([]);

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

        // Load all users if admin
        if (data?.role === 'admin') {
          const { data: allUsers } = await supabase
            .from('profiles')
            .select('id, full_name')
            .order('full_name');
          setUsers(allUsers || []);
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  // Load monthly data - grouped by person with project breakdown
  const loadMonthly = useCallback(async () => {
    if (!profile) return;

    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0)
      .toISOString()
      .split('T')[0];

    let query = supabase
      .from('time_entries')
      .select('user_id, hours, project_id, profiles(full_name), minicrm_projects(name)')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data } = await query;

    // Aggregate by user, with project sub-totals
    const userMap = {};
    (data || []).forEach((entry) => {
      const uid = entry.user_id;
      if (!userMap[uid]) {
        userMap[uid] = {
          name: entry.profiles?.full_name || 'Ismeretlen',
          hours: 0,
          projects: {},
        };
      }
      userMap[uid].hours += Number(entry.hours);

      const projectName = entry.minicrm_projects?.name || 'Ismeretlen';
      if (!userMap[uid].projects[projectName]) {
        userMap[uid].projects[projectName] = 0;
      }
      userMap[uid].projects[projectName] += Number(entry.hours);
    });

    const result = Object.values(userMap)
      .map((u) => ({
        ...u,
        projectList: Object.entries(u.projects)
          .map(([name, hours]) => ({ name, hours }))
          .sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.hours - a.hours);

    setMonthlyData(result);
  }, [profile, selectedMonth]);

  // Load project data with user breakdown
  const loadProjects = useCallback(async () => {
    if (!profile) return;

    let query = supabase
      .from('time_entries')
      .select('project_id, hours, user_id, minicrm_projects(name), profiles(full_name)');

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    } else if (projectUserFilter !== 'all') {
      query = query.eq('user_id', projectUserFilter);
    }

    const { data } = await query;

    // Aggregate by project
    const projectMap = {};
    (data || []).forEach((entry) => {
      const pid = entry.project_id;
      if (!projectMap[pid]) {
        projectMap[pid] = {
          name: entry.minicrm_projects?.name || 'Ismeretlen',
          hours: 0,
          users: {},
        };
      }
      projectMap[pid].hours += Number(entry.hours);

      const userName = entry.profiles?.full_name || 'Ismeretlen';
      if (!projectMap[pid].users[userName]) {
        projectMap[pid].users[userName] = 0;
      }
      projectMap[pid].users[userName] += Number(entry.hours);
    });

    const result = Object.values(projectMap)
      .map((p) => ({
        ...p,
        userList: Object.entries(p.users)
          .map(([name, hours]) => ({ name, hours }))
          .sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.hours - a.hours);

    setProjectData(result);
    setProjectDetailData([]);
  }, [profile, projectUserFilter]);

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

  const toggleProjectDetail = (projectName) => {
    setProjectDetailData((prev) =>
      prev.includes(projectName)
        ? prev.filter((n) => n !== projectName)
        : [...prev, projectName]
    );
  };

  const [expandedUsers, setExpandedUsers] = useState([]);
  const toggleUserDetail = (userName) => {
    setExpandedUsers((prev) =>
      prev.includes(userName)
        ? prev.filter((n) => n !== userName)
        : [...prev, userName]
    );
  };

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

  const maxMonthlyHours = Math.max(...monthlyData.map((u) => u.hours), 1);
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
            <div className="space-y-3">
              {monthlyData.map((user, i) => (
                <div key={i}>
                  <div
                    className="flex items-center gap-4 cursor-pointer group"
                    onClick={() => toggleUserDetail(user.name)}
                  >
                    <div className="w-32 md:w-48 flex-shrink-0 flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-mid-gray transition-transform ${
                          expandedUsers.includes(user.name) ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
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
                    <span className="text-sm font-montserrat font-bold text-medium-blue w-28 text-right flex-shrink-0">
                      {formatTime(user.hours)}
                    </span>
                  </div>
                  {/* Project breakdown */}
                  {expandedUsers.includes(user.name) && (
                    <div className="ml-10 mt-2 mb-3 space-y-1.5 border-l-2 border-medium-blue/20 pl-4">
                      {user.projectList.map((proj, j) => (
                        <div key={j} className="flex items-center justify-between text-sm">
                          <span className="text-mid-gray truncate">{proj.name}</span>
                          <span className="font-montserrat font-semibold text-dark-text ml-4 flex-shrink-0">
                            {formatTime(proj.hours)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projects tab */}
      {activeTab === 'projects' && (
        <div className="card">
          {/* User filter for admins */}
          {profile?.role === 'admin' && users.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-semibold text-dark-text">
                Szűrés személy szerint:
              </label>
              <select
                value={projectUserFilter}
                onChange={(e) => setProjectUserFilter(e.target.value)}
                className="input-field !w-auto"
              >
                <option value="all">Mindenki</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {projectData.length === 0 ? (
            <p className="text-center text-mid-gray py-8">
              Nincsenek projekt adatok.
            </p>
          ) : (
            <div className="space-y-3">
              {projectData.map((project, i) => (
                <div key={i}>
                  <div
                    className="flex items-center gap-4 cursor-pointer group"
                    onClick={() => toggleProjectDetail(project.name)}
                  >
                    <div className="w-32 md:w-48 flex-shrink-0 flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-mid-gray transition-transform ${
                          projectDetailData.includes(project.name) ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
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
                    <span className="text-sm font-montserrat font-bold text-medium-blue w-28 text-right flex-shrink-0">
                      {formatTime(project.hours)}
                    </span>
                  </div>
                  {/* User breakdown */}
                  {projectDetailData.includes(project.name) && (
                    <div className="ml-10 mt-2 mb-3 space-y-1.5 border-l-2 border-medium-blue/20 pl-4">
                      {project.userList.map((u, j) => (
                        <div key={j} className="flex items-center justify-between text-sm">
                          <span className="text-mid-gray truncate">{u.name}</span>
                          <span className="font-montserrat font-semibold text-dark-text ml-4 flex-shrink-0">
                            {formatTime(u.hours)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Total */}
              <div className="border-t border-gray-200 pt-3 mt-4 flex items-center justify-between">
                <span className="font-montserrat font-bold text-deep-blue">Összesen</span>
                <span className="font-montserrat font-bold text-deep-blue">
                  {formatTime(projectData.reduce((sum, p) => sum + p.hours, 0))}
                </span>
              </div>
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
                  {day.hours > 0 ? formatTimeShort(day.hours) : '0'}
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
          {/* Weekly total */}
          <div className="border-t border-gray-200 pt-3 mt-4 flex items-center justify-between">
            <span className="font-montserrat font-bold text-deep-blue">14 napos összesen</span>
            <span className="font-montserrat font-bold text-deep-blue">
              {formatTime(weeklyData.reduce((sum, d) => sum + d.hours, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
