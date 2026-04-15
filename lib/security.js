import crypto from 'crypto';

/**
 * Constant-time string comparison. Use for secrets / tokens.
 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a fixed-time comparison to avoid leaking length
    // through timing — compare against itself.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify a Vercel-cron-style bearer token in constant time.
 * Returns true iff the Authorization header matches CRON_SECRET.
 */
export function verifyCronSecret(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;
  return safeEqual(token, expected);
}

/**
 * Verify that a state-changing request originates from the
 * application itself (CSRF defense). Allows same-origin requests
 * and also explicit allow-listed origins (e.g. preview deploys
 * configured via APP_ALLOWED_ORIGINS).
 */
export function verifySameOrigin(request) {
  // Vercel cron requests carry no Origin; they're protected by
  // the cron secret instead, NOT by this function. Callers must
  // check the cron secret first when applicable.
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  if (!host) return false;

  const allowed = new Set();
  // Self
  allowed.add(`https://${host}`);
  allowed.add(`http://${host}`);
  // Public site URL if configured
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) allowed.add(siteUrl.replace(/\/$/, ''));
  // Extra allow-list (comma-separated)
  const extra = process.env.APP_ALLOWED_ORIGINS;
  if (extra) {
    extra.split(',').forEach((o) => {
      const trimmed = o.trim().replace(/\/$/, '');
      if (trimmed) allowed.add(trimmed);
    });
  }

  if (origin) {
    return allowed.has(origin.replace(/\/$/, ''));
  }
  if (referer) {
    try {
      const u = new URL(referer);
      return allowed.has(`${u.protocol}//${u.host}`);
    } catch {
      return false;
    }
  }
  // No Origin and no Referer: this is suspicious for a state-
  // changing browser request. Reject.
  return false;
}

/**
 * HTML-escape a string for safe inclusion in email / HTML output.
 */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
