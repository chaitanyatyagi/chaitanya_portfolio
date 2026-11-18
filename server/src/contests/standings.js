// ---------------------------------------------------------------------------
// Contest standings: recompute from submissions and store on
// contest_participants, then NOTIFY 'contest_event' so every API process can
// push an update to the browsers watching that contest (docs §12.5).
//
// Used by the grader (inside its verdict transaction), by the reaper, and by
// the API (start / end / new submission). `db` must be a client inside a
// transaction: the advisory lock serializes concurrent refreshes of the same
// contest, and NOTIFY is delivered only if the transaction commits.
//
// Recomputing everything is deliberate: a contest has ≤ 10 players × ≤ 8
// problems and a few dozen submissions, so a full recompute is a sub-millisecond
// pure function — and it can never drift from the submissions, unlike
// incremental counters.
// ---------------------------------------------------------------------------
import { computeStandings } from './rules.js';

export async function refreshStandings(db, contestId) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext('contest:' || $1))", [contestId]);
  const { rows: [contest] } = await db.query('SELECT started_at, ends_at FROM contests WHERE id = $1', [contestId]);
  if (!contest?.started_at) {
    await db.query("SELECT pg_notify('contest_event', $1)", [contestId]);
    return;
  }
  const [problems, players, subs] = await Promise.all([
    db.query('SELECT problem_id, points FROM contest_problems WHERE contest_id = $1', [contestId]),
    db.query("SELECT user_id FROM contest_participants WHERE contest_id = $1 AND state = 'joined'", [contestId]),
    // Only submissions made before the end count — even if graded after it.
    db.query(
      `SELECT s.user_id, s.problem_id, s.created_at, s.status, s.verdict FROM submissions s, contests c
       WHERE c.id = $1 AND s.contest_id = c.id AND s.created_at <= c.ends_at ORDER BY s.created_at, s.id`, [contestId]),
  ]);
  const standings = computeStandings({
    startedAt: contest.started_at.getTime(),
    problems: problems.rows.map((p) => ({ problemId: p.problem_id, points: p.points })),
    participants: players.rows.map((p) => p.user_id),
    submissions: subs.rows.map((s) => ({
      userId: s.user_id, problemId: s.problem_id, createdAt: s.created_at.getTime(), status: s.status, verdict: s.verdict,
    })),
  });
  if (standings.length) {
    await db.query(
      `UPDATE contest_participants cp SET score = v.score, finish_ms = v.finish_ms, solved = v.solved, wrong = v.wrong,
         pending = v.pending, rank = v.rank, detail = v.detail
       FROM unnest($2::uuid[], $3::int[], $4::bigint[], $5::int[], $6::int[], $7::int[], $8::int[], $9::jsonb[])
         AS v(user_id, score, finish_ms, solved, wrong, pending, rank, detail)
       WHERE cp.contest_id = $1 AND cp.user_id = v.user_id`,
      [contestId,
        standings.map((r) => r.userId), standings.map((r) => r.score), standings.map((r) => r.finishMs),
        standings.map((r) => r.solved), standings.map((r) => r.wrong), standings.map((r) => r.pending),
        standings.map((r) => r.rank), standings.map((r) => JSON.stringify(r.detail))]);
  }
  await db.query("SELECT pg_notify('contest_event', $1)", [contestId]);
}
