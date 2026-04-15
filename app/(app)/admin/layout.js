import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status, is_active')
    .eq('id', user.id)
    .single();

  const isInactive =
    !profile ||
    (profile.status && profile.status !== 'active') ||
    profile.is_active === false;
  if (isInactive) redirect('/login?reason=inactive');
  if (profile.role !== 'admin') redirect('/');

  return children;
}
