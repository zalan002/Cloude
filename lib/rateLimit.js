/**
 * In-memory best-effort rate limiter.
 *
 * IMPORTANT: this is per-process, so on Vercel serverless it is
 * NOT a hard guarantee — each Lambda instance has its own map.
 * It still meaningfully blunts abuse (typical attackers hit one
 * warm instance), and it is fast and dependency-free.
 *
 * For production-grade limiting, swap the backing store for
 * Upstash / Redis later — the API of this module will not need
 * to change.
 */

const buckets = new Map();
const SWEEP_AFTER = 10 * 60 * 1000; // 10 min idle entries get GC'd

function sweep(now) {
  for (const [key, entry] of buckets) {
    if (now - entry.last > SWEEP_AFTER) buckets.delete(key);
  }
}

/**
 * Token-bucket-ish counter.
 *
 *   const r = checkRate({ key: `login:${ip}`, limit: 10, windowMs: 60_000 });
 *   if (!r.ok) { return 429; }
 *
 * Returns { ok, remaining, resetAt }.
 */
export function checkRate({ key, limit, windowMs }) {
  const now = Date.now();
  if (buckets.size > 5000) sweep(now);

  let entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { windowStart: now, count: 0, last: now };
    buckets.set(key, entry);
  }
  entry.count += 1;
  entry.last = now;

  const remaining = Math.max(0, limit - entry.count);
  const resetAt = entry.windowStart + windowMs;

  return {
    ok: entry.count <= limit,
    remaining,
    resetAt,
  };
}

/**
 * Best-effort client IP extraction from a Next.js Request.
 */
export function getClientIp(request) {
  if (!request || typeof request.headers?.get !== 'function') return 'unknown';
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}
