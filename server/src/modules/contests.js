// ---------------------------------------------------------------------------
// /api/contests — timed contests over random practice problems, solo or with
// invited friends (docs §12). Everything here requires sign-in.
//
//   GET  /contests/options             tracks, topics, problem counts (create form)
//   POST /contests                     create (solo → starts now; group → lobby)
//   GET  /contests                     my invitations, active and past contests
//   GET  /contests/inbox               pending-invitation count (nav badge)
//   GET  /contests/:code               lobby / live / results view (+ serverNow)
//   GET  /contests/:code/events        Server-Sent Events: "something changed"
//   GET  /contests/:code/submissions   my submissions to one contest problem
//   POST /contests/:code/join          join (lobby only; the code is the invite)
//   POST /contests/:code/decline       decline an invitation
//   POST /contests/:code/leave         leave a lobby
//   POST /contests/:code/invite        host: invite by username
//   POST /contests/:code/start         host: draw problems, start the clock
//   POST /contests/:code/end           host: end now
//   POST /contests/:code/cancel        host: cancel a lobby
//
// Contest submissions go through POST /api/submissions with a contestId.
//
// Time is the database's: a contest is running while now() < ends_at. There
// are no timers — no process has to be alive at the deadline for it to end.
// Every state change locks the contest row (FOR UPDATE), so join/start/end
// can't interleave.
// ---------------------------------------------------------------------------
import express from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { query, tx } from '../db.js';
import { handle, notFound, badRequest, forbidden, conflict, tooMany } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { openContestStream } from '../lib/events.js';
import { getCatalog } from '../content/store.js';
import { CODE_TRACKS, POOLS, PENALTY_MS, pickProblems } from '../contests/rules.js';
import { refreshStandings } from '../contests/standings.js';
import { publicSubmission } from './submissions.js';

export const contestsRouter = express.Router();
contestsRouter.use('/contests', requireAuth);

const C = config.contests;
const PHASE = "CASE WHEN c.status = 'live' AND c.ends_at <= now() THEN 'ended' ELSE c.status END";
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o, 1/l/i
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const uniq = (xs) => [...new Set(xs)];
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Usernames are 3–24 letters, numbers or _.');
const codeParam = (req) => {
  const code = String(req.params.code || '').toLowerCase();
  if (!/^[a-z0-9]{8}$/.test(code)) throw notFound('Contest not found.');
  return code;
};

// Creation cap per user per hour, counted in the database and checked only
// after the request is valid — fixing a form error never uses up the quota.
const CREATES_PER_HOUR = 20;

// ---- problem pool ------------------------------------------------------------------

// Problems matching the filters, each with how many of `userIds` solved it.
async function candidates(db, s, userIds) {
  const { rows } = await db.query(
    `SELECT p.id, p.difficulty, p.points,
            count(up.user_id) FILTER (WHERE up.status = 'solved')::int AS solved_by
     FROM problems p
     LEFT JOIN user_problems up ON up.problem_id = p.id AND up.user_id = ANY($4::uuid[])
     WHERE p.published AND p.track_id = ANY($1::text[]) AND p.difficulty = ANY($2::text[])
       AND (cardinality($3::text[]) = 0 OR p.topics && $3::text[])
     GROUP BY p.id`, [s.tracks, s.difficulties, s.topics, userIds]);
  return rows.map((r) => ({ id: r.id, difficulty: r.difficulty, points: r.points, solvedBy: r.solved_by }));
}

// Draw the problems and start the clock. Caller holds the contest row lock.
async function startContest(db, contest) {
  const { rows: players } = await db.query(
    "SELECT user_id FROM contest_participants WHERE contest_id = $1 AND state = 'joined'", [contest.id]);
  const pool = await candidates(db, contest.settings, players.map((p) => p.user_id));
  if (pool.length < contest.settings.count) {
    throw conflict(`Only ${pool.length} problem${pool.length === 1 ? '' : 's'} now match this contest's filters — create a new contest with fewer questions.`);
  }
  const { problems, note } = pickProblems(pool, contest.settings);
  await db.query(
    `INSERT INTO contest_problems (contest_id, position, problem_id, points)
     SELECT $1, i, pid, pts FROM unnest($2::text[], $3::int[]) WITH ORDINALITY AS t(pid, pts, i)`,
    [contest.id, problems.map((p) => p.id), problems.map((p) => p.points)]);
  await db.query(
    `UPDATE contests SET status = 'live', started_at = now(),
       ends_at = now() + make_interval(mins => duration_minutes), selection_note = $2
     WHERE id = $1`, [contest.id, note]);
  // Invitations nobody accepted are closed: you can't join a running contest.
  await db.query("DELETE FROM contest_participants WHERE contest_id = $1 AND state = 'invited'", [contest.id]);
  await refreshStandings(db, contest.id);
}

async function lockContest(db, code) {
  const { rows: [c] } = await db.query(`SELECT c.*, ${PHASE} AS phase FROM contests c WHERE c.code = $1 FOR UPDATE`, [code]);
  if (!c) throw notFound('Contest not found.');
  return c;
}

async function resolveUsernames(db, names, selfId) {
  if (!names.length) return [];
  const { rows } = await db.query('SELECT id, username FROM users WHERE lower(username) = ANY($1::text[])', [names]);
  const found = new Set(rows.map((r) => r.username.toLowerCase()));
  const missing = names.filter((n) => !found.has(n));
  if (missing.length) throw badRequest(`No user with username ${missing.map((m) => `@${m}`).join(', ')}.`);
  return rows.filter((r) => r.id !== selfId);
}

async function invite(db, contestId, users, byId) {
  if (!users.length) return;
  await db.query(
    `INSERT INTO contest_participants (contest_id, user_id, state, invited_by)
     SELECT $1, uid, 'invited', $3 FROM unnest($2::uuid[]) AS uid
     ON CONFLICT (contest_id, user_id) DO UPDATE SET state = 'invited', invited_by = $3
       WHERE contest_participants.state = 'declined'`,
    [contestId, users.map((u) => u.id), byId]);
}

// ---- create ----------------------------------------------------------------------------

contestsRouter.get('/contests/options', handle(async (req, res) => {
  const { tracks } = await getCatalog();
  const { rows } = await query(
    `SELECT p.track_id, p.difficulty, count(*)::int AS n,
            count(*) FILTER (WHERE up.status = 'solved')::int AS solved
     FROM problems p LEFT JOIN user_problems up ON up.problem_id = p.id AND up.user_id = $1
     WHERE p.published AND p.track_id = ANY($2::text[]) GROUP BY 1, 2`, [req.user.id, CODE_TRACKS]);
  const { rows: topicRows } = await query(
    `SELECT track_id, unnest(topics) AS topic, count(*)::int AS n FROM problems
     WHERE published AND track_id = ANY($1::text[]) GROUP BY 1, 2`, [CODE_TRACKS]);
  res.json({
    tracks: tracks.filter((t) => CODE_TRACKS.includes(t.id)).map((t) => ({
      id: t.id, title: t.title, icon: t.icon,
      topics: t.topics.map((name) => ({ name, problems: topicRows.find((r) => r.track_id === t.id && r.topic === name)?.n || 0 })),
      problems: Object.fromEntries(['Easy', 'Medium', 'Hard'].map((d) => {
        const r = rows.find((x) => x.track_id === t.id && x.difficulty === d);
        return [d, { total: r?.n || 0, solved: r?.solved || 0 }];
      })),
    })),
    limits: { maxPlayers: C.maxPlayers, maxProblems: C.maxProblems, minMinutes: 5, maxMinutes: 180, penaltyMinutes: PENALTY_MS / 60_000 },
  });
}));

const createSchema = z.object({
  mode: z.enum(['solo', 'group'], { required_error: 'Choose Solo or With friends.' }),
  title: z.string().trim().max(80).optional(),
  tracks: z.array(z.enum(CODE_TRACKS), { required_error: 'Pick at least one track.' }).min(1, 'Pick at least one track.'),
  difficulties: z.array(z.enum(['Easy', 'Medium', 'Hard']), { required_error: 'Pick at least one difficulty.' }).min(1, 'Pick at least one difficulty.'),
  topics: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  count: z.number({ required_error: 'Choose how many questions.' }).int().min(1, 'Choose at least 1 question.').max(C.maxProblems, `A contest can have at most ${C.maxProblems} questions.`),
  minutes: z.number({ required_error: 'Choose a duration.' }).int().min(5, 'A contest lasts at least 5 minutes.').max(180, 'A contest lasts at most 180 minutes.'),
  pool: z.enum(POOLS, { required_error: 'Choose which problems to draw (unsolved, solved or both).' }),
  invite: z.array(username).max(C.maxPlayers - 1, `You can invite at most ${C.maxPlayers - 1} people.`).default([]),
});

contestsRouter.post('/contests', handle(async (req, res) => {
  const body = createSchema.parse(req.body);
  const settings = {
    tracks: uniq(body.tracks), difficulties: uniq(body.difficulties), topics: uniq(body.topics),
    count: body.count, minutes: body.minutes, pool: body.pool,
  };
  if (body.mode === 'solo' && body.invite.length) throw badRequest('A solo contest has no invitations — choose "With friends" to invite people.');

  // Topics must belong to one of the chosen tracks' taxonomies.
  const { tracks } = await getCatalog();
  const allowed = new Set(tracks.filter((t) => settings.tracks.includes(t.id)).flatMap((t) => t.topics));
  const unknown = settings.topics.filter((t) => !allowed.has(t));
  if (unknown.length) throw badRequest(`Unknown topic for the chosen tracks: ${unknown.join(', ')}.`);

  const { rows: [open] } = await query(
    `SELECT count(*)::int AS n FROM contests WHERE host_id = $1 AND (status = 'lobby' OR (status = 'live' AND ends_at > now()))`,
    [req.user.id]);
  if (open.n >= C.maxOpenPerHost) throw conflict(`You already host ${open.n} open contests (the limit is ${C.maxOpenPerHost}) — finish or cancel one first.`);
  const { rows: [recent] } = await query(
    "SELECT count(*)::int AS n FROM contests WHERE host_id = $1 AND created_at > now() - interval '1 hour'", [req.user.id]);
  if (recent.n >= CREATES_PER_HOUR) throw tooMany(`You've created ${recent.n} contests in the last hour — try again a little later.`, 300);

  // Feasibility now (the final draw happens at start, against the roster).
  const pool = await candidates({ query }, settings, [req.user.id]);
  if (pool.length < settings.count) {
    throw badRequest(pool.length
      ? `Only ${pool.length} problem${pool.length === 1 ? '' : 's'} match these filters — lower the number of questions or widen the filters.`
      : 'No problems match these filters — widen the tracks, difficulties or topics.');
  }

  // The session token carries only id + role, so the default title reads the
  // name from the database (it used to read req.user.name → 500 when untitled).
  let title = body.title;
  if (!title) {
    const { rows: [me] } = await query('SELECT name, username FROM users WHERE id = $1', [req.user.id]);
    title = body.mode === 'solo' ? 'Solo contest' : `${(me?.name || me?.username || 'My').trim().split(/\s+/)[0]}'s contest`;
  }
  const code = await tx(async (db) => {
    const invitees = await resolveUsernames(db, uniq(body.invite), req.user.id);
    let contest;
    for (let attempt = 0; !contest; attempt++) {
      try {
        await db.query('SAVEPOINT code');
        ({ rows: [contest] } = await db.query(
          `INSERT INTO contests (code, title, host_id, mode, settings, duration_minutes)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [newCode(), title, req.user.id, body.mode, settings, settings.minutes]));
      } catch (err) {
        if (err.code !== '23505' || attempt >= 3) throw err;   // code collision: draw another
        await db.query('ROLLBACK TO SAVEPOINT code');
      }
    }
    await db.query(
      "INSERT INTO contest_participants (contest_id, user_id, state, joined_at) VALUES ($1, $2, 'joined', now())",
      [contest.id, req.user.id]);
    await invite(db, contest.id, invitees, req.user.id);
    if (body.mode === 'solo') await startContest(db, { ...contest, settings });
    return contest.code;
  });
  res.status(201).json({ contest: { code } });
}));

// ---- lists --------------------------------------------------------------------------------

contestsRouter.get('/contests', handle(async (req, res) => {
  const { rows } = await query(
    `SELECT c.code, c.title, c.mode, ${PHASE} AS phase, c.settings, c.duration_minutes, c.created_at, c.started_at, c.ends_at,
            h.username AS host_username, h.name AS host_name, cp.state, cp.rank, cp.score, cp.solved,
            (SELECT count(*)::int FROM contest_participants x WHERE x.contest_id = c.id AND x.state = 'joined') AS players,
            (SELECT count(*)::int FROM contest_problems x WHERE x.contest_id = c.id) AS problems
     FROM contest_participants cp
     JOIN contests c ON c.id = cp.contest_id
     JOIN users h ON h.id = c.host_id
     WHERE cp.user_id = $1 AND cp.state <> 'declined' AND c.status <> 'cancelled'
     ORDER BY coalesce(c.started_at, c.created_at) DESC LIMIT 60`, [req.user.id]);
  const view = (r) => ({
    code: r.code, title: r.title, mode: r.mode, phase: r.phase, settings: r.settings, minutes: r.duration_minutes,
    createdAt: r.created_at, startedAt: r.started_at, endsAt: r.ends_at, host: { username: r.host_username, name: r.host_name },
    players: r.players, problems: r.problems || r.settings.count, rank: r.rank, score: r.score, solved: r.solved,
  });
  res.json({
    serverNow: new Date(),
    invitations: rows.filter((r) => r.state === 'invited' && r.phase === 'lobby').map(view),
    active: rows.filter((r) => r.state === 'joined' && (r.phase === 'lobby' || r.phase === 'live')).map(view),
    past: rows.filter((r) => r.state === 'joined' && r.phase === 'ended').map(view),
  });
}));

contestsRouter.get('/contests/inbox', handle(async (req, res) => {
  const { rows: [r] } = await query(
    `SELECT count(*) FILTER (WHERE cp.state = 'invited' AND c.status = 'lobby')::int AS invitations,
            count(*) FILTER (WHERE cp.state = 'joined' AND c.status = 'live' AND c.ends_at > now())::int AS live
     FROM contest_participants cp JOIN contests c ON c.id = cp.contest_id WHERE cp.user_id = $1`, [req.user.id]);
  res.json(r);
}));

// ---- one contest ------------------------------------------------------------------------

contestsRouter.get('/contests/:code', handle(async (req, res) => {
  const code = codeParam(req);
  const { rows: [c] } = await query(
    `SELECT c.*, ${PHASE} AS phase, now() AS server_now, h.username AS host_username, h.name AS host_name
     FROM contests c JOIN users h ON h.id = c.host_id WHERE c.code = $1`, [code]);
  if (!c) throw notFound('Contest not found.');
  const [people, probs] = await Promise.all([
    query(
      `SELECT cp.user_id, cp.state, cp.score, cp.finish_ms, cp.solved, cp.wrong, cp.pending, cp.rank, cp.detail, cp.joined_at,
              u.username, u.name
       FROM contest_participants cp JOIN users u ON u.id = cp.user_id
       WHERE cp.contest_id = $1 ORDER BY cp.rank NULLS LAST, cp.joined_at NULLS LAST, u.username`, [c.id]),
    query(
      `SELECT cp.position, cp.problem_id, cp.points, p.title, p.difficulty, p.track_id
       FROM contest_problems cp JOIN problems p ON p.id = cp.problem_id
       WHERE cp.contest_id = $1 ORDER BY cp.position`, [c.id]),
  ]);
  const meRow = people.rows.find((p) => p.user_id === req.user.id);
  const playing = meRow?.state === 'joined';
  // Problem titles/ids: to players once it starts, to anyone once it's over.
  const showProblems = (c.phase === 'live' && playing) || c.phase === 'ended';
  const problems = probs.rows.map((p) => ({
    position: p.position, points: p.points, difficulty: p.difficulty,
    ...(showProblems ? { id: p.problem_id, title: p.title, track: p.track_id } : {}),
  }));
  const joined = people.rows.filter((p) => p.state === 'joined');
  res.json({
    contest: {
      id: c.id, code: c.code, title: c.title, mode: c.mode, phase: c.phase, settings: c.settings,
      minutes: c.duration_minutes, createdAt: c.created_at, startedAt: c.started_at, endsAt: c.ends_at,
      serverNow: c.server_now, selectionNote: c.selection_note,
      host: { username: c.host_username, name: c.host_name }, isHost: c.host_id === req.user.id,
      penaltyMinutes: PENALTY_MS / 60_000, maxPlayers: C.maxPlayers,
    },
    me: meRow ? { state: meRow.state } : null,
    problems,
    standings: joined.map((p) => ({
      rank: p.rank, username: p.username, name: p.name, isMe: p.user_id === req.user.id, isHost: p.user_id === c.host_id,
      score: p.score, finishMs: Number(p.finish_ms), solved: p.solved, wrong: p.wrong, pending: p.pending,
      // Per problem, in contest order (no problem ids — those are for players only while live).
      cells: probs.rows.map((pr) => p.detail[pr.problem_id] || { solvedMs: null, wrong: 0, pending: 0 }),
    })),
    invited: people.rows.filter((p) => p.state !== 'joined').map((p) => ({ username: p.username, name: p.name, state: p.state })),
    provisional: c.phase === 'ended' && joined.some((p) => p.pending > 0),
  });
}));

contestsRouter.get('/contests/:code/events', handle(async (req, res) => {
  const code = codeParam(req);
  const { rows: [c] } = await query('SELECT id FROM contests WHERE code = $1', [code]);
  if (!c) throw notFound('Contest not found.');
  if (!openContestStream(req, res, c.id)) throw tooMany('Too many open contest tabs — close one and reload.', 10);
}));

contestsRouter.get('/contests/:code/submissions', handle(async (req, res) => {
  const code = codeParam(req);
  const { problem: problemId } = z.object({ problem: z.string({ required_error: 'Problem is required (?problem=<id>).' }).min(1).max(100) }).parse(req.query);
  const { rows } = await query(
    `SELECT s.* FROM submissions s JOIN contests c ON c.id = s.contest_id
     WHERE c.code = $1 AND s.user_id = $2 AND s.problem_id = $3 ORDER BY s.created_at DESC LIMIT 30`,
    [code, req.user.id, problemId]);
  res.json({ submissions: rows.map((s) => publicSubmission(s, { withCode: true })) });
}));

// ---- lobby & lifecycle ------------------------------------------------------------------------

const hostOnly = (c, user) => { if (c.host_id !== user.id) throw forbidden('Only the host can do that.'); };
const ok = (res, code) => res.json({ ok: true, code });

contestsRouter.post('/contests/:code/join', handle(async (req, res) => {
  const code = codeParam(req);
  await tx(async (db) => {
    const c = await lockContest(db, code);
    if (c.phase !== 'lobby') throw conflict(c.phase === 'cancelled' ? 'This contest was cancelled.' : 'This contest has already started — you can only join before the host starts it.');
    const { rows: [n] } = await db.query("SELECT count(*)::int AS n FROM contest_participants WHERE contest_id = $1 AND state = 'joined'", [c.id]);
    const { rows: [mine] } = await db.query('SELECT state FROM contest_participants WHERE contest_id = $1 AND user_id = $2', [c.id, req.user.id]);
    if (mine?.state === 'joined') return;
    if (n.n >= C.maxPlayers) throw conflict(`This contest is full (${C.maxPlayers} players).`);
    await db.query(
      `INSERT INTO contest_participants (contest_id, user_id, state, joined_at) VALUES ($1, $2, 'joined', now())
       ON CONFLICT (contest_id, user_id) DO UPDATE SET state = 'joined', joined_at = now()`, [c.id, req.user.id]);
    await refreshStandings(db, c.id);
  });
  ok(res, code);
}));

contestsRouter.post('/contests/:code/decline', handle(async (req, res) => {
  const code = codeParam(req);
  await tx(async (db) => {
    const c = await lockContest(db, code);
    const { rowCount } = await db.query("UPDATE contest_participants SET state = 'declined' WHERE contest_id = $1 AND user_id = $2 AND state = 'invited'", [c.id, req.user.id]);
    if (!rowCount) throw conflict("You don't have a pending invitation to this contest.");
    await refreshStandings(db, c.id);
  });
  ok(res, code);
}));

contestsRouter.post('/contests/:code/leave', handle(async (req, res) => {
  const code = codeParam(req);
  await tx(async (db) => {
    const c = await lockContest(db, code);
    if (c.host_id === req.user.id) throw badRequest('You are the host — cancel the contest instead.');
    if (c.phase !== 'lobby') throw conflict('The contest has started — you can no longer leave it.');
    const { rowCount } = await db.query("DELETE FROM contest_participants WHERE contest_id = $1 AND user_id = $2 AND state = 'joined'", [c.id, req.user.id]);
    if (!rowCount) throw conflict("You haven't joined this contest.");
    await refreshStandings(db, c.id);
  });
  ok(res, code);
}));

contestsRouter.post('/contests/:code/invite', handle(async (req, res) => {
  const code = codeParam(req);
  const { usernames } = z.object({
    usernames: z.array(username, { required_error: 'Add at least one username to invite.' }).min(1, 'Add at least one username to invite.').max(C.maxPlayers),
  }).parse(req.body ?? {});
  await tx(async (db) => {
    const c = await lockContest(db, code);
    hostOnly(c, req.user);
    if (c.mode !== 'group') throw badRequest('Solo contests have no invitations.');
    if (c.phase !== 'lobby') throw conflict('Invitations close when the contest starts.');
    await invite(db, c.id, await resolveUsernames(db, uniq(usernames), req.user.id), req.user.id);
    await refreshStandings(db, c.id);
  });
  ok(res, code);
}));

contestsRouter.post('/contests/:code/start', handle(async (req, res) => {
  const code = codeParam(req);
  await tx(async (db) => {
    const c = await lockContest(db, code);
    hostOnly(c, req.user);
    if (c.phase !== 'lobby') throw conflict('This contest has already started.');
    await startContest(db, c);
  });
  ok(res, code);
}));

contestsRouter.post('/contests/:code/end', handle(async (req, res) => {
  const code = codeParam(req);
  await tx(async (db) => {
    const c = await lockContest(db, code);
    hostOnly(c, req.user);
    if (c.phase !== 'live') throw conflict('This contest is not running.');
    await db.query('UPDATE contests SET ends_at = now() WHERE id = $1', [c.id]);
    await refreshStandings(db, c.id);
  });
  ok(res, code);
}));

contestsRouter.post('/contests/:code/cancel', handle(async (req, res) => {
  const code = codeParam(req);
  await tx(async (db) => {
    const c = await lockContest(db, code);
    hostOnly(c, req.user);
    if (c.phase !== 'lobby') throw conflict('Only a contest that hasn\'t started can be cancelled — end it instead.');
    await db.query("UPDATE contests SET status = 'cancelled' WHERE id = $1", [c.id]);
    await refreshStandings(db, c.id);
  });
  ok(res, code);
}));
