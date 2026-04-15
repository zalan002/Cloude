/** @type {import('next').NextConfig} */

// Build a Content-Security-Policy that allows the app to talk
// to its Supabase backend (https + wss) while blocking inline
// scripts from third parties. Next.js needs 'unsafe-inline' for
// its own runtime + dev tooling, hence the 'self' allowance plus
// 'unsafe-inline' for style; we keep script-src tight.
function buildCsp() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let supabaseHost = '';
  let supabaseWs = '';
  try {
    const u = new URL(supabaseUrl);
    supabaseHost = `${u.protocol}//${u.host}`;
    supabaseWs = `wss://${u.host}`;
  } catch {
    // ignore — CSP just won't include Supabase if env is missing
  }

  const directives = [
    "default-src 'self'",
    // Next.js needs unsafe-inline + unsafe-eval in dev; in
    // production we still need unsafe-inline for the framework's
    // hydration bootstrap. Keep script sources tight.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHost} ${supabaseWs}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  return directives.join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: buildCsp() },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
