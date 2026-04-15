import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Inactive accounts are blocked from the entire app.
  // (Middleware also enforces this; this is defense in depth.)
  const isInactive =
    (profile.status && profile.status !== 'active') ||
    (profile.is_active === false);
  if (isInactive) {
    await supabase.auth.signOut();
    redirect('/login?reason=inactive');
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <Sidebar profile={profile} />
      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-[1200px] mx-auto p-4 md:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
