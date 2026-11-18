// ---------------------------------------------------------------------------
// Profiles & leaderboard (public, like LeetCode / Codeforces profiles).
//
//   GET /api/users/:username/profile?tz=Asia/Kolkata   everything the profile page shows
//   GET /api/leaderboard                                top users by points
//   GET /api/users/search?q=ash                         username prefix search (signed in; contest invites)
//
// What's public: name, username, headline, join date, points, rank, solved
// counts, activity calendar, skills, badges, recent ACCEPTED problems,
// finished contests (rank, score).
// Owner-only: the full recent-submission list (with verdicts).
// Never: email, code.
//
// Rank uses the denormalized users.points (kept in step by the grader inside
// the verdict transaction), so "1 + users with more points" is an index scan,
// not a sum over every submission.
// ---------------------------------------------------------------------------
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { handle, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { createCache } from '../lib/cache.js';

export const profileRouter = express.Router();

const DAY_MS = 86_400_000;
const isoDay = (d) => d.toISOString().slice(0, 10);

// Learner-chosen IANA zone for the calendar ("Asia/Kolkata"); anything odd → UTC.
const safeTz = (tz) => (typeof tz === 'string' && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz) ? tz : 'UTC');

function streaks(activeDays, today) {
  const set = new Set(activeDays);
  let max = 0;
  let run = 0;
  let prev = null;
  for (const d of [...set].sort()) {
    run = prev && Date.parse(d) - Date.parse(prev) === DAY_MS ? run + 1 : 1;
    max = Math.max(max, run);
    prev = d;
  }
  // Current streak counts back from today — or from yesterday, so a streak
  // isn't shown as broken before the learner has had a chance to practise today.
  let current = 0;
  let cursor = set.has(today) ? Date.parse(today) : Date.parse(today) - DAY_MS;
  while (set.has(isoDay(new Date(cursor)))) { current += 1; cursor -= DAY_MS; }
  return { max, current };
}

const BADGES = [
  { id: 'first-solve', name: 'First Blood', description: 'Solve your first problem', test: (s) => s.solvedTotal >= 1 },
  { id: 'first-try', name: 'Clean Run', description: 'Solve a problem on the first attempt', test: (s) => s.firstTry >= 1 },
  { id: 'hat-trick', name: 'Hat-trick', description: 'Solve 3 problems', test: (s) => s.solvedTotal >= 3 },
  { id: 'polyglot', name: 'Polyglot', description: 'Solve problems in 3 different tracks', test: (s) => s.tracksSolved >= 3 },
  { id: 'medium-rare', name: 'Medium Rare', description: 'Solve a Medium problem', test: (s) => s.solved.Medium >= 1 },
  { id: 'hard-mode', name: 'Hard Mode', description: 'Solve a Hard problem', test: (s) => s.solved.Hard >= 1 },
  { id: 'streak-3', name: 'On a Roll', description: 'Practise 3 days in a row', test: (s) => s.maxStreak >= 3 },
  { id: 'streak-7', name: 'Week Warrior', description: 'Practise 7 days in a row', test: (s) => s.maxStreak >= 7 },
  { id: 'scholar', name: 'Scholar', description: 'Complete 5 course modules', test: (s) => s.modulesCompleted >= 5 },
  { id: 'century', name: 'Century', description: 'Earn 100 points', test: (s) => s.points >= 100 },
];

const profileParams = z.object({ username: z.string().min(1).max(64) });
const profileQuery = z.object({ tz: z.string().max(64).optional() });

profileRouter.get('/users/:username/profile', handle(async (req, res) => {
  const { username } = profileParams.parse(req.params);
  const { tz: tzParam } = profileQuery.parse(req.query);
  const { rows: [u] } = await query(
    'SELECT id, name, username, headline, points, created_at FROM users WHERE lower(username) = lower($1)', [username]);
  if (!u) throw notFound('No user with that username.');
  const isMe = req.user?.id === u.id;
  let tz = safeTz(tzParam);
  try { await query('SELECT now() AT TIME ZONE $1', [tz]); } catch { tz = 'UTC'; }

  const [rank, totals, solvedRows, attempting, subStats, calendar, timeline, skills, patterns, recentAc, recentAll, learning, contests] = await Promise.all([
    query('SELECT (SELECT count(*) FROM users WHERE points > $1) + 1 AS rank, (SELECT count(*) FROM users) AS users', [u.points]),
    query(`SELECT p.track_id, t.title, t.position, p.difficulty, count(*) AS n FROM problems p JOIN tracks t ON t.id = p.track_id
           WHERE p.published GROUP BY p.track_id, t.title, t.position, p.difficulty`),
    query(`SELECT p.track_id, p.difficulty, count(*) AS n, sum(up.points) AS points,
                  count(*) FILTER (WHERE up.solved_attempt = 1) AS first_try
           FROM user_problems up JOIN problems p ON p.id = up.problem_id
           WHERE up.user_id = $1 AND up.status = 'solved' GROUP BY p.track_id, p.difficulty`, [u.id]),
    query("SELECT count(*) AS n FROM user_problems WHERE user_id = $1 AND status = 'attempted'", [u.id]),
    query(`SELECT count(*) AS submissions, count(*) FILTER (WHERE verdict = 'Accepted') AS accepted
           FROM submissions WHERE user_id = $1 AND status = 'done'`, [u.id]),
    query(`SELECT to_char(date_trunc('day', created_at AT TIME ZONE $2), 'YYYY-MM-DD') AS day, count(*) AS n
           FROM submissions WHERE user_id = $1 AND created_at > now() - interval '366 days'
           GROUP BY 1 ORDER BY 1`, [u.id, tz]),
    query(`SELECT to_char(up.solved_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day, up.points, p.title, p.id
           FROM user_problems up JOIN problems p ON p.id = up.problem_id
           WHERE up.user_id = $1 AND up.solved_at IS NOT NULL ORDER BY up.solved_at`, [u.id, tz]),
    query(`SELECT p.track_id, unnest(p.topics) AS topic, count(*) AS n FROM user_problems up JOIN problems p ON p.id = up.problem_id
           WHERE up.user_id = $1 AND up.status = 'solved' GROUP BY 1, 2 ORDER BY n DESC, topic`, [u.id]),
    query(`SELECT unnest(p.patterns) AS pattern, count(*) AS n FROM user_problems up JOIN problems p ON p.id = up.problem_id
           WHERE up.user_id = $1 AND up.status = 'solved' GROUP BY 1 ORDER BY n DESC, pattern`, [u.id]),
    query(`SELECT DISTINCT ON (s.problem_id) s.problem_id, p.title, p.track_id, p.difficulty, s.finished_at, up.points
           FROM submissions s JOIN problems p ON p.id = s.problem_id
           JOIN user_problems up ON up.user_id = s.user_id AND up.problem_id = s.problem_id
           WHERE s.user_id = $1 AND s.verdict = 'Accepted' ORDER BY s.problem_id, s.finished_at DESC`, [u.id]),
    isMe ? query(`SELECT s.id, s.problem_id, p.title, p.track_id, s.status, s.verdict, s.passed, s.total, s.points_awarded, s.attempt_no, s.created_at
                  FROM submissions s JOIN problems p ON p.id = s.problem_id
                  WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 20`, [u.id]) : Promise.resolve({ rows: [] }),
    query(`SELECT c.id, c.title, count(m.slug) AS total, count(mp.module_slug) AS done
           FROM courses c JOIN course_modules m ON m.course_id = c.id
           LEFT JOIN module_progress mp ON mp.module_slug = m.slug AND mp.user_id = $1
           WHERE c.published GROUP BY c.id, c.title, c.position ORDER BY c.position`, [u.id]),
    // Finished contests only (a running one would leak live standings).
    query(`SELECT c.code, c.title, c.mode, c.started_at, c.ends_at, cp.rank, cp.score, cp.solved, cp.finish_ms,
                  (SELECT count(*)::int FROM contest_participants x WHERE x.contest_id = c.id AND x.state = 'joined') AS players,
                  (SELECT count(*)::int FROM contest_problems x WHERE x.contest_id = c.id) AS problems
           FROM contest_participants cp JOIN contests c ON c.id = cp.contest_id
           WHERE cp.user_id = $1 AND cp.state = 'joined' AND c.status = 'live' AND c.ends_at <= now()
           ORDER BY c.ends_at DESC`, [u.id]),
  ]);

  // Solved vs available, by difficulty and by track.
  const available = { Easy: 0, Medium: 0, Hard: 0 };
  const tracks = {};
  for (const r of totals.rows) {
    available[r.difficulty] += r.n;
    (tracks[r.track_id] ||= { id: r.track_id, title: r.title, position: r.position, total: 0, solved: 0, points: 0 }).total += r.n;
  }
  const solved = { Easy: 0, Medium: 0, Hard: 0 };
  let firstTry = 0;
  for (const r of solvedRows.rows) {
    solved[r.difficulty] += r.n;
    firstTry += r.first_try;
    if (tracks[r.track_id]) { tracks[r.track_id].solved += r.n; tracks[r.track_id].points += Number(r.points); }
  }
  const solvedTotal = solved.Easy + solved.Medium + solved.Hard;

  // Calendar: last 365 days (in the viewer-chosen zone), zero-filled client-side.
  const days = calendar.rows.map((r) => ({ date: r.day, count: r.n }));
  const today = (await query("SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS d", [tz])).rows[0].d;
  const st = streaks(days.filter((d) => d.count > 0).map((d) => d.date), today);

  let cumulative = 0;
  const pointsTimeline = timeline.rows.map((r) => ({ date: r.day, points: r.points, cumulative: (cumulative += r.points), problem: r.title, problemId: r.id }));

  const modulesCompleted = learning.rows.reduce((n, c) => n + c.done, 0);
  const badgeStats = { solvedTotal, solved, firstTry, tracksSolved: Object.values(tracks).filter((t) => t.solved).length, maxStreak: st.max, modulesCompleted, points: u.points };

  res.json({
    user: { name: u.name, username: u.username, headline: u.headline, joinedAt: u.created_at, isMe },
    stats: {
      points: u.points,
      rank: u.points > 0 ? rank.rows[0].rank : null,
      totalUsers: rank.rows[0].users,
      solved: { ...solved, total: solvedTotal },
      available: { ...available, total: available.Easy + available.Medium + available.Hard },
      attempting: attempting.rows[0].n,
      submissions: subStats.rows[0].submissions,
      accepted: subStats.rows[0].accepted,
      acceptance: subStats.rows[0].submissions ? Math.round((subStats.rows[0].accepted / subStats.rows[0].submissions) * 1000) / 10 : null,
      firstTry,
    },
    byTrack: Object.values(tracks).sort((a, b) => a.position - b.position).map(({ position, ...t }) => t),
    calendar: {
      timezone: tz,
      today,
      days,
      total: days.reduce((n, d) => n + d.count, 0),
      activeDays: days.filter((d) => d.count > 0).length,
      maxStreak: st.max,
      currentStreak: st.current,
    },
    pointsTimeline,
    skills: {
      topics: skills.rows.map((r) => ({ track: r.track_id, name: r.topic, count: r.n })),
      patterns: patterns.rows.map((r) => ({ name: r.pattern, count: r.n })),
    },
    recentAccepted: recentAc.rows
      .sort((a, b) => b.finished_at - a.finished_at).slice(0, 15)
      .map((r) => ({ problemId: r.problem_id, title: r.title, track: r.track_id, difficulty: r.difficulty, at: r.finished_at, points: r.points })),
    recentSubmissions: recentAll.rows.map((r) => ({
      id: r.id, problemId: r.problem_id, title: r.title, track: r.track_id, status: r.status, verdict: r.verdict,
      passed: r.passed, total: r.total, points: r.points_awarded, attempt: r.attempt_no, at: r.created_at,
    })),
    badges: BADGES.map(({ test, ...b }) => ({ ...b, earned: test(badgeStats) })),
    contests: {
      played: contests.rows.length,
      score: contests.rows.reduce((n, c) => n + c.score, 0),
      wins: contests.rows.filter((c) => c.mode === 'group' && c.rank === 1 && c.score > 0).length,
      bestRank: contests.rows.filter((c) => c.mode === 'group').reduce((b, c) => (c.rank && (b == null || c.rank < b) ? c.rank : b), null),
      recent: contests.rows.slice(0, 10).map((c) => ({
        code: c.code, title: c.title, mode: c.mode, endedAt: c.ends_at, rank: c.rank, players: c.players,
        score: c.score, solved: c.solved, problems: c.problems, finishMs: Number(c.finish_ms),
      })),
    },
    learning: { modulesCompleted, courses: learning.rows.map((c) => ({ id: c.id, title: c.title, done: c.done, total: c.total })) },
  });
}));

// Shared by everyone, so cached briefly per process.
const boardCache = createCache({ maxEntries: 4 });
profileRouter.get('/leaderboard', handle(async (_req, res) => {
  const rows = await boardCache.getOrLoad('top', 30_000, async () => (await query(
    `SELECT u.username, u.name, u.points,
            (SELECT count(*) FROM user_problems up WHERE up.user_id = u.id AND up.status = 'solved') AS solved
     FROM users u WHERE u.points > 0
     ORDER BY u.points DESC, solved DESC, u.created_at ASC LIMIT 100`)).rows);
  let rank = 0;
  let prev = null;
  res.json({ leaders: rows.map((r, i) => {
    if (r.points !== prev) { rank = i + 1; prev = r.points; } // ties share a rank
    return { rank, username: r.username, name: r.name, points: r.points, solved: r.solved };
  }) });
}));

// Find people to invite: username prefix (or name contains), signed-in users only.
profileRouter.get('/users/search', requireAuth, handle(async (req, res) => {
  const q = z.string().trim().toLowerCase().max(24).parse(req.query.q ?? '');
  if (!/^[a-z0-9_ ]{1,24}$/.test(q)) return res.json({ users: [] });
  const like = q.replace(/[_%\\]/g, (ch) => `\\${ch}`);
  const { rows } = await query(
    `SELECT username, name FROM users
     WHERE id <> $2 AND (lower(username) LIKE $1 || '%' OR lower(name) LIKE '%' || $1 || '%')
     ORDER BY (lower(username) LIKE $1 || '%') DESC, username LIMIT 8`, [like, req.user.id]);
  res.json({ users: rows });
}));
