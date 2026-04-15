import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Apply security headers to every response we return from
// middleware. next.config.js also sets headers via the headers()
// function for normal responses; this covers redirects too.
function applySecurityHeaders(response) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  return response;
}

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // For API routes we only apply security headers — auth is
  // enforced inside each route handler, and cron routes are
  // protected by their own bearer token instead of a session.
  if (pathname.startsWith('/api/')) {
    return applySecurityHeaders(supabaseResponse);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → force /login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  // Logged in but profile is inactive / suspended → block everything
  // except /login (so they can sign out and try again).
  if (user && pathname !== '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || (profile.status && profile.status !== 'active')) {
      // Sign them out and bounce to login.
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'inactive');
      return applySecurityHeaders(NextResponse.redirect(url));
    }
  }

  // Logged in and on /login → go home
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    // We intentionally include /api/ now so security headers are
    // applied to API responses too (the auth gates inside API
    // routes still do their own checks).
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
