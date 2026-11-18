-- Contests: timed, LeetCode/Codeforces-style rounds over random practice
-- problems — solo or with invited friends (docs §12).
--
-- A contest's phase is derived, not stored, once it has started:
--   status 'lobby'      → waiting for the host to start (group only)
--   status 'live'       → running while now() < ends_at, ended after it
--   status 'cancelled'  → host cancelled the lobby
-- So a contest "ends" without any timer or background job: every read compares
-- ends_at with the database clock. Ending early just moves ends_at to now().

CREATE TABLE contests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,                 -- invite code, used in the URL (/contests/<code>)
  title            text NOT NULL,
  host_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode             text NOT NULL CHECK (mode IN ('solo', 'group')),
  status           text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'live', 'cancelled')),
  settings         jsonb NOT NULL,                       -- {tracks, difficulties, topics, count, minutes, pool}
  duration_minutes int  NOT NULL CHECK (duration_minutes BETWEEN 5 AND 180),
  selection_note   text,                                 -- set when the pool had to be widened at start
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  ends_at          timestamptz,
  CHECK (status <> 'live' OR (started_at IS NOT NULL AND ends_at IS NOT NULL))
);
CREATE INDEX contests_host_idx ON contests (host_id, created_at DESC);

-- Everyone invited to or playing in a contest, plus their standings. The
-- standings columns are a cache: recomputed from submissions (the source of
-- truth) by contests/standings.js whenever a contest verdict lands.
CREATE TABLE contest_participants (
  contest_id  uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state       text NOT NULL CHECK (state IN ('invited', 'joined', 'declined')),
  invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  joined_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  score       int    NOT NULL DEFAULT 0,                 -- sum of points of solved problems
  finish_ms   bigint NOT NULL DEFAULT 0,                 -- last solve time + 5 min per wrong attempt on solved problems
  solved      int    NOT NULL DEFAULT 0,
  wrong       int    NOT NULL DEFAULT 0,
  pending     int    NOT NULL DEFAULT 0,                 -- submissions still being graded
  rank        int,
  detail      jsonb  NOT NULL DEFAULT '{}',              -- per problem: {solvedMs, wrong, pending}
  PRIMARY KEY (contest_id, user_id)
);
-- "My contests" and invitations; profile contest history.
CREATE INDEX contest_participants_user_idx ON contest_participants (user_id, created_at DESC);

-- The problems drawn for a contest, frozen at start (same set for everyone).
CREATE TABLE contest_problems (
  contest_id  uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  problem_id  text NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  points      int  NOT NULL,
  PRIMARY KEY (contest_id, position),
  UNIQUE (contest_id, problem_id)
);
-- "Is this problem in a live contest of mine?" (practice submit / reveal guard).
CREATE INDEX contest_problems_problem_idx ON contest_problems (problem_id);

-- A contest submission is an ordinary submission (same queue, grader, points
-- and solved status) tagged with its contest.
ALTER TABLE submissions ADD COLUMN contest_id uuid REFERENCES contests(id) ON DELETE SET NULL;
CREATE INDEX submissions_contest_idx ON submissions (contest_id, created_at) WHERE contest_id IS NOT NULL;
