// Static guards for design decisions that must not regress (docs §9.5, §13.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { SERVER_DIR, REPO_DIR } from '../src/config.js';

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  if (f === 'node_modules' || f === 'wheels') return [];
  return statSync(p).isDirectory() ? walk(p) : /\.(m?js|jsx)$/.test(f) ? [p] : [];
});

test('runtime code never imports problem files — PostgreSQL is the only runtime store', () => {
  for (const file of [...walk(path.join(SERVER_DIR, 'src')), ...walk(path.join(SERVER_DIR, 'grader'))]) {
    assert.ok(!/content\/problems/.test(readFileSync(file, 'utf8')), `${path.relative(SERVER_DIR, file)} imports problem content`);
  }
});

test('the browser bundle never imports server content (hidden tests and solutions stay server-side)', () => {
  for (const file of walk(path.join(REPO_DIR, 'src'))) {
    assert.ok(!/server\/content|content\/problems/.test(readFileSync(file, 'utf8')), `${path.relative(REPO_DIR, file)} imports server content`);
  }
});

test('API request paths never aggregate over the whole submissions table', () => {
  const store = readFileSync(path.join(SERVER_DIR, 'src', 'content', 'store.js'), 'utf8');
  assert.ok(!/FROM submissions GROUP BY/i.test(store), 'problem stats must come from problem_stats, not a full GROUP BY');
});
