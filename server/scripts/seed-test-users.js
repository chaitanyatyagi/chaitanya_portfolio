// ---------------------------------------------------------------------------
// Test users for trying contests (and anything multi-user) locally.
//   npm run seed:test-users
//
// Creates — or resets the password of — the accounts below. They are listed
// in docs/ARCHITECTURE.md §15 and server/.env.example. Development only: it
// refuses to run with NODE_ENV=production, because the password is public.
// ---------------------------------------------------------------------------
import { query, pool } from '../src/db.js';
import { hashPassword } from '../src/lib/crypto.js';
import { createUser } from '../src/lib/users.js';

export const TEST_PASSWORD = 'DrillTest#2026';
export const TEST_USERS = [
  { email: 'asha.rao@datadrill.test', name: 'Asha Rao' },
  { email: 'ben.carter@datadrill.test', name: 'Ben Carter' },
  { email: 'chen.li@datadrill.test', name: 'Chen Li' },
];

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to create test users in production.');
  process.exit(1);
}

try {
  const hash = await hashPassword(TEST_PASSWORD);
  for (const t of TEST_USERS) {
    let { rows: [u] } = await query(
      `UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, updated_at = now()
       WHERE lower(email) = lower($1) RETURNING email, username`, [t.email, hash]);
    const verb = u ? 'reset' : 'created';
    if (!u) u = await createUser({ query }, { email: t.email, name: t.name, passwordHash: hash });
    console.log(`✓ ${verb.padEnd(7)} ${u.email.padEnd(28)} @${u.username}`);
  }
  console.log(`Password for all of them: ${TEST_PASSWORD}`);
} finally {
  await pool.end();
}
