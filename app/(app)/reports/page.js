'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const TABS = [
  { id: 'monthly', label: 'Havi összesítő' },
  { id: 'projects', label: 'Projektek' },
  { id: 'tasks', label: 'Feladatok' },
  { id: 'daily', label: 'Napi nézet' },
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

function ChevronIcon({ expanded }) {
  return (
    <svg
      className={`w-4 h-4 text-mid-gray transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function BarRow({ label, hours, maxHours, onClick, expanded, children }) {
  return (
    <div>
      <div
        className={`flex items-center gap-4 ${onClick ? 'cursor-pointer group' : ''}`}
        onClick={onClick}
      >
        <div className="w-32 md:w-48 flex-shrink-0 flex items-center gap-2">
          {onClick && <ChevronIcon expanded={expanded} />}
          <p className="text-sm font-montserrat font-semibold text-dark-text truncate">
            {label}
          </p>
        </div>
        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-medium-blue to-deep-blue transition-all duration-500"
            style={{ width: `${Math.min((hours / maxHours) * 100, 100)}%` }}
          />
        </div>
        <span className="text-sm font-montserrat font-bold text-medium-blue w-28 text-right flex-shrink-0">
          {formatTime(hours)}
        </span>
      </div>
      {expanded && children && (
        <div className="ml-10 mt-2 mb-3 space-y-1.5 border-l-2 border-medium-blue/20 pl-4">
          {children}
        </div>
      )}
    </div>
  );
}

function SubRow({ label, hours }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-mid-gray truncate">{label}</span>
      <span className="font-montserrat font-semibold text-dark-text ml-4 flex-shrink-0">
        {formatTime(hours)}
      </span>
    </div>
  );
}

function DailyEntryRow({ project, task, description, hours }) {
  return (
    <div className="flex items-start justify-between text-sm gap-4">
      <div className="min-w-0">
        <p className="font-montserrat font-semibold text-dark-text truncate">{project}</p>
        {task && <p className="text-xs text-medium-blue mt-0.5 truncate">{task}</p>}
        {description && <p className="text-xs text-mid-gray mt-0.5 truncate">{description}</p>}
      </div>
      <span className="font-montserrat font-semibold text-dark-text flex-shrink-0">
        {formatTime(hours)}
      </span>
    </div>
  );
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
  const [projectDateFrom, setProjectDateFrom] = useState('');
  const [projectDateTo, setProjectDateTo] = useState('');
  const [expandedProjects, setExpandedProjects] = useState([]);

  // Task state
  const [taskData, setTaskData] = useState([]);
  const [taskUserFilter, setTaskUserFilter] = useState('all');
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo, setTaskDateTo] = useState('');
  const [expandedTasks, setExpandedTasks] = useState([]);

  // Daily state
  const [selectedDay, setSelectedDay] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [dailyData, setDailyData] = useState([]);
  const [expandedDailyUsers, setExpandedDailyUsers] = useState([]);

  // Weekly state
  const [weeklyData, setWeeklyData] = useState([]);

  // Shared expand state
  const [expandedUsers, setExpandedUsers] = useState([]);

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
      .select('user_id, hours, project_id, task_id, profiles(full_name), minicrm_projects(name), tasks(name)')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data } = await query;

    const userMap = {};
    (data || []).forEach((entry) => {
      const uid = entry.user_id;
      if (!userMap[uid]) {
        userMap[uid] = {
          name: entry.profiles?.full_name || 'Ismeretlen',
          hours: 0,
          projects: {},
          tasks: {},
        };
      }
      userMap[uid].hours += Number(entry.hours);

      const projectName = entry.minicrm_projects?.name || 'Ismeretlen';
      if (!userMap[uid].projects[projectName]) userMap[uid].projects[projectName] = 0;
      userMap[uid].projects[projectName] += Number(entry.hours);

      const taskName = entry.tasks?.name || 'Nincs feladat';
      if (!userMap[uid].tasks[taskName]) userMap[uid].tasks[taskName] = 0;
      userMap[uid].tasks[taskName] += Number(entry.hours);
    });

    const result = Object.values(userMap)
      .map((u) => ({
        ...u,
        projectList: Object.entries(u.projects)
          .map(([name, hours]) => ({ name, hours }))
          .sort((a, b) => b.hours - a.hours),
        taskList: Object.entries(u.tasks)
          .map(([name, hours]) => ({ name, hours }))
          .sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.hours - a.hours);

    setMonthlyData(result);
  }, [profile, selectedMonth]);

  // Load project data
  const loadProjects = useCallback(async () => {
    if (!profile) return;

    let query = supabase
      .from('time_entries')
      .select('project_id, hours, user_id, task_id, minicrm_projects(name), profiles(full_name), tasks(name)');

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    } else if (projectUserFilter !== 'all') {
      query = query.eq('user_id', projectUserFilter);
    }

    if (projectDateFrom) query = query.gte('entry_date', projectDateFrom);
    if (projectDateTo) query = query.lte('entry_date', projectDateTo);

    const { data } = await query;

    const projectMap = {};
    (data || []).forEach((entry) => {
      const pid = entry.project_id;
      if (!projectMap[pid]) {
        projectMap[pid] = {
          name: entry.minicrm_projects?.name || 'Ismeretlen',
          hours: 0,
          users: {},
          tasks: {},
        };
      }
      projectMap[pid].hours += Number(entry.hours);

      const userName = entry.profiles?.full_name || 'Ismeretlen';
      if (!projectMap[pid].users[userName]) projectMap[pid].users[userName] = 0;
      projectMap[pid].users[userName] += Number(entry.hours);

      const taskName = entry.tasks?.name || 'Nincs feladat';
      if (!projectMap[pid].tasks[taskName]) projectMap[pid].tasks[taskName] = 0;
      projectMap[pid].tasks[taskName] += Number(entry.hours);
    });

    const result = Object.values(projectMap)
      .map((p) => ({
        ...p,
        userList: Object.entries(p.users).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours),
        taskList: Object.entries(p.tasks).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.hours - a.hours);

    setProjectData(result);
    setExpandedProjects([]);
  }, [profile, projectUserFilter, projectDateFrom, projectDateTo]);

  // Load task data
  const loadTasks = useCallback(async () => {
    if (!profile) return;

    let query = supabase
      .from('time_entries')
      .select('task_id, hours, user_id, project_id, tasks(name), profiles(full_name), minicrm_projects(name)');

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    } else if (taskUserFilter !== 'all') {
      query = query.eq('user_id', taskUserFilter);
    }

    if (taskDateFrom) query = query.gte('entry_date', taskDateFrom);
    if (taskDateTo) query = query.lte('entry_date', taskDateTo);

    const { data } = await query;

    const taskMap = {};
    (data || []).forEach((entry) => {
      const taskName = entry.tasks?.name || 'Nincs feladat';
      const key = taskName;
      if (!taskMap[key]) {
        taskMap[key] = {
          name: taskName,
          hours: 0,
          users: {},
          projects: {},
        };
      }
      taskMap[key].hours += Number(entry.hours);

      const userName = entry.profiles?.full_name || 'Ismeretlen';
      if (!taskMap[key].users[userName]) taskMap[key].users[userName] = 0;
      taskMap[key].users[userName] += Number(entry.hours);

      const projectName = entry.minicrm_projects?.name || 'Ismeretlen';
      if (!taskMap[key].projects[projectName]) taskMap[key].projects[projectName] = 0;
      taskMap[key].projects[projectName] += Number(entry.hours);
    });

    const result = Object.values(taskMap)
      .map((t) => ({
        ...t,
        userList: Object.entries(t.users).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours),
        projectList: Object.entries(t.projects).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.hours - a.hours);

    setTaskData(result);
    setExpandedTasks([]);
  }, [profile, taskUserFilter, taskDateFrom, taskDateTo]);

  // Load daily data
  const loadDaily = useCallback(async () => {
    if (!profile) return;

    let query = supabase
      .from('time_entries')
      .select('user_id, hours, description, project_name_snapshot, task_name_snapshot, profiles(full_name), minicrm_projects(name), tasks(name)')
      .eq('entry_date', selectedDay);

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data } = await query;

    const userMap = {};
    (data || []).forEach((entry) => {
      const uid = entry.user_id;
      if (!userMap[uid]) {
        userMap[uid] = {
          name: entry.profiles?.full_name || 'Ismeretlen',
          hours: 0,
          entries: [],
        };
      }
      userMap[uid].hours += Number(entry.hours);
      userMap[uid].entries.push({
        project: entry.project_name_snapshot || entry.minicrm_projects?.name || 'Ismeretlen projekt',
        task: entry.task_name_snapshot || entry.tasks?.name || '',
        description: entry.description || '',
        hours: Number(entry.hours),
      });
    });

    const result = Object.values(userMap)
      .map((u) => ({
        ...u,
        entries: u.entries.sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.hours - a.hours);

    setDailyData(result);
    setExpandedDailyUsers([]);
  }, [profile, selectedDay]);

  // Load weekly data
  const loadWeekly = useCallback(async () => {
    if (!profile) return;

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().split('T')[0]);
    }

    let query = supabase
      .from('time_entries')
      .select('entry_date, hours')
      .gte('entry_date', days[0])
      .lte('entry_date', days[days.length - 1]);

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data } = await query;

    const dayMap = {};
    (data || []).forEach((entry) => {
      if (!dayMap[entry.entry_date]) dayMap[entry.entry_date] = 0;
      dayMap[entry.entry_date] += Number(entry.hours);
    });

    setWeeklyData(
      days.map((date) => {
        const d = new Date(date + 'T00:00:00');
        const dayOfWeek = d.getDay();
        return {
          date,
          label: DAY_NAMES[dayOfWeek],
          hours: dayMap[date] || 0,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          dayNum: d.getDate(),
        };
      })
    );
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'monthly') loadMonthly();
    if (activeTab === 'projects') loadProjects();
    if (activeTab === 'tasks') loadTasks();
    if (activeTab === 'daily') loadDaily();
    if (activeTab === 'weekly') loadWeekly();
  }, [activeTab, loadMonthly, loadProjects, loadTasks, loadDaily, loadWeekly]);

  const toggle = (list, setList, key) => {
    setList((prev) =>
      prev.includes(key) ? prev.filter((n) => n !== key) : [...prev, key]
    );
  };

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

  const maxMonthly = Math.max(...monthlyData.map((u) => u.hours), 1);
  const maxProject = Math.max(...projectData.map((p) => p.hours), 1);
  const maxTask = Math.max(...taskData.map((t) => t.hours), 1);
  const maxDaily = Math.max(...dailyData.map((u) => u.hours), 1);
  const maxWeekly = Math.max(...weeklyData.map((d) => d.hours), 1);

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
            <label className="text-sm font-semibold text-dark-text">Hónap:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-field !w-auto"
            />
          </div>

          {monthlyData.length === 0 ? (
            <p className="text-center text-mid-gray py-8">Nincs adat a kiválasztott hónapra.</p>
          ) : (
            <div className="space-y-3">
              {monthlyData.map((user, i) => (
                <BarRow
                  key={i}
                  label={user.name}
                  hours={user.hours}
                  maxHours={maxMonthly}
                  onClick={() => toggle(expandedUsers, setExpandedUsers, user.name)}
                  expanded={expandedUsers.includes(user.name)}
                >
                  {user.projectList.length > 0 && (
                    <p className="text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider mb-1">Projektek</p>
                  )}
                  {user.projectList.map((p, j) => (
                    <SubRow key={`p-${j}`} label={p.name} hours={p.hours} />
                  ))}
                  {user.taskList.length > 0 && (
                    <p className="text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider mt-3 mb-1">Feladatok</p>
                  )}
                  {user.taskList.map((t, j) => (
                    <SubRow key={`t-${j}`} label={t.name} hours={t.hours} />
                  ))}
                </BarRow>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projects tab */}
      {activeTab === 'projects' && (
        <div className="card">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 mb-6">
            {profile?.role === 'admin' && users.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">Személy</label>
                <select
                  value={projectUserFilter}
                  onChange={(e) => setProjectUserFilter(e.target.value)}
                  className="input-field !w-auto !py-2 text-sm"
                >
                  <option value="all">Mindenki</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">Dátum -tól</label>
              <input
                type="date"
                value={projectDateFrom}
                onChange={(e) => setProjectDateFrom(e.target.value)}
                className="input-field !w-auto !py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">Dátum -ig</label>
              <input
                type="date"
                value={projectDateTo}
                onChange={(e) => setProjectDateTo(e.target.value)}
                className="input-field !w-auto !py-2 text-sm"
              />
            </div>
            {(projectDateFrom || projectDateTo) && (
              <button
                type="button"
                onClick={() => { setProjectDateFrom(''); setProjectDateTo(''); }}
                className="text-xs text-red-500 hover:text-red-700 font-semibold py-2"
              >
                Szűrő törlése
              </button>
            )}
          </div>

          {projectData.length === 0 ? (
            <p className="text-center text-mid-gray py-8">Nincsenek projekt adatok.</p>
          ) : (
            <div className="space-y-3">
              {projectData.map((project, i) => (
                <BarRow
                  key={i}
                  label={project.name}
                  hours={project.hours}
                  maxHours={maxProject}
                  onClick={() => toggle(expandedProjects, setExpandedProjects, project.name)}
                  expanded={expandedProjects.includes(project.name)}
                >
                  {project.userList.length > 0 && (
                    <p className="text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider mb-1">Személyek</p>
                  )}
                  {project.userList.map((u, j) => (
                    <SubRow key={`u-${j}`} label={u.name} hours={u.hours} />
                  ))}
                  {project.taskList.length > 0 && (
                    <p className="text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider mt-3 mb-1">Feladatok</p>
                  )}
                  {project.taskList.map((t, j) => (
                    <SubRow key={`t-${j}`} label={t.name} hours={t.hours} />
                  ))}
                </BarRow>
              ))}
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

      {/* Tasks tab */}
      {activeTab === 'tasks' && (
        <div className="card">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 mb-6">
            {profile?.role === 'admin' && users.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">Személy</label>
                <select
                  value={taskUserFilter}
                  onChange={(e) => setTaskUserFilter(e.target.value)}
                  className="input-field !w-auto !py-2 text-sm"
                >
                  <option value="all">Mindenki</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">Dátum -tól</label>
              <input
                type="date"
                value={taskDateFrom}
                onChange={(e) => setTaskDateFrom(e.target.value)}
                className="input-field !w-auto !py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-mid-gray uppercase tracking-wider block mb-1">Dátum -ig</label>
              <input
                type="date"
                value={taskDateTo}
                onChange={(e) => setTaskDateTo(e.target.value)}
                className="input-field !w-auto !py-2 text-sm"
              />
            </div>
            {(taskDateFrom || taskDateTo) && (
              <button
                type="button"
                onClick={() => { setTaskDateFrom(''); setTaskDateTo(''); }}
                className="text-xs text-red-500 hover:text-red-700 font-semibold py-2"
              >
                Szűrő törlése
              </button>
            )}
          </div>

          {taskData.length === 0 ? (
            <p className="text-center text-mid-gray py-8">Nincsenek feladat adatok.</p>
          ) : (
            <div className="space-y-3">
              {taskData.map((task, i) => (
                <BarRow
                  key={i}
                  label={task.name}
                  hours={task.hours}
                  maxHours={maxTask}
                  onClick={() => toggle(expandedTasks, setExpandedTasks, task.name)}
                  expanded={expandedTasks.includes(task.name)}
                >
                  {task.userList.length > 0 && (
                    <p className="text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider mb-1">Személyek</p>
                  )}
                  {task.userList.map((u, j) => (
                    <SubRow key={`u-${j}`} label={u.name} hours={u.hours} />
                  ))}
                  {task.projectList.length > 0 && (
                    <p className="text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider mt-3 mb-1">Projektek</p>
                  )}
                  {task.projectList.map((p, j) => (
                    <SubRow key={`p-${j}`} label={p.name} hours={p.hours} />
                  ))}
                </BarRow>
              ))}
              <div className="border-t border-gray-200 pt-3 mt-4 flex items-center justify-between">
                <span className="font-montserrat font-bold text-deep-blue">Összesen</span>
                <span className="font-montserrat font-bold text-deep-blue">
                  {formatTime(taskData.reduce((sum, t) => sum + t.hours, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily tab */}
      {activeTab === 'daily' && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                const d = new Date(selectedDay + 'T00:00:00');
                d.setDate(d.getDate() - 1);
                setSelectedDay(d.toISOString().split('T')[0]);
              }}
              className="px-3 py-2 rounded-md border border-gray-200 text-mid-gray hover:text-deep-blue hover:bg-gray-50 transition-all"
              title="Előző nap"
            >
              ‹
            </button>
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="input-field !w-auto"
            />
            <button
              type="button"
              onClick={() => {
                const d = new Date(selectedDay + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                setSelectedDay(d.toISOString().split('T')[0]);
              }}
              className="px-3 py-2 rounded-md border border-gray-200 text-mid-gray hover:text-deep-blue hover:bg-gray-50 transition-all"
              title="Következő nap"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setSelectedDay(new Date().toISOString().split('T')[0])}
              className="text-xs text-medium-blue hover:text-deep-blue font-semibold py-2"
            >
              Ma
            </button>
          </div>

          {dailyData.length === 0 ? (
            <p className="text-center text-mid-gray py-8">Nincs adat a kiválasztott napra.</p>
          ) : (
            <div className="space-y-3">
              {dailyData.map((user, i) => (
                <BarRow
                  key={i}
                  label={user.name}
                  hours={user.hours}
                  maxHours={maxDaily}
                  onClick={() => toggle(expandedDailyUsers, setExpandedDailyUsers, user.name)}
                  expanded={expandedDailyUsers.includes(user.name)}
                >
                  {user.entries.length > 0 && (
                    <p className="text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider mb-1">Bejegyzések</p>
                  )}
                  {user.entries.map((e, j) => (
                    <DailyEntryRow
                      key={j}
                      project={e.project}
                      task={e.task}
                      description={e.description}
                      hours={e.hours}
                    />
                  ))}
                </BarRow>
              ))}
              <div className="border-t border-gray-200 pt-3 mt-4 flex items-center justify-between">
                <span className="font-montserrat font-bold text-deep-blue">Napi összesen</span>
                <span className="font-montserrat font-bold text-deep-blue">
                  {formatTime(dailyData.reduce((sum, u) => sum + u.hours, 0))}
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
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className={`text-xs font-montserrat font-bold mb-1 ${day.hours > 0 ? 'text-medium-blue' : 'text-transparent'}`}>
                  {day.hours > 0 ? formatTimeShort(day.hours) : '0'}
                </span>
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${
                    day.isWeekend ? 'bg-medium-blue/30' : 'bg-gradient-to-t from-deep-blue to-medium-blue'
                  }`}
                  style={{
                    height: day.hours > 0 ? `${Math.max((day.hours / maxWeekly) * 100, 5)}%` : '2px',
                    minHeight: day.hours > 0 ? '8px' : '2px',
                  }}
                />
                <div className="mt-2 text-center">
                  <p className={`text-xs font-montserrat font-semibold ${day.isWeekend ? 'text-gray-400' : 'text-dark-text'}`}>
                    {day.label}
                  </p>
                  <p className="text-[10px] text-mid-gray">{day.dayNum}.</p>
                </div>
              </div>
            ))}
          </div>
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
