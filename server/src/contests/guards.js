// "Is this problem part of a contest this user is playing right now?"
// While it is, practice Submit and Reveal solution are refused for it: a
// practice submission would let you test against the hidden tests without the
// contest's wrong-answer penalty, and a revealed solution is self-explanatory.
export async function liveContestFor(db, userId, problemId) {
  const { rows: [c] } = await db.query(
    `SELECT c.code FROM contest_problems pr
     JOIN contests c ON c.id = pr.contest_id
     JOIN contest_participants cp ON cp.contest_id = c.id AND cp.user_id = $1 AND cp.state = 'joined'
     WHERE pr.problem_id = $2 AND c.status = 'live' AND c.ends_at > now()
     LIMIT 1`, [userId, problemId]);
  return c?.code ?? null;
}
