import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server
 * code AFTER the caller has been authenticated and authorized.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var. Throws if missing
 * so we never silently fall back to anon-key writes.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Resolve { user, profile } for the current request, or return
 * null if the caller is not authenticated. Does NOT throw.
 */
export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status')
    .eq('id', user.id)
    .single();

  return { user, profile, supabase };
}

/**
 * Throws a Response (401/403) if the caller is not an active
 * authenticated user — or, optionally, not an admin.
 */
export async function requireUser({ admin = false } = {}) {
  const session = await getSessionUser();
  if (!session || !session.user) {
    throw new Response(JSON.stringify({ error: 'Nincs bejelentkezve.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!session.profile) {
    throw new Response(JSON.stringify({ error: 'Profil nem található.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (session.profile.status && session.profile.status !== 'active') {
    throw new Response(JSON.stringify({ error: 'A fiók inaktív.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (admin && session.profile.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Csak adminisztrátor.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  return session;
}
