// ---------------------------------------------------------------------------
// Passwords and tokens.
//
// Passwords → scrypt (built into Node, memory-hard, so GPU cracking is
// expensive). It runs on libuv's thread pool, so hashing never blocks the
// event loop; UV_THREADPOOL_SIZE bounds how many hashes run in parallel.
//
// Refresh / reset tokens → 32 random bytes; only their SHA-256 is stored, so
// a database leak doesn't hand out working tokens.
// ---------------------------------------------------------------------------
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const N = 16384; // 2^14 → ~16 MB of memory and ~40 ms per hash
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [algo, n, r, p, saltB64, hashB64] = String(stored).split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(actual, expected);
}

// Verifying against a throwaway hash when the email doesn't exist makes
// "unknown email" and "wrong password" take the same time — so response timing
// can't be used to discover which emails have accounts.
let dummyHash;
export async function burnPasswordCheck(password) {
  dummyHash ||= await hashPassword('not-a-real-password');
  await verifyPassword(password, dummyHash);
}

export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest();
