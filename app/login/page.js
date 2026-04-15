'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logClientAudit } from '@/lib/audit';

function LoginPageInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'inactive') {
      setError('A fiókod inaktív. Kérjük, lépj kapcsolatba az adminisztrátorral.');
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Hibás email vagy jelszó');
        // Best-effort client audit (works only if RPC is callable
        // without an active session; otherwise the catch swallows).
        return;
      }

      // Successful login → client-side audit before navigation.
      // The RPC runs SECURITY DEFINER under the just-acquired session.
      await logClientAudit({
        eventType: 'auth.login.success',
        severity: 'info',
        entityType: 'auth',
      });

      router.push('/');
      router.refresh();
    } catch {
      setError('Váratlan hiba történt. Kérjük, próbáld újra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-deep-blue via-deep-blue to-medium-blue flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-montserrat font-bold text-white tracking-wide">
            CONSORTIO
          </h1>
          <p className="text-xl font-montserrat font-light text-white/70 mt-1">
            Munkaidő nyilvántartó
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="text-2xl font-montserrat font-semibold text-deep-blue text-center mb-6">
            Bejelentkezés
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-dark-text mb-2 font-opensans"
              >
                Email cím
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pelda@consortio.hu"
                required
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-dark-text mb-2 font-opensans"
              >
                Jelszó
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-field"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg
                    className="spinner w-5 h-5"
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
                  Bejelentkezés...
                </>
              ) : (
                'Bejelentkezés'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-mid-gray mt-6">
            A fiókot az adminisztrátor hozza létre.
          </p>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          &copy; {new Date().getFullYear()} Training Hungary Kft. Minden jog fenntartva.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
