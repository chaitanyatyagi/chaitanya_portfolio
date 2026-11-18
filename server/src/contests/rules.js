// ---------------------------------------------------------------------------
// Contest rules — pure functions, no I/O (unit-tested in test/contests.test.js).
//
//   pickProblems     draw the contest's problem set (docs §12.3)
//   computeStandings LeetCode/Codeforces-style scoring and ranking (docs §12.4)
// ---------------------------------------------------------------------------
import { randomInt } from 'node:crypto';

export const PENALTY_MS = 5 * 60_000;           // per wrong attempt on a problem you went on to solve
export const CODE_TRACKS = ['sql', 'python', 'pyspark', 'pandas', 'shell'];
export const POOLS = ['unsolved', 'solved', 'both'];
const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// candidates: [{id, difficulty, points, solvedBy}] — solvedBy = how many of the
// participants have already solved it in practice.
//   unsolved → problems nobody in the contest has solved
//   solved   → problems at least one participant has solved (revision)
//   both     → everything, least-solved first (prefers unsolved)
// If the chosen pool is too small, the set is topped up from the rest,
// least-solved first, and `note` says so. Order within each preference tier is
// random; the final set is shown Easy → Hard, like a LeetCode round.
export function pickProblems(candidates, { count, pool }) {
  const mixed = shuffle(candidates);
  const leastSolved = (a, b) => a.solvedBy - b.solvedBy;
  let primary;
  let rest;
  if (pool === 'unsolved') {
    primary = mixed.filter((p) => p.solvedBy === 0);
    rest = mixed.filter((p) => p.solvedBy > 0).sort(leastSolved);
  } else if (pool === 'solved') {
    primary = mixed.filter((p) => p.solvedBy > 0);
    rest = mixed.filter((p) => p.solvedBy === 0);
  } else {
    primary = mixed.sort(leastSolved);
    rest = [];
  }
  const chosen = [...primary, ...rest].slice(0, count);
  const fromPool = Math.min(primary.length, count);
  const note = pool !== 'both' && fromPool < chosen.length
    ? `Only ${fromPool} matching problem${fromPool === 1 ? ' was' : 's were'} ${pool} for ${pool === 'unsolved' ? 'everyone' : 'anyone'} in this contest, so ${chosen.length - fromPool} ${chosen.length - fromPool === 1 ? 'was' : 'were'} added from the rest.`
    : null;
  const order = new Map(chosen.map((p, i) => [p.id, i]));
  chosen.sort((a, b) => (DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]) || (order.get(a.id) - order.get(b.id)));
  return { problems: chosen, note };
}

// Standings from the raw submissions. Rules (LeetCode weekly / ICPC style):
//   • score  = sum of the points of the problems you solved;
//   • finish = time of your last Accepted (from the start) + 5 minutes for
//              every wrong submission on a problem you then solved;
//   • rank by score (higher first), then finish (earlier first); equal score
//     and finish share a rank.
// Wrong attempts on problems you never solve cost nothing. Submissions after
// the first Accepted on a problem are ignored. "Internal Error" (our fault)
// and failed jobs never count. Queued/running submissions are `pending`, so
// the board can say "provisional" until grading catches up.
//
// submissions: [{userId, problemId, createdAt (ms), status, verdict}], sorted by createdAt.
export function computeStandings({ startedAt, problems, participants, submissions }) {
  const pointsOf = new Map(problems.map((p) => [p.problemId, p.points]));
  const rows = new Map(participants.map((userId) => [userId, {
    userId, score: 0, finishMs: 0, solved: 0, wrong: 0, pending: 0, detail: {},
  }]));

  for (const s of submissions) {
    const row = rows.get(s.userId);
    if (!row || !pointsOf.has(s.problemId)) continue;
    const cell = (row.detail[s.problemId] ||= { solvedMs: null, wrong: 0, pending: 0 });
    if (cell.solvedMs != null) continue;                         // already solved: later submissions don't matter
    if (s.status === 'queued' || s.status === 'running') { cell.pending += 1; continue; }
    if (s.status !== 'done' || s.verdict === 'Internal Error') continue;
    if (s.verdict === 'Accepted') cell.solvedMs = Math.max(0, s.createdAt - startedAt);
    else cell.wrong += 1;
  }

  for (const row of rows.values()) {
    let last = 0;
    let penalties = 0;
    for (const [problemId, cell] of Object.entries(row.detail)) {
      row.pending += cell.pending;
      row.wrong += cell.wrong;
      if (cell.solvedMs == null) continue;
      row.solved += 1;
      row.score += pointsOf.get(problemId);
      last = Math.max(last, cell.solvedMs);
      penalties += cell.wrong;
    }
    row.finishMs = row.solved ? last + penalties * PENALTY_MS : 0;
  }

  const ordered = [...rows.values()].sort((a, b) => (b.score - a.score) || (a.finishMs - b.finishMs));
  ordered.forEach((row, i) => {
    const prev = ordered[i - 1];
    row.rank = prev && prev.score === row.score && prev.finishMs === row.finishMs ? prev.rank : i + 1;
  });
  return ordered;
}
