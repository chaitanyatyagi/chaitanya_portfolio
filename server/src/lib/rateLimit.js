// ---------------------------------------------------------------------------
// Token-bucket rate limiter, in process memory.
//
// Used for coarse abuse protection (per IP): signup, login, password reset and
// a generous global API ceiling. Each API process keeps its own buckets, so
// with N processes the effective limit is up to N× — fine for abuse
// protection, NOT for exact quotas. Exact, cross-process limits (submissions
// per user) are enforced in Postgres instead (see submissions.js), and login
// brute-force is stopped by a per-account lockout stored on the user row.
// Moving these buckets to Redis is the upgrade path when exactness matters.
// ---------------------------------------------------------------------------
import { tooMany } from './errors.js';

export function rateLimit({ name, capacity, perSeconds, key = (req) => req.ip }) {
  const refillPerMs = capacity / (perSeconds * 1000);
  const buckets = new Map(); // id → { tokens, updatedAt }

  // Drop idle buckets so memory can't grow without bound.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - perSeconds * 2000;
    for (const [id, b] of buckets) if (b.updatedAt < cutoff) buckets.delete(id);
  }, Math.max(10_000, perSeconds * 1000));
  sweep.unref();

  return (req, _res, next) => {
    const id = `${name}:${key(req)}`;
    const now = Date.now();
    const b = buckets.get(id) || { tokens: capacity, updatedAt: now };
    b.tokens = Math.min(capacity, b.tokens + (now - b.updatedAt) * refillPerMs);
    b.updatedAt = now;
    if (b.tokens < 1) {
      buckets.set(id, b);
      const retryAfter = Math.ceil((1 - b.tokens) / refillPerMs / 1000);
      return next(tooMany('Too many requests — slow down and try again shortly.', retryAfter));
    }
    b.tokens -= 1;
    buckets.set(id, b);
    next();
  };
}
