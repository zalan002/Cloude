'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { reportError } from '@/lib/reportError';
import { logActivity } from '@/lib/activityLog';

const DEPARTMENTS = [
  'Értékesítés',
  'Jog',
  'Asszisztencia',
  'Könyvelés',
  'Munkaügy',
];

export default function AdminUsersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

      setCurrentProfile(data);
      setLoading(false);
    }
    init();
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    setUsers(data || []);
  }, []);

  useEffect(() => {
    if (currentProfile) loadUsers();
  }, [currentProfile, loadUsers]);

  const toggleRole = async (user) => {
    if (user.id === currentProfile.id) {
      alert('Nem módosíthatod a saját szerepkörödet.');
      return;
    }

    const newRole = user.role === 'admin' ? 'employee' : 'admin';
    if (
      !confirm(
        `Biztosan módosítod ${user.full_name} szerepkörét ${
          newRole === 'admin' ? 'adminra' : 'dolgozóra'
        }?`
      )
    )
      return;

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);

    if (error) {
      alert('Hiba: ' + error.message);
      reportError({ page: 'Felhasználók kezelése', action: 'Szerepkör módosítása', error: error.message });
      return;
    }

    logActivity({
      event_type: 'admin.role_change',
      target_table: 'profiles',
      target_id: user.id,
      details: { user_name: user.full_name, old_role: user.role, new_role: newRole },
    });
    loadUsers();
  };

  const toggleActive = async (user) => {
    if (user.id === currentProfile.id) {
      alert('Nem deaktiválhatod a saját fiókodat.');
      return;
    }

    const newStatus = !user.is_active;
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', user.id);

    if (error) {
      alert('Hiba: ' + error.message);
      reportError({ page: 'Felhasználók kezelése', action: 'Felhasználó aktiválás/deaktiválás', error: error.message });
      return;
    }

    logActivity({
      event_type: 'admin.user_status_change',
      target_table: 'profiles',
      target_id: user.id,
      details: { user_name: user.full_name, new_is_active: newStatus },
    });
    loadUsers();
  };

  const updateDepartment = async (user, department) => {
    const { error } = await supabase
      .from('profiles')
      .update({ department: department || null })
      .eq('id', user.id);

    if (error) {
      alert('Hiba: ' + error.message);
      reportError({ page: 'Felhasználók kezelése', action: 'Részleg módosítása', error: error.message });
      return;
    }

    logActivity({
      event_type: 'admin.department_change',
      target_table: 'profiles',
      target_id: user.id,
      details: { user_name: user.full_name, new_department: department || null },
    });
    loadUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg
          className="spinner w-10 h-10 text-medium-blue"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-montserrat font-bold text-deep-blue mb-6">
        Felhasználók kezelése
      </h1>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-montserrat font-semibold text-medium-blue mb-2">
          Új felhasználó hozzáadása
        </h3>
        <p className="text-sm text-dark-text">
          Új felhasználó létrehozásához kérjük, lépjen kapcsolatba velünk az alábbi email címen:{' '}
          <a
            href="mailto:CONSORTIO@traininghungary.com"
            className="font-semibold text-medium-blue hover:underline"
          >
            CONSORTIO@traininghungary.com
          </a>
        </p>
      </div>

      {/* Users table - desktop */}
      <div className="card hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                  Név
                </th>
                <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                  Email
                </th>
                <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                  Részleg
                </th>
                <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                  Szerepkör
                </th>
                <th className="pb-3 text-xs font-montserrat font-semibold text-mid-gray uppercase tracking-wider">
                  Státusz
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-pale-blue/50">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-medium-blue/10 rounded-full flex items-center justify-center text-medium-blue font-montserrat font-bold text-sm">
                        {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-opensans font-semibold text-dark-text">
                        {u.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-sm font-opensans text-mid-gray">
                    {u.email}
                  </td>
                  <td className="py-3">
                    <select
                      value={u.department || ''}
                      onChange={(e) => updateDepartment(u, e.target.value)}
                      className="text-xs font-montserrat font-semibold px-2 py-1 rounded-lg border border-gray-200 bg-white text-dark-text focus:outline-none focus:ring-1 focus:ring-medium-blue"
                    >
                      <option value="">— Nincs —</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => toggleRole(u)}
                      className={`text-xs font-montserrat font-semibold px-3 py-1 rounded-full transition-all ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {u.role === 'admin' ? 'Admin' : 'Dolgozó'}
                    </button>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`text-xs font-montserrat font-semibold px-3 py-1 rounded-full transition-all ${
                        u.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-500 hover:bg-red-200'
                      }`}
                    >
                      {u.is_active ? 'Aktív' : 'Inaktív'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users cards - mobile */}
      <div className="md:hidden space-y-3">
        {users.map((u) => (
          <div key={u.id} className="card !p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-medium-blue/10 rounded-full flex items-center justify-center text-medium-blue font-montserrat font-bold">
                {u.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-montserrat font-semibold text-dark-text text-sm">
                  {u.full_name}
                </p>
                <p className="text-xs text-mid-gray">{u.email}</p>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-mid-gray font-montserrat block mb-1">Részleg</label>
              <select
                value={u.department || ''}
                onChange={(e) => updateDepartment(u, e.target.value)}
                className="text-xs font-montserrat font-semibold px-2 py-1 rounded-lg border border-gray-200 bg-white text-dark-text focus:outline-none focus:ring-1 focus:ring-medium-blue w-full"
              >
                <option value="">— Nincs —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleRole(u)}
                className={`text-xs font-montserrat font-semibold px-3 py-1 rounded-full ${
                  u.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {u.role === 'admin' ? 'Admin' : 'Dolgozó'}
              </button>
              <button
                onClick={() => toggleActive(u)}
                className={`text-xs font-montserrat font-semibold px-3 py-1 rounded-full ${
                  u.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-500'
                }`}
              >
                {u.is_active ? 'Aktív' : 'Inaktív'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
