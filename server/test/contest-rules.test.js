// Unit tests for the pure contest rules (no database): problem draw and standings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickProblems, computeStandings, PENALTY_MS } from '../src/contests/rules.js';

const P = (id, difficulty, solvedBy, points = 10) => ({ id, difficulty, points, solvedBy });

test('pickProblems: "unsolved" takes only unsolved problems when there are enough', () => {
  const pool = [P('a', 'Easy', 0), P('b', 'Easy', 2), P('c', 'Medium', 0), P('d', 'Hard', 1), P('e', 'Hard', 0)];
  for (let i = 0; i < 20; i++) {
    const { problems, note } = pickProblems(pool, { count: 3, pool: 'unsolved' });
    assert.deepEqual(problems.map((p) => p.id).sort(), ['a', 'c', 'e']);
    assert.deepEqual(problems.map((p) => p.difficulty), ['Easy', 'Medium', 'Hard']); // shown Easy → Hard
    assert.equal(note, null);
  }
});

test('pickProblems: "unsolved" tops up least-solved first and says so', () => {
  const pool = [P('a', 'Easy', 0), P('b', 'Easy', 3), P('c', 'Medium', 1)];
  const { problems, note } = pickProblems(pool, { count: 2, pool: 'unsolved' });
  assert.deepEqual(problems.map((p) => p.id).sort(), ['a', 'c']);
  assert.match(note, /Only 1 matching problem was unsolved/);
});

test('pickProblems: "both" prefers unsolved; "solved" prefers solved', () => {
  const pool = [P('a', 'Easy', 1), P('b', 'Easy', 0), P('c', 'Easy', 0), P('d', 'Easy', 2)];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(pickProblems(pool, { count: 2, pool: 'both' }).problems.map((p) => p.id).sort(), ['b', 'c']);
    assert.deepEqual(pickProblems(pool, { count: 2, pool: 'solved' }).problems.map((p) => p.id).sort(), ['a', 'd']);
  }
  // Random: over many draws, every equally-preferred problem shows up.
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(pickProblems(pool, { count: 1, pool: 'both' }).problems[0].id);
  assert.deepEqual([...seen].sort(), ['b', 'c']);
});

const MIN = 60_000;
const sub = (userId, problemId, atMin, verdict, status = 'done') => ({ userId, problemId, createdAt: atMin * MIN, status, verdict });

test('standings: score, finish time with 5-minute penalties, rank order', () => {
  const rows = computeStandings({
    startedAt: 0,
    problems: [{ problemId: 'p1', points: 10 }, { problemId: 'p2', points: 20 }],
    participants: ['ann', 'bob', 'cat'],
    submissions: [
      sub('ann', 'p1', 3, 'Wrong Answer'),
      sub('ann', 'p1', 5, 'Accepted'),          // 5 min + 1 penalty
      sub('bob', 'p1', 9, 'Accepted'),          // 9 min, clean
      sub('ann', 'p2', 20, 'Runtime Error'),    // never solved: no penalty
      sub('cat', 'p2', 30, 'Accepted'),         // 20 points beats 10
      sub('bob', 'p1', 40, 'Wrong Answer'),     // after solving: ignored
    ],
  });
  assert.deepEqual(rows.map((r) => [r.userId, r.rank, r.score, r.finishMs / MIN]), [
    ['cat', 1, 20, 30],
    ['bob', 2, 10, 9],
    ['ann', 3, 10, 5 + PENALTY_MS / MIN],
  ]);
  const ann = rows.find((r) => r.userId === 'ann');
  assert.equal(ann.wrong, 2);
  assert.deepEqual(ann.detail.p1, { solvedMs: 5 * MIN, wrong: 1, pending: 0 });
  assert.equal(rows.find((r) => r.userId === 'bob').detail.p1.wrong, 0);
});

test('standings: ties share a rank; Internal Error and failed jobs never count; pending is reported', () => {
  const rows = computeStandings({
    startedAt: 0,
    problems: [{ problemId: 'p1', points: 10 }],
    participants: ['a', 'b', 'c', 'd'],
    submissions: [
      sub('a', 'p1', 1, 'Internal Error'),
      sub('a', 'p1', 2, null, 'failed'),
      sub('a', 'p1', 4, 'Accepted'),
      sub('b', 'p1', 4, 'Accepted'),
      sub('c', 'p1', 6, null, 'queued'),
    ],
  });
  const by = Object.fromEntries(rows.map((r) => [r.userId, r]));
  assert.equal(by.a.rank, 1);
  assert.equal(by.b.rank, 1);                 // same score, same finish
  assert.equal(by.a.finishMs, 4 * MIN);       // no penalty for our errors
  assert.equal(by.c.rank, 3);
  assert.equal(by.c.pending, 1);
  assert.equal(by.d.rank, 3);                 // nothing solved: tied at the bottom
});
