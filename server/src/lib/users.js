// ---------------------------------------------------------------------------
// Account creation shared by sign-up and the admin/test-user scripts.
//
// Every account gets a unique public username (3–24 of a–z, 0–9, _;
// unique case-insensitively). It's derived from the name — "Asha Rao" →
// "asharao" — with a random 4-digit suffix if that's taken. Users can change
// it later (PATCH /api/auth/me). Usernames are how people find each other,
// e.g. to invite someone to a contest.
// ---------------------------------------------------------------------------
import { randomInt } from 'node:crypto';

export function baseUsername(name, email) {
  const b = (name || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
  return b.length >= 3 ? b : `${b}user`.slice(0, 18);
}

// Inserts the user; retries with a suffix on a username collision. An email
// collision is rethrown (constraint 'users_email_lower_key') for the caller.
export async function createUser(db, { email, name, passwordHash, role = 'learner' }) {
  const base = baseUsername(name, email);
  for (let attempt = 0; ; attempt++) {
    const username = attempt === 0 ? base : `${base}${randomInt(1000, 10000)}`;
    try {
      const { rows: [user] } = await db.query(
        'INSERT INTO users (email, name, password_hash, username, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [email.toLowerCase(), name, passwordHash, username, role]);
      return user;
    } catch (err) {
      if (err.code !== '23505' || err.constraint === 'users_email_lower_key' || attempt >= 5) throw err;
    }
  }
}
