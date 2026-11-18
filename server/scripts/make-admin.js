// ---------------------------------------------------------------------------
// Admin setup.
//   npm run make-admin -- <email>                         promote an existing account
//   npm run make-admin -- <email> <password> [name...]    create (or reset) + promote
//
// Runs against the database directly, so it bypasses the sign-up form's
// password rules — a short password is allowed here (local development),
// with a warning. Use a strong one anywhere real.
// ---------------------------------------------------------------------------
import { query, pool } from '../src/db.js';
import { hashPassword } from '../src/lib/crypto.js';
import { createUser } from '../src/lib/users.js';

const [email, password, ...nameParts] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('usage: npm run make-admin -- <email> [password] [name]');
  process.exit(1);
}

try {
  if (password) {
    if (password.length < 8) console.warn('⚠ Password is shorter than 8 characters — fine for local development, change it before going live.');
    const hash = await hashPassword(password);
    const name = nameParts.join(' ') || email.split('@')[0];
    // Existing account → reset password + promote; otherwise create it (with a
    // generated username, like sign-up does).
    let { rows: [u] } = await query(
      `UPDATE users SET password_hash = $2, role = 'admin', failed_logins = 0, locked_until = NULL, updated_at = now()
       WHERE lower(email) = lower($1) RETURNING email, role, username, false AS created`, [email, hash]);
    if (!u) u = { ...(await createUser({ query }, { email, name, passwordHash: hash, role: 'admin' })), created: true };
    // A new password ends every existing session of this account.
    await query("UPDATE sessions SET revoked_at = now(), revoke_reason = 'password_reset' WHERE user_id = (SELECT id FROM users WHERE lower(email) = lower($1)) AND revoked_at IS NULL", [email]);
    console.log(`✓ ${u.created ? 'Created' : 'Updated'} ${u.email} (@${u.username}) with role ${u.role}. Sign in at /login.`);
  } else {
    const { rows } = await query("UPDATE users SET role = 'admin', updated_at = now() WHERE lower(email) = lower($1) RETURNING email", [email]);
    console.log(rows[0]
      ? `✓ ${rows[0].email} is now an admin (sign out and in again, or wait ≤ 15 min, for it to apply).`
      : `No account for ${email}. Sign up first, or pass a password to create it: npm run make-admin -- ${email} <password>`);
  }
} finally {
  await pool.end();
}
