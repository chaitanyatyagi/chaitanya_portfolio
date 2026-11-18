-- ============================================================================
-- 005 — problem tags, points, public profiles.
-- ============================================================================

-- --- Problem tags (beyond difficulty + skill topics) --------------------------
--   patterns   reusable technique ("Top-N per group", "Latest record per key")
--   domains    scenario industry ("E-commerce", "Web logs")
--   companies  ONLY verified interview reports — never invented
ALTER TABLE problems
  ADD COLUMN patterns  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN domains   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN companies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN points    int    NOT NULL DEFAULT 10;   -- base points (full award on a first-try solve)
UPDATE problems SET points = CASE difficulty WHEN 'Easy' THEN 10 WHEN 'Medium' THEN 20 ELSE 40 END;

-- --- Points ------------------------------------------------------------------
-- Award for the FIRST Accepted submission, by attempt number:
--   1st → 100% · 2nd → 50% · 3rd → 25% · 4th+ → 0   (solution viewed first → 0)
ALTER TABLE submissions
  ADD COLUMN attempt_no      int,     -- position among this user's attempts at the problem
  ADD COLUMN points_awarded  int NOT NULL DEFAULT 0;
ALTER TABLE user_problems
  ADD COLUMN points         int NOT NULL DEFAULT 0,
  ADD COLUMN solved_attempt int;

-- --- Public profiles -------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN username  text,
  ADD COLUMN headline  text NOT NULL DEFAULT '',
  ADD COLUMN points    int  NOT NULL DEFAULT 0;      -- denormalized total, kept in step by the grader

-- Backfill usernames: email local part, made unique with a suffix if needed.
WITH base AS (
  SELECT id, created_at,
         left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_]+', '', 'g'), 24) AS b
  FROM users
), ranked AS (
  SELECT id, CASE WHEN b = '' THEN 'user' ELSE b END AS b,
         row_number() OVER (PARTITION BY b ORDER BY created_at) AS n
  FROM base
)
UPDATE users u SET username = CASE WHEN r.n = 1 THEN r.b ELSE r.b || r.n END
FROM ranked r WHERE r.id = u.id;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));
-- Rank = 1 + number of users with more points: an index-only count.
CREATE INDEX users_points_idx ON users (points DESC);

-- Backfill points for problems already solved, from submission history.
WITH firsts AS (
  SELECT DISTINCT ON (s.user_id, s.problem_id) s.user_id, s.problem_id, s.id, s.created_at
  FROM submissions s WHERE s.verdict = 'Accepted'
  ORDER BY s.user_id, s.problem_id, s.created_at
), attempts AS (
  SELECT f.*, (SELECT count(*) FROM submissions x
               WHERE x.user_id = f.user_id AND x.problem_id = f.problem_id
                 AND x.status <> 'failed' AND coalesce(x.verdict, '') <> 'Internal Error'
                 AND x.created_at <= f.created_at) AS attempt_no
  FROM firsts f
), awarded AS (
  SELECT a.*, CASE
      WHEN up.revealed_at IS NOT NULL AND up.revealed_at < a.created_at THEN 0
      ELSE p.points * CASE a.attempt_no WHEN 1 THEN 100 WHEN 2 THEN 50 WHEN 3 THEN 25 ELSE 0 END / 100
    END AS pts
  FROM attempts a
  JOIN problems p ON p.id = a.problem_id
  JOIN user_problems up ON up.user_id = a.user_id AND up.problem_id = a.problem_id
)
UPDATE user_problems up SET points = aw.pts, solved_attempt = aw.attempt_no
FROM awarded aw WHERE aw.user_id = up.user_id AND aw.problem_id = up.problem_id;
UPDATE submissions s SET points_awarded = up.points, attempt_no = up.solved_attempt
FROM user_problems up, (SELECT DISTINCT ON (user_id, problem_id) id, user_id, problem_id FROM submissions
                        WHERE verdict = 'Accepted' ORDER BY user_id, problem_id, created_at) f
WHERE s.id = f.id AND up.user_id = f.user_id AND up.problem_id = f.problem_id;
UPDATE users u SET points = coalesce((SELECT sum(points) FROM user_problems WHERE user_id = u.id), 0);

-- Activity heatmap / profile queries: a user's graded submissions over time.
CREATE INDEX submissions_user_finished_idx ON submissions (user_id, finished_at) WHERE status = 'done';
