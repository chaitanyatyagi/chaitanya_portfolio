-- ============================================================================
-- 001_init — the platform's system of record (PostgreSQL).
--
-- Why one relational database for everything on the platform:
--   * users, sessions, submissions and progress need uniqueness, foreign keys
--     and multi-row transactions (e.g. "store the verdict AND mark the problem
--     solved" must happen together or not at all);
--   * content (courses, problems) is small, read-heavy and versioned; JSONB
--     columns hold the document-shaped parts (schemas, test inputs) without a
--     second database;
--   * the submission queue lives here too (FOR UPDATE SKIP LOCKED), so a
--     submission and its job can never disagree — they are the same row.
-- See docs/ARCHITECTURE.md §5 for the full reasoning.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Identity & access
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  name           text NOT NULL,
  password_hash  text NOT NULL,                       -- scrypt$N$r$p$salt$hash
  role           text NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'admin')),
  failed_logins  int  NOT NULL DEFAULT 0,             -- brute-force lockout counter
  locked_until   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness: "A@x.com" and "a@x.com" are the same account.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- One row per login on a device. The refresh token itself is never stored —
-- only its SHA-256 — so a database leak can't be replayed as live sessions.
-- Rotation: each refresh revokes the row and creates a new one in the same
-- family; presenting an already-revoked token revokes the whole family
-- (token-theft detection).
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id     uuid NOT NULL,
  refresh_hash  bytea NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  user_agent    text,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_family_idx ON sessions (family_id);

CREATE TABLE password_resets (
  token_hash  bytea PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Content (seeded from server/content, editable through the admin API)
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
  id             text PRIMARY KEY,
  position       int  NOT NULL,
  title          text NOT NULL,
  level          text NOT NULL,
  tags           text[] NOT NULL DEFAULT '{}',
  description    text NOT NULL,
  outcomes       text[] NOT NULL DEFAULT '{}',
  prerequisites  text[] NOT NULL DEFAULT '{}',
  practice       text[] NOT NULL DEFAULT '{}',      -- related track ids
  published      boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_modules (
  slug        text PRIMARY KEY,                     -- globally unique (old /guide/:slug links)
  course_id   text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  title       text NOT NULL,
  summary     text NOT NULL DEFAULT '',
  minutes     int  NOT NULL,
  lessons     jsonb NOT NULL DEFAULT '[]',          -- [{ id, title }] derived from `## ` headings
  body_md     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE tracks (
  id         text PRIMARY KEY,
  position   int  NOT NULL,
  title      text NOT NULL,
  short      text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('editor', 'design', 'hackathon')),
  status     text NOT NULL CHECK (status IN ('live', 'soon')),
  icon       text NOT NULL,
  course_id  text REFERENCES courses(id) ON DELETE SET NULL,
  blurb      text NOT NULL,
  topics     text[] NOT NULL DEFAULT '{}',
  details    jsonb,                                 -- format / rubric / briefs for design & hackathon tracks
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE problems (
  id              text PRIMARY KEY,
  track_id        text NOT NULL REFERENCES tracks(id),
  position        int  NOT NULL,
  title           text NOT NULL,
  difficulty      text NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  topics          text[] NOT NULL DEFAULT '{}',
  summary         text NOT NULL,
  description_md  text NOT NULL,
  hints           text[] NOT NULL DEFAULT '{}',
  schema          jsonb,                            -- sql/pyspark: [{ name, columns: [[name, TYPE, note]] }]
  output_columns  text[],
  entry           text,                             -- python/pyspark: function the tests call
  signature       text,
  starter         text NOT NULL,
  solution        text NOT NULL,                    -- only served after solve / reveal
  explanation_md  text NOT NULL,
  version         int  NOT NULL DEFAULT 1,          -- bumped when tests or statement change
  content_hash    text NOT NULL,                    -- lets the seeder detect real changes
  published       boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX problems_track_idx ON problems (track_id, position);

-- Tests are their own table so the public problem query can't accidentally
-- select hidden cases: the API reads `WHERE NOT hidden`; only the grader reads
-- everything.
CREATE TABLE problem_tests (
  problem_id  text NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  name        text NOT NULL,
  hidden      boolean NOT NULL DEFAULT false,
  ordered     boolean NOT NULL DEFAULT false,
  input       jsonb NOT NULL,                       -- { tables: {...} } or { args: [...] }
  expected    jsonb NOT NULL,
  PRIMARY KEY (problem_id, position)
);

-- ---------------------------------------------------------------------------
-- Learner state
-- ---------------------------------------------------------------------------
CREATE TABLE module_progress (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_slug   text NOT NULL REFERENCES course_modules(slug) ON DELETE CASCADE,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_slug)
);

CREATE TABLE course_visits (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id    text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_slug  text NOT NULL REFERENCES course_modules(slug) ON DELETE CASCADE,
  visited_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

-- Per (user, problem) summary: status for list pages, the saved draft, and
-- whether the solution was revealed. Updated in the same transaction as the
-- submission verdict, so "Solved" can never disagree with the submissions.
CREATE TABLE user_problems (
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id         text NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'attempted', 'solved')),  -- todo = draft only
  submissions_count  int  NOT NULL DEFAULT 0,
  solved_at          timestamptz,
  revealed_at        timestamptz,
  draft_code         text,
  draft_updated_at   timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, problem_id)
);

-- ---------------------------------------------------------------------------
-- Submissions = the grading queue
--   queued → running → done            (normal path)
--   running → queued                   (grader crashed; lease expired; retried)
--   running → failed                   (gave up after max attempts)
-- ---------------------------------------------------------------------------
CREATE TABLE submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id       text NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  problem_version  int  NOT NULL,
  code             text NOT NULL,
  client_token     uuid NOT NULL,                   -- idempotency key from the browser
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  verdict          text,
  passed           int,
  total            int,
  runtime_ms       int,
  results          jsonb,                           -- per-test results, hidden cases redacted
  attempts         int  NOT NULL DEFAULT 0,
  locked_until     timestamptz,                     -- grader lease
  worker_id        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  UNIQUE (user_id, client_token)
);
-- Queue claim: "oldest queued job" stays an index scan however large the table grows.
CREATE INDEX submissions_queue_idx ON submissions (created_at) WHERE status = 'queued';
-- Lease reaper: find running jobs whose grader died.
CREATE INDEX submissions_running_idx ON submissions (locked_until) WHERE status = 'running';
-- Submission history per problem for a user.
CREATE INDEX submissions_user_problem_idx ON submissions (user_id, problem_id, created_at DESC);
-- Per-user rate limit ("submissions in the last minute") works across every
-- API process because it counts rows, not in-memory counters.
CREATE INDEX submissions_user_recent_idx ON submissions (user_id, created_at DESC);
-- "Does this user already have a job waiting?" (fairness cap).
CREATE INDEX submissions_user_pending_idx ON submissions (user_id) WHERE status IN ('queued', 'running');
