// ---------------------------------------------------------------------------
// /api/auth — accounts and sessions.
//
//   POST /signup            create account → signed in
//   POST /login             email + password → signed in
//   POST /refresh           rotate refresh token → new access token
//   POST /logout            revoke this device's session
//   POST /logout-all        revoke every session of this user
//   GET  /me                current user
//   PATCH /me               update display name
//   POST /change-password   (signed in) → revokes other sessions
//   POST /forgot-password   email a reset link (always 200 — no account probing)
//   POST /reset-password    token + new password → revokes all sessions
// ---------------------------------------------------------------------------
import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { query, tx } from '../db.js';
import { handle, badRequest, conflict, unauthenticated, tooMany } from '../lib/errors.js';
import { hashPassword, verifyPassword, burnPasswordCheck, randomToken, sha256 } from '../lib/crypto.js';
import { rateLimit } from '../lib/rateLimit.js';
import { createUser } from '../lib/users.js';
import { signAccessToken, setAuthCookies, clearAuthCookies, requireAuth, REFRESH_COOKIE } from '../middleware/auth.js';
import { sendMail } from '../../mailer.js';

export const authRouter = express.Router();

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const password = z.string().min(8, 'Password must be at least 8 characters.').max(128, 'Password is too long.');
const name = z.string().trim().min(1, 'Enter your name.').max(80);

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at,
  username: u.username, headline: u.headline ?? '', points: u.points ?? 0,
});

// Usernames: 3–24 chars of a–z, 0–9, _ (case-insensitive unique). New
// accounts get one derived from their name (lib/users.js).
const username = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'Username: 3–24 characters, letters, numbers and _ only.');

// Creates a session row and returns the plaintext refresh token (sent once,
// in a cookie; only its hash is stored).
async function createSession(db, userId, req, familyId = crypto.randomUUID()) {
  const token = randomToken();
  await db.query(
    `INSERT INTO sessions (user_id, family_id, refresh_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, now() + make_interval(days => $4), $5, $6)`,
    [userId, familyId, sha256(token), config.auth.refreshTtlDays, String(req.get('user-agent') || '').slice(0, 300), req.ip],
  );
  return token;
}

async function signIn(res, req, user, db = { query }) {
  const refreshToken = await createSession(db, user.id, req);
  setAuthCookies(res, { accessToken: signAccessToken(user), refreshToken });
}

// Per-IP limits (approximate across processes — see rateLimit.js).
const signupLimit = rateLimit({ name: 'signup', capacity: config.limits.signupPer10Min, perSeconds: 600 });
const loginLimit = rateLimit({ name: 'login', capacity: config.limits.loginPer5Min, perSeconds: 300 });
const resetLimit = rateLimit({ name: 'reset', capacity: config.limits.resetPer15Min, perSeconds: 900 });

authRouter.post('/signup', signupLimit, handle(async (req, res) => {
  const body = z.object({ name, email, password }).parse(req.body);
  const passwordHash = await hashPassword(body.password);
  let user;
  try {
    user = await createUser({ query }, { email: body.email, name: body.name, passwordHash });
  } catch (err) {
    if (err.constraint === 'users_email_lower_key') throw conflict('An account with this email already exists — sign in instead.');
    throw err;
  }
  await signIn(res, req, user);
  res.status(201).json({ user: publicUser(user) });
}));

authRouter.post('/login', loginLimit, handle(async (req, res) => {
  const body = z.object({ email, password: z.string().min(1).max(128) }).parse(req.body);
  const { rows: [user] } = await query('SELECT * FROM users WHERE lower(email) = $1', [body.email]);
  const invalid = () => unauthenticated('Incorrect email or password.');

  if (!user) {
    await burnPasswordCheck(body.password); // equal timing for unknown emails
    throw invalid();
  }
  if (user.locked_until && user.locked_until > new Date()) {
    const minutes = Math.ceil((user.locked_until - Date.now()) / 60_000);
    throw tooMany(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`, minutes * 60);
  }
  if (!(await verifyPassword(body.password, user.password_hash))) {
    // Per-account lockout lives in Postgres, so it holds across every API process.
    await query(
      `UPDATE users SET
         failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
         locked_until  = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
       WHERE id = $1`,
      [user.id, config.auth.maxFailedLogins, config.auth.lockoutMinutes],
    );
    throw invalid();
  }
  if (user.failed_logins || user.locked_until) {
    await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);
  }
  await signIn(res, req, user);
  res.json({ user: publicUser(user) });
}));

// Refresh-token rotation with reuse detection:
//   valid token      → revoke it, issue a new one in the same family;
//   revoked token    → someone replayed an old token: revoke the whole family
//                      (both the thief and the victim must sign in again);
//   recently ROTATED → two tabs refreshed at once; tolerate it (grace window)
//                      and just issue a new access token — but only if the
//                      family is still alive. Tokens revoked by logout,
//                      password change or theft detection get no grace.
const REUSE_GRACE_SECONDS = 30;
authRouter.post('/refresh', handle(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw unauthenticated('Session expired — please sign in again.');
  const result = await tx(async (db) => {
    const { rows: [s] } = await db.query(
      `SELECT s.*, u.role, u.name, u.email, u.created_at AS user_created_at,
              (s.revoke_reason = 'rotated'
               AND s.revoked_at > now() - make_interval(secs => $2)
               AND EXISTS (SELECT 1 FROM sessions f WHERE f.family_id = s.family_id AND f.revoked_at IS NULL)) AS in_grace
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.refresh_hash = $1 FOR UPDATE OF s`,
      [sha256(token), REUSE_GRACE_SECONDS],
    );
    if (!s || s.expires_at < new Date()) return { error: 'expired' };
    const user = { id: s.user_id, role: s.role, name: s.name, email: s.email, created_at: s.user_created_at };
    if (s.revoked_at) {
      if (s.in_grace) return { user, refreshToken: null };
      await db.query("UPDATE sessions SET revoked_at = now(), revoke_reason = 'reuse_detected' WHERE family_id = $1 AND revoked_at IS NULL", [s.family_id]);
      logger.warn({ userId: s.user_id, family: s.family_id }, 'refresh token reuse detected — session family revoked');
      return { error: 'reuse' };
    }
    await db.query("UPDATE sessions SET revoked_at = now(), revoke_reason = 'rotated' WHERE id = $1", [s.id]);
    const refreshToken = await createSession(db, s.user_id, req, s.family_id);
    return { user, refreshToken };
  });
  if (result.error) {
    clearAuthCookies(res);
    throw unauthenticated('Session expired — please sign in again.');
  }
  setAuthCookies(res, { accessToken: signAccessToken(result.user), refreshToken: result.refreshToken });
  res.json({ user: publicUser(result.user) });
}));

authRouter.post('/logout', handle(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await query("UPDATE sessions SET revoked_at = now(), revoke_reason = 'logout' WHERE refresh_hash = $1 AND revoked_at IS NULL", [sha256(token)]);
  clearAuthCookies(res);
  res.status(204).end();
}));

authRouter.post('/logout-all', requireAuth, handle(async (req, res) => {
  await query("UPDATE sessions SET revoked_at = now(), revoke_reason = 'logout_all' WHERE user_id = $1 AND revoked_at IS NULL", [req.user.id]);
  clearAuthCookies(res);
  res.status(204).end();
}));

authRouter.get('/me', requireAuth, handle(async (req, res) => {
  const { rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user) throw unauthenticated();
  res.json({ user: publicUser(user) });
}));

authRouter.patch('/me', requireAuth, handle(async (req, res) => {
  const body = z.object({
    name: name.optional(),
    username: username.optional(),
    headline: z.string().trim().max(80, 'Headline: 80 characters max.').optional(),
  }).parse(req.body);
  try {
    const { rows: [user] } = await query(
      `UPDATE users SET name = coalesce($2, name), username = coalesce($3, username),
         headline = coalesce($4, headline), updated_at = now() WHERE id = $1 RETURNING *`,
      [req.user.id, body.name ?? null, body.username ?? null, body.headline ?? null]);
    res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') throw conflict('That username is taken — try another.');
    throw err;
  }
}));

authRouter.post('/change-password', requireAuth, handle(async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).parse(req.body);
  const { rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user || !(await verifyPassword(body.currentPassword, user.password_hash))) throw badRequest('Current password is incorrect.');
  const hash = await hashPassword(body.newPassword);
  await tx(async (db) => {
    await db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [user.id, hash]);
    await db.query("UPDATE sessions SET revoked_at = now(), revoke_reason = 'password_change' WHERE user_id = $1 AND revoked_at IS NULL", [user.id]);
    const refreshToken = await createSession(db, user.id, req);
    setAuthCookies(res, { accessToken: signAccessToken(user), refreshToken });
  });
  res.json({ ok: true });
}));

authRouter.post('/forgot-password', resetLimit, handle(async (req, res) => {
  const body = z.object({ email }).parse(req.body);
  const { rows: [user] } = await query('SELECT id, name, email FROM users WHERE lower(email) = $1', [body.email]);
  if (user) {
    const token = randomToken();
    await query(
      `INSERT INTO password_resets (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [sha256(token), user.id, config.auth.resetTokenMinutes],
    );
    const link = `${config.appUrl}/reset-password?token=${token}`;
    const mail = await sendMail({
      to: user.email,
      subject: 'Reset your DataDrill password',
      text: `Hi ${user.name},\n\nReset your password here (valid for ${config.auth.resetTokenMinutes} minutes):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
      html: `<p>Hi ${user.name},</p><p><a href="${link}">Reset your password</a> — valid for ${config.auth.resetTokenMinutes} minutes.</p><p>If you didn't ask for this, ignore this email.</p>`,
    });
    // Without SMTP (local dev) the link goes to the server log instead.
    if (!mail.sent) logger.warn({ userId: user.id, link: config.isProd ? undefined : link, error: mail.error }, 'password reset email not sent');
  }
  // Same response whether or not the account exists.
  res.json({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
}));

authRouter.post('/reset-password', resetLimit, handle(async (req, res) => {
  const body = z.object({ token: z.string().min(20).max(200), password }).parse(req.body);
  const hash = await hashPassword(body.password);
  const ok = await tx(async (db) => {
    const { rows: [reset] } = await db.query(
      `SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [sha256(body.token)],
    );
    if (!reset) return false;
    await db.query('UPDATE password_resets SET used_at = now() WHERE token_hash = $1', [reset.token_hash]);
    await db.query('UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1', [reset.user_id, hash]);
    await db.query("UPDATE sessions SET revoked_at = now(), revoke_reason = 'password_reset' WHERE user_id = $1 AND revoked_at IS NULL", [reset.user_id]);
    return true;
  });
  if (!ok) throw badRequest('This reset link is invalid or has expired — request a new one.');
  clearAuthCookies(res);
  res.json({ ok: true, message: 'Password updated — sign in with your new password.' });
}));
