// ---------------------------------------------------------------------------
// Authentication & authorization.
//
// Two cookies, both httpOnly (JavaScript can't read them, so an XSS bug can't
// steal them):
//   dd_at  access token  — signed JWT, 15 min, sent to every /api route.
//          Verified with the secret alone: NO database lookup per request,
//          which is what keeps authenticated reads cheap at scale.
//   dd_rt  refresh token — random opaque string, 30 days, sent ONLY to
//          /api/auth (narrow cookie path), checked against the sessions table.
//
// Authorization is role-based: 'learner' (default) and 'admin'.
// ---------------------------------------------------------------------------
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthenticated, forbidden } from '../lib/errors.js';

export const ACCESS_COOKIE = 'dd_at';
export const REFRESH_COOKIE = 'dd_rt';

const cookieBase = () => ({ httpOnly: true, secure: config.auth.cookieSecure, sameSite: 'lax' });

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.auth.jwtSecret, {
    expiresIn: config.auth.accessTtlSec,
    issuer: 'datadrill',
    algorithm: 'HS256',
  });
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(), path: '/api', maxAge: config.auth.accessTtlSec * 1000 });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(), path: '/api/auth', maxAge: config.auth.refreshTtlDays * 86_400_000 });
  }
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/auth' });
}

// Reads the access cookie if present. Never rejects: anonymous requests pass
// through with req.user = null; routes decide with requireAuth/requireRole.
export function authenticate(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[ACCESS_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret, { issuer: 'datadrill', algorithms: ['HS256'] });
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Expired or tampered → treat as anonymous; the client refreshes on 401.
    }
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthenticated());
  next();
}

export const requireRole = (role) => (req, _res, next) => {
  if (!req.user) return next(unauthenticated());
  if (req.user.role !== role) return next(forbidden());
  next();
};
