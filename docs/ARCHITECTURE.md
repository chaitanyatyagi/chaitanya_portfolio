# DataDrill — Architecture & Design Handbook

> **What this is.** The single reference for *how DataDrill works and why it was built this way*: every component, every major decision (with the alternatives we rejected), how the system behaves under load, and what happens when each part fails.
>
> **Maintenance rule.** This document is part of the code. Any change that adds or alters behaviour — a new endpoint, table, track, config knob, failure mode or design decision — updates the relevant section **and** adds a line to the [Decision log](#19-decision-log) in the same change. If the doc and the code disagree, that is a bug.
>
> Last updated: 2026-11-19

---

## Contents

1. [The product in one page](#1-the-product-in-one-page)
2. [System overview](#2-system-overview)
3. [Technology choices — and why](#3-technology-choices--and-why)
4. [Repository map](#4-repository-map)
5. [Data model](#5-data-model)
6. [The API](#6-the-api)
7. [Authentication & authorization](#7-authentication--authorization)
8. [Code execution & grading](#8-code-execution--grading) ← the heart of the system
9. [Scalability: capacity model & measured numbers](#9-scalability-capacity-model--measured-numbers)
10. [Failure modes & how each is handled](#10-failure-modes--how-each-is-handled)
11. [Frontend architecture](#11-frontend-architecture)
12. [Contests](#12-contests) ← solo & multiplayer timed rounds
13. [Content pipeline](#13-content-pipeline)
14. [Testing](#14-testing)
15. [Running & operating it](#15-running--operating-it)
16. [Production deployment blueprint](#16-production-deployment-blueprint)
17. [Security checklist](#17-security-checklist)
18. [Known limitations & roadmap](#18-known-limitations--roadmap)
19. [Decision log](#19-decision-log)
20. [Glossary](#20-glossary)

---

## 1. The product in one page

DataDrill is a learning and practice platform for data engineers, analytics engineers and analysts — "LeetCode for data engineering".

| Area | What a learner does | Access |
|---|---|---|
| **Landing** (`/`) | Sees roles, tracks, courses, FAQ | Public |
| **Learn** (`/learn`) | Browses courses → reads modules → lessons; progress is saved | Catalog & outlines public; **lesson content requires sign-in** |
| **Practice** (`/practice`) | Picks a track (SQL, Python, PySpark, pandas, Shell…) → filters by topic, difficulty, pattern, status → solves a problem in an in-browser editor | Lists public; **workspace requires sign-in** |
| **Run** | Executes code against the *visible examples*, instantly, in the browser | Signed in |
| **Submit** | Grades code on the server against *all* tests, including hidden ones; the first Accepted earns **points** (§8.13) | Signed in |
| **Profile** (`/u/:username`, `/profile` → yours) | Points, global rank, solved-by-difficulty ring, per-track progress, badges, skills, a year activity heatmap, streaks, points-over-time chart, recent solves (and, for the owner, every submission) | Public (never the email or code) |
| **Leaderboard** (`/leaderboard`) | Top 100 learners by points; ties share a rank | Public |
| **Contests** (`/contests`, `/contests/:code`) | Timed rounds of randomly drawn problems — **solo**, or **with friends** invited by username or link — on a live scoreboard ranked like LeetCode/Codeforces (§12) | Signed in |
| **Design & hackathon tracks** | Data Modeling, Pipeline Development, System Design — previews (format, rubric, sample briefs) | Public, "coming soon" |
| **Docs** (`/docs/architecture`) | Reads this handbook on the website: contents sidebar, section filter, scroll-spy, deep links | **Admins only** (§7.5) |

Vocabulary: a **course** has **modules** (one markdown chapter each), a module has **lessons** (its `##` sections). A **track** groups **problems**; each problem has **tests** — some visible ("examples"), some **hidden** — and **tags** (difficulty, points, topics, patterns, domains, companies; §8.12).

---

## 2. System overview

```
                                   ┌──────────────────────────────────────────────┐
  Browser                          │  Server side                                 │
 ┌────────────────────────────┐    │                                              │
 │ React SPA (Vite build)     │    │   ┌───────────────────────────┐              │
 │  • pages, routing          │HTTP│   │ API  (Node.js + Express)  │              │
 │  • CodeMirror 6 editor     ├────┼──►│ node:cluster, 1 proc/core │──┐           │
 │  • Web Worker:             │JSON│   │ stateless; JWT cookies    │  │ SQL        │
 │    Pyodide + DuckDB +      │    │   │ in-process content cache  │  ▼           │
 │    sqlframe   ← "Run"      │    │   └───────────────────────────┘ ┌──────────┐ │
 └────────────────────────────┘    │                  ▲  LISTEN      │PostgreSQL│ │
                                   │                  │  content_    │ system of│ │
                                   │                  │  changed     │ record + │ │
                                   │   ┌──────────────┴────────────┐ │ job queue│ │
                                   │   │ Grader service (Node.js)  │◄┤          │ │
                                   │   │  lanes: one per track     │ └──────────┘ │
                                   │   │  SKIP LOCKED job claims   │  LISTEN      │
                                   │   │  ┌─────┐┌─────┐┌─────┐    │  submission_ │
                                   │   │  │sbx  ││sbx  ││sbx  │... │  queued      │
                                   │   │  └─────┘└─────┘└─────┘    │              │
                                   │   │  sandboxes = child procs, │              │
                                   │   │  Pyodide, --permission    │              │
                                   │   └───────────────────────────┘              │
                                   │                                              │
                                   │   ┌───────────────────────────┐ ┌──────────┐ │
                                   │   │ Legacy CMS router (in API)├►│ MongoDB  │ │
                                   │   │ blog, bookings, site copy │ │ (Atlas)  │ │
                                   │   └───────────────────────────┘ └──────────┘ │
                                   └──────────────────────────────────────────────┘
```

**Three processes, one database.**

* **Web app** — static files (HTML/JS/CSS). In production, served by a CDN.
* **API** — stateless HTTP processes. They never run learner code. They read and write Postgres and keep an in-memory copy of content.
* **Grader** — a separate service that pulls submissions from a queue (a Postgres table) and grades them in sandboxed child processes.

**Live contests** (§12) add one more path: the grader's verdict transaction runs `NOTIFY contest_event`; every API process receives it on the same LISTEN connection it uses for `content_changed`, and pushes "changed" over **Server-Sent Events** to the browsers watching that contest, which then re-fetch the standings. No extra service, no WebSocket server, no Redis.

**The two request paths that matter most:**

```
READ  (e.g. open a problem)
  browser ─GET /api/problems/:id─► API ─► content cache (memory) ── hit ──► + 1 small DB read (your status/draft) ─► JSON
                                                 └── miss ─► Postgres (once per process per minute or per publish)

WRITE (Submit)
  browser ─POST /api/submissions─► API: validate · idempotency · per-user limits · backpressure
                                    └► INSERT submission (status=queued) + NOTIFY ─► 202 {id}      (≈ 5–10 ms)
  grader  ◄── NOTIFY ── claims row (FOR UPDATE SKIP LOCKED) ─► sandbox ─► verdict ─► UPDATE row + user_problems (1 tx)
  browser ─GET /api/submissions/:id (poll, backoff)─► API ─► row ─► verdict shown
```

---

## 3. Technology choices — and why

Every choice below is a trade-off. "Why not X" matters as much as "why X".

### 3.1 Languages

| Layer | Language | Why | Rejected alternatives |
|---|---|---|---|
| Frontend | **JavaScript + React 18** | Already in use; the ecosystem (CodeMirror, Vite) fits an editor-heavy app | Next.js (SSR adds a server we don't need: the pages that matter are behind login; SEO pages are few) |
| API | **Node.js (JavaScript)** | The API is **I/O-bound**: almost all time is spent waiting on Postgres. Node's event loop handles thousands of concurrent waits on one thread. Same language as the frontend, so the grading logic (`shared/`) is shared byte-for-byte | Go/Java would be faster per CPU, but CPU isn't the API's bottleneck (§9); a second language would split the shared grading code |
| Grader orchestration | **Node.js** | Spawns, supervises and kills sandboxes; mostly waiting. Shares `shared/grader/payload.js` with the browser | Python orchestrator — would need a second copy of payload logic |
| Graded code | **Python, SQL** (run inside **Pyodide/WebAssembly**) | Learners write Python, SQL and PySpark; the harness is Python | — |
| Database logic | **SQL** (PostgreSQL) | Constraints, transactions and the queue are all expressed in SQL | ORM — hides the exact queries and locks we rely on (§8.7); plain SQL keeps them reviewable |

### 3.2 Databases — polyglot only where it earns its keep

| Store | Holds | Why this store |
|---|---|---|
| **PostgreSQL** | Users, sessions, courses, modules, tracks, problems, tests, progress, drafts, submissions **and the grading queue** | Needs **uniqueness** (one account per email), **foreign keys**, **multi-row transactions** ("record the verdict AND mark the problem solved" atomically), **aggregates** (solved counts). JSONB covers document-shaped parts (test inputs, table schemas) without a second database. Its `FOR UPDATE SKIP LOCKED` + `LISTEN/NOTIFY` make it a correct, durable job queue — the submission and its job are *the same row*, so they can never disagree. |
| **MongoDB** (Atlas) | Legacy portfolio CMS only: blog posts, 1:1 bookings, newsletter subscribers, site copy | It was already there and works. Isolated in its own router (`server/legacy/`) so an Atlas outage can't affect learners. Migrating it gains nothing today. |
| **In-process memory** | Content cache (catalog, outlines, problem statements) | Content is identical for every user and changes only on publish: memory is the fastest possible store, and Postgres `NOTIFY` keeps every process's copy fresh (§6.4). |
| **Browser `localStorage`** | Unsaved code draft (backup) | Instant restore on reload and survives a dropped connection. The server copy is authoritative across devices. |

**Why not Redis (yet)?** Redis is the usual answer for caching, rate limiting and queues. Here each job is already done by something simpler with fewer moving parts:

| Typical Redis job | How DataDrill does it today | When to add Redis |
|---|---|---|
| Cache | Per-process memory + `NOTIFY` invalidation | When content no longer fits comfortably in RAM, or you need a cache shared across many machines |
| Job queue | Postgres `SKIP LOCKED` (durable and transactional with the data) | When queue throughput passes ~1–2k jobs/s, or you want priorities and delayed jobs |
| Rate limiting | Exact limits in Postgres (submissions, login lockout) + approximate per-process token buckets (per-IP abuse) | When per-IP limits must be exact across many API instances |
| Sessions | Stateless JWT access token, refresh sessions in Postgres | Not needed |

Every extra datastore is another thing that can go down, needs backups and must be monitored. At the target scale (thousands of users, ~100 concurrent requests) Postgres alone is comfortably within its limits (§9). The code is written so these upgrades are local changes: `lib/cache.js`, `lib/rateLimit.js`, `grader/index.js` claim().

### 3.3 Frameworks & libraries

| Library | Used for | Why |
|---|---|---|
| **Express 4** | HTTP routing | Minimal and well understood; middleware order is explicit (§6.1) |
| **pg** | Postgres driver + pool | Battle-tested; exposes `LISTEN/NOTIFY` |
| **zod** | Request validation | Schemas double as documentation; precise error messages |
| **jsonwebtoken** | Access tokens (HS256) | Standard |
| **node:crypto scrypt** | Password hashing | Built in (no native build step), memory-hard |
| **helmet** | Security headers | Sensible defaults |
| **pino** | Structured JSON logs | Fast; one line per event; machine-parseable |
| **CodeMirror 6** | Editor | Modular, small, accessible, excellent language support (indentation, autocomplete, bracket matching) |
| **Pyodide 314.0.8** | CPython in WebAssembly — browser *and* server | Runs real Python without installing anything; same engine in both places |
| **DuckDB** (Pyodide package) | SQL engine for the SQL track and under PySpark | Warehouse-style SQL (window functions, `QUALIFY`), embedded, fast |
| **sqlframe 4.10** | The PySpark DataFrame API on top of DuckDB | Learners write real `from pyspark.sql import …` code, with no JVM or cluster |
| **pandas 3** (Pyodide package) | The pandas track | Real pandas in the same Python runtime as the Python track |
| **just-bash 3.6** (Apache-2.0) | The Shell track: a bash interpreter written in TypeScript with an in-memory filesystem | No real processes, no network, execution limits — safe enough to run learner scripts in the browser *and* the grader (§8.11) |
| **@codemirror/legacy-modes** | Shell syntax highlighting (`StreamLanguage`) | The official CodeMirror shell mode |
| **fflate** | Browser stand-in for `node:zlib` (`src/shims/zlib.js`) | just-bash imports `node:zlib` for `gzip`; Vite aliases it to this small shim |
| **marked + highlight.js** | Course markdown → HTML with code highlighting | Small and fast |

---

## 4. Repository map

```
portfolio-react/
├── docs/ARCHITECTURE.md          ← this handbook
├── CLAUDE.md                     ← rules for AI-assisted changes (keep docs updated)
├── index.html, vite.config.js    ← web app entry & build (worker format: es)
├── src/                          ← React frontend
│   ├── main.jsx                  ← path routing, code-split per area, AuthProvider
│   ├── lib/api.js                ← fetch wrapper: CSRF header, 401 → refresh → retry
│   ├── lib/useApi.js             ← data hooks (useApi, useCatalog)
│   ├── auth/                     ← AuthContext (who is signed in), auth pages
│   ├── platform/                 ← Shell (nav, footer, layout), theme CSS, brand copy
│   ├── landing/                  ← landing page
│   ├── learn/                    ← catalog, course page, module reader, markdown renderer
│   ├── practice/                 ← hub, track page, workspace, CodeEditor, runner/ (Run)
│   ├── profile/                  ← ProfilePage (/u/:username), Leaderboard, charts.jsx (SVG)
│   ├── contests/                 ← ContestsHome (/contests), ContestPage (lobby/arena/results), useContest (SSE)
│   ├── shims/zlib.js             ← node:zlib → fflate, for just-bash in the browser
│   ├── docs/DocsPage.jsx         ← /docs/:slug reader (this handbook, admins)
│   └── admin/, blog/, components/← legacy portfolio CMS UI
├── shared/                       ← code used by BOTH browser and server
│   ├── grader/harness.py         ← THE grading logic (Python)
│   ├── grader/payload.js         ← test case → harness input; verdict rules
│   ├── grader/runtime.js         ← Pyodide version, per-track packages
│   ├── grader/shell.js           ← Shell-track grading (just-bash), same result shape as harness.py
│   ├── grader/points.js          ← points rule (attempt multipliers)
│   └── content/slug.js           ← heading ids (lesson links ↔ rendered anchors)
└── server/
    ├── src/
    │   ├── cluster.js            ← entry: migrations, then fork API workers, restart on crash
    │   ├── server.js             ← HTTP server, timeouts, graceful shutdown, cache invalidation
    │   ├── app.js                ← middleware order + routers
    │   ├── config.js             ← every tunable, validated at boot
    │   ├── db.js                 ← pool, transactions, migration runner
    │   ├── logger.js
    │   ├── lib/                  ← errors, cache, rateLimit, crypto, users (usernames), events (SSE fan-out)
    │   ├── contests/             ← rules.js (draw + scoring, pure), standings.js (recompute + NOTIFY), guards.js
    │   ├── middleware/           ← auth (cookies/JWT/roles), http (CSRF, logs, errors)
    │   ├── content/store.js      ← content writes (derivations) + cached reads
    │   ├── content/docs.js       ← docs sync (repo markdown → `docs` table) + cached reads
    │   └── modules/              ← auth, learn, practice, submissions, profile, contests, admin, docs
    ├── grader/
    │   ├── index.js              ← grader service: lanes, pools, queue, leases, reaper
    │   ├── sandbox.js            ← the sandboxed child process
    │   ├── packages.js           ← Pyodide packages per track
    │   ├── prepare.js            ← one-time: vendor wheels, warm package cache
    │   └── wheels/               ← pinned sqlframe/sqlglot/prettytable wheels
    ├── migrations/*.sql          ← schema, applied in order, never edited after release
    ├── content/                  ← SEED SOURCE: courses.js + courses/*.md, tracks.js,
    │                                challenges.js, problems/*.js, docs.js (docs manifest)
    ├── scripts/                  ← migrate, seed, make-admin, seed-test-users, verify-problems, loadtest
    ├── test/api.test.js          ← integration tests (real HTTP, Postgres, grader)
    ├── test/contest-rules.test.js← unit tests: problem draw + standings
    ├── legacy/                   ← MongoDB CMS router, models, default content
    └── mailer.js                 ← SMTP (password resets, booking emails)
```

---

## 5. Data model

All platform tables are in PostgreSQL; see `server/migrations/`. Migrations are applied **in order, once**, under a Postgres advisory lock (so several booting processes can't run one twice). They are append-only: never edit a released migration — add a new one (see `002_session_revoke_reason.sql` for an example).

### 5.1 Tables

```
users ──< sessions                  (refresh-token rotation families)
  │  └──< password_resets
  ├──< module_progress >── course_modules >── courses
  ├──< course_visits   >──────────────────────┘
  ├──< user_problems   >── problems >── tracks
  ├──< submissions     >──┘ │ └──< problem_tests
  │        └── contest_id ──┐│
  ├──< contests (host) ─────┤│
  └──< contest_participants >── contests ──< contest_problems >── problems
```

| Table | Purpose | Key design points |
|---|---|---|
| `users` | Accounts | Unique index on `lower(email)` (case-insensitive accounts). Public identity: `username` (unique on `lower(username)`, `[a-z0-9_]{3,24}`, generated from the name at signup), `headline`. `points` is a **denormalized total** kept in step by the grader in the verdict transaction, so rank is an index scan (migration 005). `failed_logins` / `locked_until` implement brute-force lockout *in the database*, so it holds across every API process. `role` ∈ {learner, admin}. |
| `sessions` | One row per signed-in device | Stores **only SHA-256 of the refresh token** — a leaked DB can't be replayed. `family_id` groups rotations; `revoke_reason` distinguishes normal rotation from logout or theft (§7.3). |
| `password_resets` | Reset tokens | Hashed, single-use, 30-minute expiry. |
| `courses`, `course_modules` | Course content | `course_modules.lessons` (JSONB) and `minutes` are **derived** from the markdown at write time. `slug` is globally unique (old `/guide/:slug` links resolve). |
| `tracks` | Practice tracks | `details` (JSONB) holds format, rubric and briefs for design/hackathon tracks. |
| `problems` | Problem statements | `version` increments only when content really changes (`content_hash`). `solution` is never sent until it's earned or revealed. Tags: `topics`, `patterns`, `domains`, `companies` (text[]); `sources` (jsonb, migration 007) = the public report behind each company tag; `interview`, `roles`, `case_study_id`/`case_study_part` (migration 009); `points` = base points (Easy 10 / Medium 20 / Hard 40). |
| `problem_tests` | Test cases | **A separate table on purpose**: the public problem query reads `WHERE NOT hidden`, so a serializer bug can't leak hidden tests. Only the grader reads all rows. |
| `module_progress`, `course_visits` | Learning progress, "continue where you left off" | Composite primary keys make writes idempotent (`ON CONFLICT`). |
| `user_problems` | Per user × problem: status (`todo` / `attempted` / `solved`), draft, `revealed_at`, submission count, `points` earned, `solved_attempt` | Updated **in the same transaction** as the verdict, so "Solved" can never disagree with the submissions. |
| `docs` | Website copy of repo documentation (this handbook) | `access` ∈ public/learner/admin; `content_hash` makes the boot-time sync a no-op when unchanged (§13.1). |
| `case_studies` | Interview case studies (migration 009): `title`, `summary`, `brief_md` (story + dataset), `roles`, `companies` | Parts are problems with `case_study_id` + `case_study_part` |
| `contests` | One timed round (migration 006) | `code` = 8-char invite code in the URL. `status` ∈ lobby/live/cancelled; **"ended" is derived** (`live AND ends_at <= now()`), so nothing has to run at the deadline. `settings` = the creator's filters. |
| `contest_participants` | Invited / joined / declined users, **plus cached standings** | `score`, `finish_ms`, `solved`, `wrong`, `pending`, `rank`, `detail` are recomputed from submissions on every contest verdict (§12.5) — a cache that can't drift. |
| `contest_problems` | The problems drawn at start, in order, with their points | Frozen at start: everyone gets the same set. |
| `submissions` | Every submission **and the grading queue** | `status` queued → running → done/failed; `locked_until` + `worker_id` = lease; `client_token` unique per user = idempotency; `track` routes it to a lane. `attempt_no` and `points_awarded` are written with the verdict (§8.13). `contest_id` tags contest submissions (same queue and grader). |

### 5.2 Indexes — each one exists for a specific query

| Index | Serves |
|---|---|
| `users_email_lower_key` (unique) | Login lookup; uniqueness |
| `sessions.refresh_hash` (unique) | Refresh lookup |
| `submissions_queue_idx (track, created_at) WHERE status='queued'` | **The queue claim.** Partial: it contains *only* waiting jobs, so it stays tiny however many millions of finished submissions pile up. |
| `submissions_running_idx (locked_until) WHERE status='running'` | Lease reaper |
| `submissions_user_recent_idx (user_id, created_at DESC)` | Per-user "submissions in the last minute" rate limit |
| `submissions_user_pending_idx (user_id) WHERE status IN (queued, running)` | "You already have a pending submission" fairness check |
| `submissions_user_problem_idx (user_id, problem_id, created_at DESC)` | Submission history per problem |
| `problems_track_idx (track_id, position)` | Problem lists |
| `users_username_lower_key` (unique) | Profile lookup `/u/:username`; uniqueness |
| `users_points_idx (points DESC)` | Rank (`1 + count(users with more points)`) and the leaderboard |
| `submissions_user_finished_idx (user_id, finished_at) WHERE status='done'` | Profile activity calendar and stats |
| `submissions_contest_idx (contest_id, created_at) WHERE contest_id IS NOT NULL` | Standings recompute (partial: practice submissions aren't in it) |
| `contest_participants_user_idx (user_id, created_at DESC)` | "My contests", invitations, profile contest history |
| `contest_problems_problem_idx (problem_id)` | "Is this problem in my running contest?" guard on practice Submit/Reveal |
| `contests.code` (unique), `contests_host_idx` | Contest by link; open-contests-per-host limit |

### 5.3 Why tests and content live in Postgres (not files or Mongo)

* **The grader and the API must agree on the version of a problem.** Submissions record `problem_version`, and the grader caches tests by `id@version`.
* **Atomic publishing**: an admin update replaces a problem and its tests in one transaction, so nobody is graded against half-updated tests.
* The repository files in `server/content/` are the *authoring source*; `npm run seed` syncs them into the database, which is the runtime truth.

---

## 6. The API

### 6.1 Middleware pipeline (order is deliberate — `src/app.js`)

```
helmet (security headers)
→ requestContext   request id (X-Request-Id), one access-log line per request with latency
→ cookieParser
→ express.json     256 KB cap (2 MB for the legacy CMS) — big bodies are rejected before work
→ authenticate     verifies the JWT cookie → req.user, or anonymous. NEVER rejects; costs no DB query
→ /api/health, /api/ready
→ platform router: per-IP token bucket → CSRF guard → auth | admin | learn | practice | submissions | profile | contests
→ legacy CMS router (MongoDB)
→ 404 → errorHandler (single JSON error shape)
```

### 6.2 Endpoints

**Public** (no account)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Liveness: the process is up |
| GET | `/api/ready` | Readiness: can reach Postgres (+ pool stats) |
| GET | `/api/catalog` | Courses, tracks (with problem counts), site stats — one call for landing/nav/footer |
| GET | `/api/courses`, `/api/courses/:id` | Outline (modules + lessons, no bodies) + your progress if signed in |
| GET | `/api/modules/:slug/locate` | Old `/guide/:slug` → course |
| GET | `/api/tracks`, `/api/tracks/:id` | |
| GET | `/api/problems?track=` | Metadata list (incl. tags, points, acceptance stats) + your status if signed in |
| GET | `/api/users/:username/profile?tz=` | Public profile (§11). `tz` = IANA zone for the calendar; invalid → UTC. The full submission list is included **only for the owner**; never email or code |
| GET | `/api/leaderboard` | Top 100 by points; ties share a rank; cached 30 s per process |
| GET | `/api/interview` | Case studies (ordered parts) + interview-tagged questions, with your status if signed in |
| GET | `/api/case-studies/:id` | One case study: brief + parts |
| GET | `/api/users/search?q=` | Username prefix / name search (signed in) — for contest invitations |

**Auth** (`/api/auth`) — see §7.

**Signed in**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/courses/:id/modules/:slug` | Lesson body (markdown) |
| GET | `/api/progress` · PUT `/api/progress/modules/:slug` · POST `/api/progress/visits` | Progress |
| GET | `/api/problems/:id` | Statement, schema, **visible** examples, starter, tags + acceptance stats, your draft/status/attempts/points, solution *only if unlocked* — and never while the problem is in your running contest (`state.liveContest` = its code) |
| PUT | `/api/problems/:id/draft` | Draft autosave (debounced by the client) |
| POST | `/api/problems/:id/reveal` | Unlock the solution (recorded; revealing **before** solving makes a later solve worth 0 points) |
| GET | `/api/practice/summary` | Solved counts by difficulty and track, "resume" target |
| POST | `/api/submissions` | Enqueue a submission → 202. Optional `contestId` (§12.6): 404 if you're not a player or the problem isn't in it, 409 after the deadline. A practice submission for a problem in your running contest → 409 |
| GET | `/api/submissions/:id` | Poll status/result (owner or admin; others get 404) + queue position (within its track), `attemptNo`, `pointsAwarded` |
| PATCH | `/api/auth/me` | Edit `name`, `username` (every account gets a unique one at sign-up, derived from the name — `lib/users.js`) (`[a-z0-9_]{3,24}`, 409 if taken), `headline` (≤ 80 chars) |
| GET | `/api/problems/:id/submissions` | Your last 20 |

**Contests** (`/api/contests`, all signed in — §12):

| Method | Path | Notes |
|---|---|---|
| GET | `/contests/options` | Code tracks with topics and problem counts (solved / total) — drives the create form |
| POST | `/contests` | `{mode: solo\|group, title?, tracks[], difficulties[], topics[], count 1–8, minutes 5–180, pool: unsolved\|solved\|both, invite: usernames[]}` → 201 `{code}`. Solo starts immediately. 400 if fewer problems match than requested; 429 if you host 3 open contests |
| GET | `/contests` | Your invitations, active (lobby/live) and past contests |
| GET | `/contests/inbox` | `{invitations, live}` counts — the nav badge |
| GET | `/contests/:code` | Contest, phase, `serverNow`, your state, problems (ids/titles only to players while live; to everyone after), standings, invitations, `provisional` |
| GET | `/contests/:code/events` | **SSE** stream of `update` events (max 6 per user per process) |
| GET | `/contests/:code/submissions?problem=` | Your submissions to one contest problem |
| POST | `/contests/:code/join` · `/decline` · `/leave` | Lobby only. The code is the invitation: anyone signed in with the link may join (max 10 players) |
| POST | `/contests/:code/invite` | Host, lobby: `{usernames[]}`; unknown username → 400 |
| POST | `/contests/:code/start` · `/end` · `/cancel` | Host only. Start draws the problems; end sets `ends_at = now()`; cancel only from the lobby |

**Docs**: `GET /api/docs` (docs you may read), `GET /api/docs/:slug` (markdown; 401 anonymous, 403 if the doc's `access` is above your role, 404 unknown).

**Admin** (`/api/admin`, role = admin): `GET /overview`, `GET /users`, `PATCH /users/:id`, `PUT /problems/:id`, `PUT /courses/:id`, `GET /submissions?status=`, `POST /submissions/:id/requeue`.

**Legacy CMS**: public `/api/content`, `/api/blogs`, `/api/booked`, `/api/bookings`, `/api/subscribe`, `/api/chat`; admin `/api/cms/auth/*`, `/api/cms/admin/*` (own password login, Bearer token).

### 6.3 Error model

Every error has the same shape and an HTTP status that means something:

```json
{ "error": { "code": "rate_limited", "message": "Human-readable sentence.", "details": [...] } }
```

| Status | When |
|---|---|
| 400 `validation`/`bad_request` | zod rejected the input (details list each field) |
| 401 `unauthenticated` | Not signed in / access token expired → client refreshes once |
| 403 `forbidden` | Wrong role, or missing CSRF header |
| 404 `not_found` | Also returned for *someone else's* submission (no id probing) |
| 409 `conflict` | Duplicate email |
| 413 `too_large` | Body over the cap |
| 429 `rate_limited` | With `Retry-After` |
| 503 `unavailable` | DB overloaded/unreachable, queue full — with `Retry-After` |
| 500 `internal` | Bug — logged with stack and request id; message is generic |

**Validation messages** are written for people: `friendlyIssue()` turns each zod issue into a sentence that names the field ("Duration must be at least 5…", "Tracks (each item) must be one of: …"); messages written in a schema are kept. `details` lists every issue with its path. A 500 carries a reference (the request id, also in the logs).

### 6.4 Content caching & invalidation

Content reads (`content/store.js`) go through `lib/cache.js`:

* **TTL cache per process** (default 60 s) with an LRU bound.
* **Single-flight loading**: if 100 requests miss the same key at once, only one query runs and the other 99 await the same promise. This prevents a *cache stampede* when an entry expires under load.
* **Push invalidation**: every content write ends with `NOTIFY content_changed`. Each API process holds a `LISTEN` connection and clears its cache on that signal. It also clears on reconnect, in case a notification was missed. Result: an admin edit is visible everywhere within milliseconds, with no Redis needed.
* Per-user data (status, progress, drafts) is **never** cached. It's a small indexed query merged on top of cached content.

---

## 7. Authentication & authorization

### 7.1 Model

```
Sign in ─► server sets two httpOnly cookies
   dd_at  access token  JWT {sub, role}, 15 min,  Path=/api        → verified with the secret: no DB hit
   dd_rt  refresh token random 32 bytes, 30 days, Path=/api/auth   → checked against sessions table
```

**Why cookies and not `Authorization: Bearer` in localStorage?** `httpOnly` cookies can't be read by JavaScript, so an XSS bug can't steal the session. We're same-site (the SPA and API share an origin via the proxy/CDN), so cookies are natural.

**Why a short access token plus a long refresh token?** Verifying a JWT needs only the secret (microseconds, no database), which keeps every authenticated request cheap at scale. The cost: revocation takes up to 15 minutes for an *access* token. Refresh tokens are stateful and revocable instantly, and they're needed every 15 minutes, so a revoked session dies within 15 minutes at most.

### 7.2 Flows

| Flow | What happens |
|---|---|
| **Sign up** | zod validation → scrypt hash → `INSERT` (unique `lower(email)` → 409 if taken) → session + cookies |
| **Log in** | Unknown email → hash a dummy password anyway (**equal timing**, so response time doesn't reveal which emails exist) → same generic error. Wrong password → `failed_logins++`; the 5th failure locks the account for 15 min (in Postgres → enforced on every API process). |
| **Refresh** | See §7.3 |
| **Logout / logout-all** | Revoke this session / all sessions; clear cookies |
| **Change password** | Requires current password; revokes all other sessions |
| **Forgot password** | Always answers the same message (no account probing); emails a single-use 30-min link (printed to the log in development without SMTP) |
| **Reset password** | Token checked by hash, marked used, password replaced, **all sessions revoked**, lockout cleared |

### 7.3 Refresh-token rotation with theft detection

Every refresh **revokes** the presented token and issues a new one in the same *family*:

```
login: T1 ──refresh──► T2 ──refresh──► T3          (each older one revoked: reason 'rotated')
                    attacker replays T1 later ──► T1 is revoked → REUSE DETECTED
                                                  → revoke the whole family (T3 too)
                                                  → both attacker and victim must sign in again
```

**Grace window.** Two tabs can refresh at the same moment with the same token, and the second would look like a replay. So a token rotated in the last 30 s, whose family is still alive, gets a new access token instead of tripping the alarm.

> **Bug found by the test suite (fixed in migration 002):** the first version applied the grace window to *any* recently revoked token, including ones revoked by **logout** or by **theft detection**. So for 30 s after logging out, the old refresh token still worked. Now sessions record `revoke_reason`, and grace applies only to `rotated` tokens in a living family. Tests: "logout revokes the session immediately", "replaying an old token revokes the session family", "two tabs refreshing at once both succeed".

### 7.4 CSRF

Cookies are attached automatically, even to requests a malicious site triggers. Two independent defences:

1. Cookies are `SameSite=Lax`, so browsers don't send them on cross-site POST/PUT/DELETE.
2. Every state-changing platform request must carry `X-Requested-With: datadrill`. A cross-site page can't add custom headers without a CORS preflight, and the API never approves one.

### 7.5 Authorization

| Policy | Where enforced |
|---|---|
| Catalog, outlines, problem lists are public | No guard |
| Lesson bodies, problem workspace, progress, drafts, submissions need an account | `requireAuth` |
| You can only read your own submissions | Ownership check (admins excepted); others get **404**, not 403 |
| Solutions only after solving or explicitly revealing | `user_problems.solved_at OR revealed_at` |
| Hidden tests never leave the server | Query shape (`WHERE NOT hidden`) + result redaction (§8.9) |
| Admin API | `requireRole('admin')`; promote with `npm run make-admin -- email` |
| Architecture handbook (`/docs/architecture`) | Admin-only (`docs.access`): it details sandbox internals, known limits and exact rate limits — useful to an attacker, not to learners. Role changes apply at the user's next sign-in or token refresh (≤ 15 min). |

The frontend mirrors these rules for UX (`RequireAuth` redirects to `/login?next=…`, and lesson links point at sign-in when signed out), but **the server is the authority**.

---

## 8. Code execution & grading

### 8.1 Two paths: Run and Submit

| | **Run** | **Submit** |
|---|---|---|
| Purpose | Fast feedback while coding | The official verdict |
| Tests | Visible examples only | **All** tests incl. hidden |
| Where it executes | **In the learner's browser** (Web Worker) | **On our grader service** |
| Server cost | **Zero** | One sandboxed job |
| Latency | ~5–500 ms after the first runtime load | Queue wait + ~0.1–3 s |
| Can it be trusted? | No (the user controls the browser) | Yes |

**Why split it?** Most of the time spent on a coding problem is *Run, edit, Run, edit*. Executing those runs in the browser moves the most frequent, most CPU-hungry operation off our servers. Only the final Submit costs us anything. That makes the grading tier several times cheaper than a design where every Run hits the server.

### 8.2 How this differs from LeetCode

| | LeetCode-style judges | DataDrill |
|---|---|---|
| Where Run executes | Server (every click is a job) | **Browser** (WebAssembly) — free to us |
| Isolation unit | Container / VM per run (seccomp, cgroups) | **WebAssembly sandbox inside a locked-down OS process** (§8.4) |
| Start-up cost | ~100 ms–1 s per container | Python ~0.1 s (memory snapshot), SQL ~0 (reused), PySpark ~3 s (pre-warmed spares) |
| Language runtimes | Native compilers/interpreters | CPython-in-WASM (Pyodide) + DuckDB + sqlframe |
| Spark | Not offered (needs a JVM cluster) | **PySpark API** via sqlframe on DuckDB — real `pyspark.sql` code, no cluster |
| SQL grading | Usually MySQL/Postgres servers | **Fresh in-memory DuckDB per test case**, external access disabled |
| Same engine for Run and Submit? | Yes (both server) | **Yes** — same Pyodide version and the same `harness.py` in browser and server, so "passes Run" means the same thing in both places |

The key insight: WebAssembly gives us a memory-safe sandbox that starts fast and runs anywhere, including the user's own machine. That's what makes the Run/Submit split possible.

### 8.3 The harness — one grading implementation

`shared/grader/harness.py` is the **only** code that executes and compares results. It runs in three places: the browser worker (Run), the grader sandboxes (Submit) and `npm run verify:problems` (the content quality gate). `shared/grader/payload.js` converts a problem's tests into harness input, also identically everywhere.

Per test case:

| Track | Execution | Compared as |
|---|---|---|
| SQL | New in-memory DuckDB (locked down) → create tables → insert rows → run the learner's query | Table: same columns (case-insensitive), same row count, same rows; **order checked** when the problem requires it ("Right rows, wrong order — check your ORDER BY") |
| Python | `exec` the learner's code in a fresh namespace → call `entry(*deepcopy(args))` | Value equality, with specific messages ("Expected 3 item(s), got 4", "First difference at index 2") |
| PySpark | Build input DataFrames with explicit schemas → call `entry(spark, *dfs)` → must return a DataFrame → `collect()` | Table (as SQL) |
| pandas | Build typed input DataFrames (`Int64`, `float64`, `string`, `boolean`; DATE/TIMESTAMP via `to_datetime`) → call `entry(*dfs)` → must return a DataFrame | Table (as SQL); the index is ignored; `pd.NA`/`NaT` → null |
| Shell | **Not** harness.py: `shared/grader/shell.js` runs the script in a fresh just-bash shell per test with the test's files in `/home/learner` (+ optional stdin) | stdout as text; trailing spaces and trailing blank lines ignored; message names the first differing line |

Values are normalized before comparing: floats rounded to 4 places (`30.0 == 30`), datetimes to ISO strings, NaN → null. stdout is captured per test (capped). Learner tracebacks are trimmed to frames from `solution.py`.

### 8.4 Sandbox isolation — defence in depth

Learner code is untrusted. Each grader sandbox is a child process started like this:

```
node --permission --allow-fs-read=<pyodide pkg, wheels, sandbox dir, harness, snapshot>
     --max-old-space-size=512  sandbox.js <track> …        env = {} (empty)
```

| Layer | Stops |
|---|---|
| **Separate OS process** | A crash, OOM or infinite loop affects only this sandbox. The supervisor enforces the time limit by `SIGKILL` (a synchronous loop can't be interrupted any other way). |
| **Node permission model** (`--permission`) | No filesystem writes, no reads outside the allow-list, no child processes, no worker threads, no native addons |
| **Empty environment** | `process.env` holds no secrets (no DB URL, no JWT secret) |
| **WebAssembly** | Python runs in linear memory with a virtual filesystem; no host syscalls. `/etc/passwd` doesn't exist in there. |
| **Python↔JS bridge removed** | After setup we `unregisterJsModule('js')` / `('pyodide_js')`, purge them from `sys.modules`, and delete `fetch` / `WebSocket` / `XMLHttpRequest`. |
| **just-bash** (Shell) | Learner scripts never reach a real shell: an interpreter with an in-memory filesystem holding only the test's files, no network, `python`/`node` disabled, and command/loop/recursion limits (§8.11) |
| **DuckDB lockdown** (SQL) | `enable_external_access=false`, extension autoload/autoinstall off, `lock_configuration=true`, so no `read_csv('/…')`, `COPY`, `ATTACH`, `INSTALL` |
| **(Production) network policy** | The grader container gets **no network egress**. This is the real boundary for network access (see below). |

**Verified by experiment** (prototype + integration test): `import js`, `__import__('js')`, `importlib.import_module('pyodide_js')`, `pyodide.code.run_js(...)`, re-importing `js` after deleting it from `sys.modules` → all `ModuleNotFoundError`. `open('/etc/passwd')` → not found. `subprocess` → "emscripten does not support processes". `os.environ` shows only Pyodide's fake environment. A raw `socket.connect` + `sendall` to a listening local port delivered **nothing**. SQL `read_csv('/etc/passwd')` → Runtime Error (integration test).

**Honest limits:** Python-level isolation is never airtight on its own. That's why it's layer 5 of 6, not the only layer. Node's permission model doesn't restrict the network, so production must run the grader with egress blocked. WASM memory can grow to a few GB, so production should set container memory limits.

### 8.5 Sandbox reuse policy — and the cross-user risk

Starting a sandbox is the expensive part, so reusing them is tempting. But **if user A's Python runs in the same interpreter as user B's next submission**, A's code could monkey-patch the harness (`sys.modules['__main__']`, builtins…). It could then make B's code pass or fail, or stash B's code and print it out on A's next visible test.

So:

| Track | Policy | Why it's safe |
|---|---|---|
| **SQL** | **Reused** across jobs | The learner's input is SQL, never executed as Python. Each test case gets a brand-new locked-down in-memory database. Nothing persists between jobs. |
| **Python** | **Single-use**: one job, then killed | The learner's input *is* Python. A fresh interpreter per job removes any cross-user influence. |
| **PySpark**, **pandas** | **Single-use** | Same reason (pandas code is Python) |
| **Shell** | **Reused** across jobs | The script is interpreted by just-bash, never executed as JS; each test case gets a new `Bash` instance with its own in-memory filesystem, so nothing persists between jobs |

### 8.6 Making single-use fast: memory snapshots and warm spares

Measured on the dev machine (Apple Silicon, 10 cores):

| Sandbox start | Time | RAM |
|---|---|---|
| Python, cold boot | ~940 ms | ~200 MB |
| **Python, restored from memory snapshot** | **~115 ms** | ~200 MB |
| SQL (DuckDB), cold boot | ~1.6 s | ~600 MB |
| PySpark (DuckDB + sqlframe), cold boot | ~3.0 s (≈7 s when 8 boot at once) | ~600 MB |
| pandas, cold boot | ~2.9 s | ~470 MB |
| Shell (just-bash, no Pyodide) | well under 0.1 s | small |

* **Python snapshot.** At startup the grader boots one pristine interpreter, loads the harness, and captures its memory image with `makeMemorySnapshot()`. This happens in a locked-down child, and the image goes to a temp file. Each Python sandbox restores from it in ~0.1 s, an 8× speed-up. If snapshotting ever fails, sandboxes fall back to a normal boot.
* **Why not snapshot SQL/PySpark?** DuckDB is a compiled WebAssembly library loaded at runtime, and this Pyodide version can't restore snapshots containing such libraries (we tried; restore fails). Plain Python state snapshots work.
* **Warm spares.** Each lane keeps `warm` idle, pre-booted sandboxes, so the first jobs of a burst start immediately and replacements boot in the background.

### 8.7 The queue: Postgres as a durable job queue

The `submissions` table **is** the queue. The API inserts a row; graders claim rows:

```sql
UPDATE submissions SET status='running', attempts=attempts+1, worker_id=$me,
       locked_until = now() + 60s
WHERE id = (SELECT id FROM submissions
            WHERE status='queued' AND track=$lane
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED LIMIT 1)        -- ← the key line
RETURNING …;
```

* **`FOR UPDATE SKIP LOCKED`**: concurrent graders each lock a *different* row and skip rows others hold. No double-processing, no blocking, any number of graders on any number of machines.
* **Durable**: a queued job survives API restarts, grader restarts and machine reboots. It's a committed row.
* **Wake-up**: the API's insert transaction ends with `NOTIFY submission_queued '<track>'`, which is delivered only after commit, so the grader never sees a row that isn't there yet. Graders also poll every 2 s in case a notification was missed (e.g. during a reconnect).
* **Leases**: a claim sets `locked_until = now() + 60s`. Every 15 s a **reaper** returns expired `running` jobs to `queued`, or after 3 attempts marks them `failed` with verdict "Internal Error", so a poison job can't loop forever.
* **Fencing**: the grader writes its verdict with `WHERE id=$job AND worker_id=$me AND status='running'`. If this grader stalled past its lease and another one re-ran the job, the late write affects 0 rows and is discarded.
* **One transaction for the outcome**: the verdict UPDATE, the `user_problems` upsert (solved status, submission count, points), the user's points and — for a contest submission — the contest standings (§12.5) commit together.
* **Graceful shutdown**: on SIGTERM the grader stops claiming, waits up to 25 s for in-flight jobs, and puts anything unfinished straight back in the queue.

**Idempotency.** The browser generates a `clientToken` (UUID) per Submit click and reuses it if it retries after a network error. `UNIQUE(user_id, client_token)` + `ON CONFLICT DO NOTHING` means a retried POST returns the original submission, never a duplicate.

### 8.8 Lanes (the bulkhead pattern)

Each track has its **own** claim loop, concurrency limit and sandbox pool (`config.grader.lanes`: `sql`, `python`, `pyspark`, `pandas` (≤ 3, cores/4), `shell` (2); env `GRADER_<TRACK>_CONCURRENCY`, `GRADER_WARM_<TRACK>`). Without lanes, a burst of slow PySpark jobs (3 s+ each) occupies every slot while quick SQL jobs wait behind them. With lanes, PySpark can only ever use the PySpark lane's capacity.

Measured effect in the 100-submission burst (§9.3): the slowest Python job's time-to-verdict fell from **42.9 s → 4.9 s** (lanes + snapshots together).

### 8.9 Keeping hidden tests hidden

1. The workspace API never selects hidden rows (`WHERE NOT hidden`). The integration test greps the response for hidden test names.
2. Grader results for hidden tests are **redacted** before storage: name → "Hidden test N", no input, no output, **no stdout** (else `print(input)` would leak them), no traceback; errors are reduced to the exception type.
3. Run (in the browser) only ever receives visible examples.

### 8.10 Overload protection on Submit (in order)

1. **Idempotency** (§8.7).
2. **Fairness**: max 2 queued or running per user ("wait for your previous submission").
3. **Rate limit**: max 10 per user per minute, counted in Postgres, so it's exact across all API processes.
4. **Backpressure**: if more than 2,000 jobs are queued, answer 503 + `Retry-After` instead of accepting work we can't finish soon (the depth check is cached for 1 s).

### 8.11 The Shell track runtime (just-bash)

**Choice.** Real bash in the grader would mean real processes and a real filesystem — exactly what §8.4 works to deny — and it couldn't run in the browser at all. [just-bash](https://www.npmjs.com/package/just-bash) is a bash interpreter written in TypeScript: pipes, redirection, functions, loops, `grep`/`sed`/`awk`/`sort`/`uniq`/`cut`/`tr`/`wc`/`head`/`tail`/`jq` and more are implemented in-process over an **in-memory filesystem**. So the *same* engine runs Run (browser worker, no Pyodide download) and Submit (grader sandbox), like the other tracks.

**Verified by experiment:** `cat /etc/passwd` → no such file; `curl`, `python3`, `node` → not available; `while true; do :; done` → stopped by `maxLoopIterations`; the integration test submits an escape attempt and gets a normal Wrong Answer.

**Compatibility shim.** just-bash 3.6 mis-sorts numeric keys on lines with leading blanks (the classic `uniq -c | sort -k1,1nr`) unless `-b` is given. Real sort ignores those blanks for numeric keys, so `shell.js` prepends a `sort()` function that adds `-b` whenever `-k` is used. Problem expected outputs are checked against **both** real bash and just-bash before release.

**Problem format.** Each test: `files` (path → text, relative to `/home/learner`), optional `stdin`, `expected` (text). The browser shows the files and the expected output as text blocks.

**Limits.** It's not GNU bash: rarely used flags may be missing. Learners see "command not found"-style errors in stderr, which is shown for visible tests.

### 8.12 Problem tags — taxonomy and why

We studied how practice sites tag problems before choosing ours:

| Site | What it tags / filters by |
|---|---|
| LeetCode | Difficulty, topic tags (Array, Hash Table, Window Functions…), company tags (premium), acceptance %, status, lists |
| GeeksforGeeks | Difficulty, topic, company (crowd-reported), Submissions + Accuracy columns |
| DataVidhya | Difficulty, question type (SQL/Python/PySpark), skill |
| HackerRank / StrataScratch | Difficulty, skill/subdomain, company (StrataScratch: sourced from real interviews), question type |

DataDrill tags every problem with:

| Tag | Meaning | Source of truth |
|---|---|---|
| `difficulty` + `points` | Easy / Medium / Hard; base points 10 / 20 / 40 | Problem file |
| `topics` | Skills, **only** from the track's taxonomy (`content/tracks.js`); `verify:problems` rejects others | Track taxonomy |
| `patterns` | Reusable technique, shared across tracks ("Top-N per group", "Filter → join → aggregate", "Frequency count (sort \| uniq -c)") — LeetCode's most useful idea, applied to data work | Problem file |
| `domains` | Scenario industry (E-commerce, Web server logs…) | Problem file |
| `companies` | Companies a **public source** reports asking this question type (e.g. DataLemur, SparkPlayground, StrataScratch). Each one must have a matching `sources` entry `{company, label, url}`; the brief shows them as "Asked at" chips linking to the source, the track page can filter by company. Problems are original — only the *type* is attributed. Shell sources name no companies, so Shell has none | Problem file (`sources`), enforced by `verify:problems` |
| Acceptance | Submissions, accepted, solvers, acceptance % — computed, cached 60 s (`getProblemStats`) | Database |

The track page filters by topic (sidebar), difficulty, company, pattern and status, and shows Skills · pattern, Acceptance and Difficulty + points columns.

**The bank** (198 problems: SQL 178 — 52 Easy / 81 Medium / 45 Hard, 4 case studies, 111 with sourced company tags across 75 companies — plus Python 5, PySpark 5, pandas 5, Shell 5) and the research behind it — sources studied, which reported question types each problem covers, and a backlog of the ones not yet written — live in [`docs/QUESTION_BANK.md`](QUESTION_BANK.md).

**Content audit** (`npm run verify:problems`), run before every seed: required fields; topics from the taxonomy; ≥ 1 pattern and domain; every company backed by an https source; ≥ 1 visible and ≥ 2 hidden tests with unique names; table rows matching the schema and output columns; Python `entry` matching its signature; then the reference solution must pass every test and the starter must fail at least one. Shell solutions are additionally cross-checked on real `/bin/bash` (just-bash compatibility).

### 8.13 Points

| | Rule |
|---|---|
| Base | `problems.points`: Easy 10, Medium 20, Hard 40 |
| Award | Only on the **first Accepted** for a problem; later Accepted submissions earn 0 |
| Attempt multiplier | 1st attempt 100 %, 2nd 50 %, 3rd 25 %, 4th and later 0 (`shared/grader/points.js`) |
| Attempt count | Earlier graded submissions to the same problem by the same user, including this one. `failed` jobs and "Internal Error" verdicts don't count — our failures shouldn't cost the learner |
| Solution viewed first | If `revealed_at` is before the solving submission was created → 0 points |

**Where it's computed:** in the grader's verdict transaction (`grader/index.js` `finish()`), after the fenced UPDATE: lock the `user_problems` row (`FOR UPDATE`), count attempts, compute points, then write `submissions.attempt_no/points_awarded`, `user_problems.points/solved_attempt` and `users.points += points` together. The row lock serializes two verdicts for the same user × problem, so points can't be awarded twice.

**Why the attempt count is done in SQL:** `created_at` has microsecond precision; a JS `Date` keeps only milliseconds, so a "created at or before mine" comparison in JS missed the submission's own row (we saw `attempt_no = 0`). The query compares `(created_at, id)` row-wise inside Postgres instead.

The workspace shows what the next attempt is worth ("Your 2nd attempt is worth 10 points"), warns before revealing the solution, and the verdict banner shows the attempt number and points earned.

---

### 8.14 Interview prep: interview tags, roles and case studies

Interview content is part of the problem bank, not a separate system, so it uses the same grader, points, contests and profile:

| Field (problem) | Meaning |
|---|---|
| `interview` | The question is interview-typical (shown with an **Interview** tag and on `/interview`) |
| `roles` | Data roles it prepares for: Data Engineer · Data Analyst · Data Scientist · Analytics Engineer (`src/content/roles.js`) |
| `caseStudy: { id, part }` | The problem is part *n* of a **case study** |

A **case study** (`case_studies` table, migration 009) is one realistic dataset and story with 3–4 parts that build on each other and get harder — the multi-question format of OAs and onsite SQL rounds. Its brief (story + table descriptions) is shown on the case page and, collapsible, above every part in the workspace, with links to the previous/next part. The audit requires parts numbered 1..n (n ≥ 2); a test checks difficulty never decreases from one part to the next.

**Why a section, not only a tag:** the Interview page (`/interview`) groups case studies and interview questions by role across tracks, and is where future interview material (basics, courses, mock rounds) will live. The tag keeps those problems in their tracks too, so nothing is duplicated.

Endpoints: `GET /api/interview` (case studies with ordered parts + interview questions, user status merged), `GET /api/case-studies/:id` (brief + parts). Both public and cached per process.

## 9. Scalability: capacity model & measured numbers

### 9.1 Where the load goes

| Operation | Cost | Scales with |
|---|---|---|
| Page/content reads | Memory lookup + ≤1 indexed query | API processes (CPU), Postgres reads |
| Auth on every request | JWT verify (no DB) | API CPU |
| Draft autosave | 1 upsert, debounced 1.5 s per user | Postgres writes |
| Run | **0 server work** | — |
| Submit | 1 insert + polling + 1 sandbox job | **Grader CPU** |

The API is cheap and stateless. **Grading is the only expensive thing**, and it's isolated in its own horizontally scalable tier.

### 9.2 Connection math (Postgres `max_connections` = 100 by default)

```
API:     WEB_CONCURRENCY processes × PG_POOL_MAX (10)  + 1 LISTEN each
Grader:  4 per grader process                          + 1 LISTEN
Example: 4 API procs → 40 + 4,  1 grader → 4 + 1  ≈ 50 connections
```

When processes × pool size approaches `max_connections`, put **PgBouncer** (transaction pooling) in front. LISTEN connections must bypass it (session mode) or go straight to Postgres. Every query has a `statement_timeout` (5 s), and acquiring a connection times out after 3 s → 503, so overload produces fast, explicit failures, not a pile-up.

### 9.3 Load test results

`npm run loadtest` (in `server/`) on the development laptop (Apple M-series, 10 cores, 24 GB). API: 4 cluster workers. Postgres 18 local. 1,000 synthetic users. **100 concurrent connections**, 15 s per scenario.

| Scenario | Throughput | p50 | p99 | Errors |
|---|---|---|---|---|
| Public catalog `GET /api/catalog` | **12,074 req/s** | 7 ms | 24 ms | 0 |
| Problem page, signed in `GET /api/problems/:id` (cache + 1 DB read) | **9,844 req/s** | 9 ms | 22 ms | 0 |
| Draft autosave `PUT …/draft` (1 DB write) | **8,126 req/s** | 12 ms | 21 ms | 0 |

**Submission burst**: 100 different users press Submit at the *same instant* (60 SQL, 25 Python, 15 PySpark, all correct):

| | Before lanes + snapshots | After |
|---|---|---|
| All 100 accepted by the API | 435 ms | 338–441 ms |
| All 100 graded | 55.2 s | ~38–42 s |
| Verdicts | 100 Accepted | **100 Accepted, 0 failures** |
| Slowest Python verdict | 42.9 s | **4.9–5.6 s** |
| Slowest SQL verdict | 22.7 s | 19.8 s |
| Slowest PySpark verdict | 53.9 s | 37.5–41.8 s |

Per-job breakdown (from grader logs), averages: Python wait 2.6 s, acquire 0.39 s, run 0.34 s; SQL wait 14 s, acquire 0.55 s, run 0.75 s; PySpark wait 19 s, acquire 3.6 s, run 1.5 s. **Jobs mostly wait for CPU**: all lanes plus Postgres share one 10-core machine, which grades a mixed burst at ~2.4 jobs/s.

**Reading these numbers against the requirement** ("100 requests at a time from ~1,000 users, no failures"):

* The HTTP tier handled 100 *concurrent connections* at roughly **100× the request rate** that 1,000 active users generate (a user clicks a few times a minute), at p99 ≤ 24 ms, with zero errors.
* A worst-case burst of 100 simultaneous Submits was absorbed in under half a second and **every one was graded correctly**. Nothing failed or was lost. The cost of a burst is *waiting*, never an error.
* Fixes found by the load test: a server setting (`maxRequestsPerSocket`) was making Node answer 503 after 1,000 requests on a keep-alive connection, and slow PySpark jobs were starving other tracks. Fixed with the setting removed and lanes added.

### 9.4 Scaling playbook — what to change, in order

| Symptom | Action |
|---|---|
| Submissions wait too long | **Add grader processes/machines** (linear thanks to SKIP LOCKED), or raise lane concurrency on bigger machines (~1 core per concurrent job) |
| API CPU high | More API processes/instances behind a load balancer (stateless) |
| Postgres connections near the limit | PgBouncer |
| Postgres CPU high on reads | Already cached; next add read replicas for list queries |
| Static assets / global latency | CDN in front of the web app |
| Per-IP limits must be exact across many instances | Move `lib/rateLimit.js` buckets to Redis |
| Very high queue throughput (≫1k jobs/s) | Move the queue to a dedicated broker (Redis Streams / SQS); keep Postgres as the record |
| `submissions` table huge | Partition by month and archive old `results` JSON |

### 9.5 Problem content at scale — files or database? (review 2026-11-18)

**Decision: keep exactly the current split.** Problem files in `server/content/problems/` are the *authoring source*; PostgreSQL is the *only runtime store*. The API and grader never read problem files (enforced by `test/architecture.test.js`), and the browser bundle never imports server content (same test). Why this holds up as the bank grows:

| Concern | How it scales | Limit / next step |
|---|---|---|
| Serving a problem | One cached row per problem per process (`contentCache`, `NOTIFY` invalidation) + the user's own state | Fine at any realistic bank size |
| Track lists | One cached list per track (metadata only, no tests) | ~1,000 problems per track before the payload (~300 KB) warrants server-side paging/filtering |
| Grading | The grader loads tests by `id@version` from `problem_tests` and caches them | Independent of bank size |
| Hidden tests | Live only in `problem_tests`; never in files the API serves, never in the bundle | — |
| Contests | Candidate query filters by track/difficulty/topics with an index on `(track_id, position)` | Fine to tens of thousands of problems |
| Seeding | Idempotent, content-hashed (unchanged problems are skipped), one transaction | Thousands of problems in seconds; a deploy must run `npm run seed` |
| Authoring | Git review + `verify:problems` audit + diffs | When non-engineers author at volume: an admin authoring UI writing to the DB through the same audit — then the DB becomes the source and files an export |

**Fixed in this review — the one real time bomb:** acceptance stats were computed by a `GROUP BY` over the **entire** `submissions` table, in every API process, every minute. At millions of submissions that is seconds of database work per minute per process, growing forever. They now come from `problem_stats` (migration 008), counters the grader updates in the verdict transaction (one upsert per verdict; concurrent verdicts on one problem serialize on its row for milliseconds). Reading them is a scan of one small table, cached 15 s.

**Also guarded now:** a problem file that isn't registered in `content/problems/index.js` fails `verify:problems` (it would otherwise silently never ship).

---

## 10. Failure modes & how each is handled

| # | Failure | What the user sees | What the system does | Recovery |
|---|---|---|---|---|
| 1 | Bug throws inside a request | Generic 500 with request id | `errorHandler` logs the stack; the process keeps serving | Fix the bug |
| 2 | Uncaught exception / unhandled rejection in an API process | That request fails | Process logs fatal and **exits** (state unknown) | `cluster` primary forks a replacement (exponential backoff if crash-looping) |
| 3 | Postgres down / restarting | 503 "temporarily overloaded — retry" | Connect timeout 3 s; `/api/ready` = 503 so the load balancer stops routing | Automatic when the DB returns; LISTEN connections reconnect with backoff and clear caches |
| 4 | Postgres slow / pool exhausted | 503 after ≤3 s, not a hang | `statement_timeout` 5 s kills runaway queries | Automatic; scale per §9.4 |
| 5 | MongoDB (Atlas) down | Blog/bookings degraded | Legacy router serves defaults or 503; **platform unaffected** | Automatic |
| 6 | Access token expired | Nothing visible | Client gets 401 → single shared refresh → retries the request | — |
| 7 | Refresh token stolen and replayed | Victim must sign in again | Whole session family revoked; warning logged | Password change advisable |
| 8 | Brute-force login | "Too many failed attempts" | Per-account lockout (DB) + per-IP limit | Auto-unlock after 15 min or password reset |
| 9 | Request flood from one IP | 429 + Retry-After | Token bucket | Automatic |
| 10 | Huge / malformed request | 413 / 400 | Rejected before any work | — |
| 11 | Slow or stalled client (slowloris) | — | `headersTimeout` 10 s, `requestTimeout` 30 s, `keepAliveTimeout` 5 s | — |
| 12 | Double-clicked Submit / network retry | One submission | Idempotency key | — |
| 13 | User spams Submit | 429 "wait for your previous submission" | Pending cap 2, 10/min (DB-exact) | — |
| 14 | Grading backlog explodes | 503 "busy, retry in a few seconds" | Backpressure at queue depth 2,000 | Add graders |
| 15 | Learner code infinite loop | "Time Limit Exceeded" | Sandbox SIGKILLed at 20 s; replaced | — |
| 16 | Learner code exhausts memory / crashes runtime | "Runtime Error — likely used too much memory" | Sandbox exit detected; replaced | — |
| 17 | Learner code tries to escape | Error in their own output | Blocked by §8.4 layers | — |
| 18 | Grader process crashes mid-job | Job stays "Grading…" a little longer | Lease expires (60 s) → reaper re-queues → another grader runs it | Automatic; after 3 attempts → `failed` + "Internal Error"; admin can requeue |
| 19 | Grader stalls past its lease, then finishes | — | Fenced write discarded; the newer grader's verdict stands | — |
| 20 | Sandbox fails to boot | Slight delay | Next idle/new sandbox used; persistent failure → job lease expires → retry | Check `grader:prepare` was run |
| 21 | NOTIFY lost (listener reconnecting) | Slight delay (≤2 s) | Poll timer claims jobs anyway | Automatic |
| 22 | Deploy / restart during traffic | In-flight requests complete | SIGTERM → stop accepting, drain ≤10 s; grader drains ≤25 s and re-queues the rest | — |
| 23 | Admin publishes content while users browse | New content within ms | `NOTIFY content_changed` → all caches cleared; problems versioned | — |
| 24 | Problem tests changed while a submission is queued | Graded against current tests | `problem_version` recorded on the submission | — |
| 25 | Browser offline while typing | Nothing lost | Draft in localStorage; server autosave retries on the next change | Reconnect |
| 26 | Tab closed before autosave | Draft kept | `pagehide` → `fetch(keepalive)` flush + localStorage copy | — |
| 27 | Polling during an API blip | Keeps waiting | Client keeps polling through 503/network errors (up to 2 min) | — |
| 28 | Frontend render bug in one panel | That panel shows an error | React error boundaries per workspace panel | — |
| 29 | Two migrations racing on boot | — | Advisory lock serializes; each applied once | — |
| 30 | Bad config at deploy (e.g. no JWT secret in prod) | Deploy fails fast | `config.js` throws at boot | Fix env |
| 31 | Port already in use (a second API instance started) | API refuses to start with a clear message | Worker hits `EADDRINUSE` → tells the primary (`{type:'fatal'}`) → whole cluster stops with exit code 1, instead of crash-looping with backoff | Stop the other instance (`lsof -nP -iTCP:3001 -sTCP:LISTEN`) or set `PORT` |
| 32 | Two verdicts for the same user × problem commit at once | Points awarded once | `user_problems` row locked `FOR UPDATE` in the verdict transaction; the second sees `solved_at` set → 0 points | — |
| 33 | Learner shell script loops forever / forks endlessly | "Wrong Answer" with a limit message, or TLE | just-bash execution limits; the sandbox time limit still applies | — |
| 34 | Invalid `tz` on the profile request | Calendar in UTC | Regex check + `AT TIME ZONE` probe; falls back to UTC | — |
| 35 | Contest deadline passes with submissions still queued | Board says "provisional" | A submission counts if it was **made** before `ends_at`, whenever it's graded; standings recompute on each verdict | Automatic once the grader catches up |
| 36 | Nobody is online when a contest's time runs out | — | Nothing needs to happen: "ended" is computed from `ends_at` on every read | — |
| 37 | Host ends the contest while a player submits | Either accepted (before) or 409 "time is up" (after) | Submit takes `FOR SHARE` on the contest row; end takes `FOR UPDATE` — they serialize | — |
| 38 | Two "start" clicks, or a join racing the start | One start; the late join gets 409 | Every lifecycle action locks the contest row and re-checks the phase | — |
| 39 | A browser's live stream drops (network, API restart, 15-min token expiry) | Board catches up within seconds | EventSource reconnects; on a 401 the client refreshes the session and reopens with backoff; a 20 s poll and a refresh exactly at the deadline back it up | — |
| 40 | An API process restarts with streams open | Brief reconnect | Shutdown ends all streams so the drain isn't held open; browsers reconnect to another process (`retry: 3000`) | — |
| 41 | A NOTIFY is missed during a LISTEN reconnect | Board stale ≤ 20 s at worst | On reconnect every stream is told to refresh (`emitAll`), plus the client poll | — |
| 42 | A contest job fails permanently (3 grader attempts) | It stops showing "…" | The reaper recomputes that contest's standings; Internal Error never costs a penalty | Player resubmits |
| 44 | Invalid contest form / API input | A specific message naming the field ("Number of questions must be a whole number", "Pick at least one track") | `friendlyIssue()` in `middleware/http.js` rewrites zod's defaults; the create form also explains why its button is disabled | — |
| 45 | Unexpected server error | "Something went wrong on our side (reference <request id>)" | Logged with the same request id | Quote the reference |
| 46 | Fixing form errors repeatedly | Never "too many requests" | Contest creation is capped per user per hour in the DB, checked **after** validation | — |
| 43 | Device clock is wrong | Countdown still right | The client measures `serverNow − local time` on every fetch and counts down on server time | — |

---

## 11. Frontend architecture

* **Routing** (`src/main.jsx`): path-based, no router library. Each area (landing, learn, practice, auth, admin, blog) is a **lazy-loaded chunk**, so the landing page doesn't download the 540 KB editor bundle.
* **API client** (`src/lib/api.js`): adds the CSRF header and normalizes errors into `ApiError {status, code, message}`. On 401 it calls `/auth/refresh` **once for all concurrent requests** (a shared promise), retries, and broadcasts `dd:signed-out` if refresh fails. Public GETs are memoized for 30 s (`cachedGet`), so nav, footer and page body share one `/api/catalog` request.
* **Auth state** (`src/auth/AuthContext.jsx`): asks `/auth/me` on load; `RequireAuth` gates pages and redirects to `/login?next=<current path>`. `next` must be a same-site path (no open redirects).
* **Data hooks** (`src/lib/useApi.js`): `{data, error, loading, reload, setData}`, with abort on unmount; `LoadState` renders spinners and errors consistently.
* **Editor** (`src/practice/CodeEditor.jsx`, CodeMirror 6): auto-indent (4 spaces Python, 2 SQL), Tab indents, bracket/quote auto-close, search, comment toggling, multi-cursor; SQL autocompletes table and column names from the problem's schema; ⌘/Ctrl-' Run, ⌘/Ctrl-Enter Submit. The editor is created once; external value changes (Reset, Load code, Copy solution) are applied by comparing against the last value *the editor itself emitted*. That fixed a race where a stale React render overwrote fresh keystrokes.
* **In-browser runner** (`src/practice/runner/`): a module Web Worker loads Pyodide from the jsDelivr CDN plus the per-track packages, and runs `shared/grader/harness.py`. Running in a worker keeps the page responsive; on a 15 s timeout the worker is terminated and recreated.
* **Docs reader** (`src/docs/DocsPage.jsx`): TOC from `##`/`###` headings, filter box, scroll-spy; headings get **GitHub-style ids** (`makeGithubSlugger`) so the handbook's own `#section` links work identically on GitHub and on the site. `useHashScroll` also listens for `hashchange`, because in-page links don't remount the page.
* **Editors per track**: SQL (schema-aware autocomplete), Python / PySpark / pandas (4-space indent), Shell (`StreamLanguage` shell mode, 2-space indent). Shell Run uses just-bash in the worker (lazy import, no Pyodide); pandas Run loads the `pandas` Pyodide package.
* **Profile** (`src/profile/ProfilePage.jsx`, `charts.jsx`): modelled on LeetCode (solved ring by difficulty, acceptance, recent AC, badges, skills), GitHub (year contribution heatmap, streaks) and Codeforces (rating graph → our cumulative points chart, rank). Charts are hand-built SVG (no chart library): the **heatmap** uses a one-hue sequential ramp (`--heat-0..4`), a lime ramp validated monotonic on the white surface with each step ≥ 1.5× the contrast of the previous one; the **points chart** is a step line (points change only on solves) with crosshair + tooltip, a ≥ 30-day window, and a "Show as table" view. The calendar is bucketed in the viewer's time zone (`Intl` → `?tz=`). The editable identity card (name, username, headline) appears only for the owner.
* **Contests** (`src/contests/`): `ContestsHome` (create form with live availability counts, invitations, active/past lists, username type-ahead), `ContestPage` (lobby → arena → results), `useContest` (fetch + EventSource + server-clock offset + refresh at the deadline). The arena **reuses the practice workspace** (`ProblemView` with a `contest` prop): same editor, Run and Submit, but no Solution tab, a device-local draft per contest (your practice draft is untouched), `contestId` on Submit, and a contest bar (problem tabs with ✓/✗ state, Standings, a countdown that turns red under 5 minutes).
* **Workbench layout** (the practice workspace, `ProblemView`): deliberately its own design rather than a copy of LeetCode's — a vertical **icon rail** (Brief · Hints · Attempts · Solution) instead of top tabs; the problem as a **brief** with a spec strip (level, points, acceptance, solvers) and "Asked at" chips linking to sources; hints as their own step-by-step panel; an editor **toolbar** with a file tab (`query.sql`, `solution.py`, `job.py`, `analysis.py`, `script.sh`) carrying Run and Submit; a collapsible **Output dock** (Examples / Results, verdict chip in its header); and an IDE-style **status bar** (runtime, draft state, shortcuts).
* **Interview prep** (`src/interview/`): `/interview` — role filter, case-study cards with a difficulty ladder and progress, interview questions table (difficulty / pattern / search); `/interview/case/:id` — brief + parts. In the workspace, case-study parts show a banner (part n of m, previous/next, the brief) and every problem shows its roles; track pages add a role filter, an "Interview only" toggle and Interview / Case-study chips. The site nav gains **Interview**.
* **Contest arena** (focus mode): `PlatformLayout nav={false}` hides the site nav; the arena's own top bar shows the contest, problems lettered **A, B, C…** with points and ✓/✗/pending state, your rank and score, and a countdown with a progress line that turns amber at 10 min, red at 5 min and blinks in the last minute. Toasts announce other players' solves (diffing consecutive standings), your own solve with your new rank, and 5-minute / 1-minute warnings. A 3-2-1 countdown plays when you enter a contest that started < 60 s ago. When time runs out the page shows "Time's up", then the results: a "your rank" hero, a podium (group) and the lettered board. Toasts/overlays render outside `.pf`, so the theme tokens are also defined on `.pf-tokens`.
* **Workspace** (`ProblemWorkspace.jsx`): draft precedence on open is *this device's unsaved copy → server draft → starter*. Autosave is debounced 1.5 s, with a `keepalive` flush on `pagehide`. Submit sends `clientToken`, retries network failures with the same token, then polls with backoff (0.5 s → 2 s) showing queue position, for up to 2 minutes.

### 11.1 Visual design — "Lineage"

The platform UI is a **light, serious, product-first theme**: it should read like a tool engineers trust, with enough motion to show the product working and nothing decorative. It replaced the short-lived "Data Arcade" theme on 2026-11-19 (decision log). The design canvas used to agree the direction is the reference for new screens.

* **Where it lives.** All tokens are on `.pf, .pf-tokens` at the top of `src/platform/platform.css`. Components keep their layout rules in the body of that file, and the **Lineage layer** at the end restyles them: hairline frames, pill buttons, type and calm motion. Landing-only styles are in `src/landing/landing.css` (prefix `ld-`). The CodeMirror theme is in `src/practice/CodeEditor.jsx`. Legacy pages (`/blog`, `/admin`) keep their own styles.
* **Palette.** Paper `#F4F5F2`, white sheets `#FFFFFF` for product frames, ink `#121412`, graphite text (`--muted` `#555952`, `--faint` `#6B6F69`, both ≥ 4.5:1) and hairlines `#E4E5DF` / `#DCDDD6` / `#C6C8C0`. There is **one accent**, "pass" green `#127A4C`, used for Accepted, live and progress. Fail `#B4361C` and medium `#95600A` are status colours only, never decoration. Code colours: keyword `#2F5BD3`, function `#8A3FC1`, string `#127A4C`, comment `#8A8E86`.
* **Type.** Geist throughout. Headlines use weight 600 with −0.045em tracking, often in **two tones**: the claim in ink, the consequence in grey (`.pf-tone`). Geist Mono handles code, data, counts and small structural labels, always in lower case with no all-caps eyebrows.
* **Dotted paper ground.** The page background is a fine texture of 0.75 px ink dots at 10% opacity, every 5 px in two staggered layers (`--dot` on `.pf`). It reads as paper grain rather than a grid, so content sits directly on it with no patches. The landing hero softens it behind the headline, and the workspace and course reader stay plain.
* **Fewer boxes.** Tags are plain text separated by "·" (`.pf-chip` has no border or fill). Problem rows show skills on one line and the pattern below it. A problem's brief lists Asked at, Skills, Patterns, Domain and Roles as a two-column facts list (`.pf-facts`), with long patterns stacked one per line.
* **Filters and dropdowns.** A track's filters form one toolbar (`.pf-toolbar`):
  * an underline search field;
  * difficulty as small tabs;
  * Topic (narrow screens), Role, Company, Pattern and Status as `Dropdown`s (`src/platform/Dropdown.jsx`): a quiet trigger and a hairline popover listbox with check marks, keyboard support (↑/↓, Enter, Esc) and a filter field when there are more than 8 options;
  * an "Interview only" switch;
  * "Clear filters" next to the result count.

  The native `<select>`s left in forms share the same pill look.
* **Profile.** The page opens with a header: a large avatar, name, handle and join date, plus rank and points. Below it is a strip of four stats, then open sections, each opened by an ink rule: Progress, activity calendar, points chart, recent activity, contests and learning. Skills and badges sit in a side column. Charts sit in white frames; nothing else is a card.
* **Structure.** Lines are 1 px hairlines, and a dark ink rule opens each list or table (tracks, paths, FAQ). Primary buttons are ink pills, secondary buttons are outlined pills, and the light pill is reserved for dark bands. There are no drop shadows except `--lift` under product frames and on hover. Sections sit 112 px apart, each about one screen, and each shows product or proof.
* **Motion demonstrates the product.**
  * **On load:** headlines rise out of a short blur, once.
  * **Hero demo:** a query types itself, Run passes the examples, Submit grades the hidden tests and the panel lands on Accepted. It loops every ~15 s and pauses while the tab is hidden.
  * **Walkthrough:** advances every 4.5 s until the visitor picks a step.
  * **Lineage band:** submissions flow through read → write → run → grade → accepted, and hover pauses it.
  * **Elsewhere:** hover lifts are 1–2 px. `prefers-reduced-motion` freezes every animation and shows the hero's final state.
* **Landing page** (`src/landing/Landing.jsx`), in order:
  1. Centred two-tone headline with two CTAs and the live demo, plus two annotation callouts on wide screens.
  2. A strip of real catalog numbers.
  3. A problem-first walkthrough.
  4. The tracks table, built from the catalog with problem counts and runtimes.
  5. A grading panel: Run in the browser, Submit on the server, hidden tests sealed, with the lineage band.
  6. Role paths beside an example contest scoreboard.
  7. FAQ.
  8. A dark closing CTA.

  Every number comes from `/api/catalog`. The demo output, the contest names and the lineage band are labelled or obviously illustrative.
* **Nav.** With seven links, the nav switches to the burger menu below 1080 px.
---

## 12. Contests

A **contest** is a timed round over problems drawn at random from the practice bank — LeetCode weekly contests and Codeforces rounds are the models. Two modes:

* **Solo** — pick the settings, the clock starts immediately.
* **With friends** — the host creates a **lobby**, invites people **by username** (or shares the link — the 8-character code *is* the invitation), and starts when everyone's in. Up to 10 players.

The creator chooses: tracks, difficulties, topics (optional), number of questions (1–8), duration (5–180 min), and which problems — **unsolved**, **solved** (revision), or **both** (unsolved first).

### 12.1 Product decisions (agreed 2026-11-17)

| Question | Decision |
|---|---|
| Does a contest solve count in practice? | **Yes.** A contest submission is an ordinary submission: it updates attempts, "Solved", and practice points (with the usual attempt multiplier, §8.13). The contest also keeps its **own score** (§12.4), shown on the profile |
| How do friends join? | **Invite only**: by username (appears under *Invitations* and as a nav badge) or by link. No public contest list yet |
| Scoring | **LeetCode/Codeforces style** — more points first, then faster finish; wrong submissions add a time penalty |
| Problem bank | 2 problems added (SQL Easy *Daily Active Users*, SQL Hard *Longest Login Streak*) so a single-track contest has a choice; the bank must keep growing for contests to stay varied |

### 12.2 Why it's built into DataDrill, not a separate app

We evaluated a separate "contest app" and open-source options before building:

| Option | Finding |
|---|---|
| [pgosar/binarysearch.io](https://github.com/pgosar/binarysearch.io) (binarysearch clone) | Next.js + MongoDB + Socket.io + Judge0, GPL-3.0; early stage (14 commits), features mostly planned |
| [acmutd/bsg](https://github.com/acmutd/bsg) | Go microservices (central, RTC, worker); most active clone, but a whole second platform |
| [octree.io](https://github.com/octree-io/octree.io) | Rooms with timer + chat, MIT; frontend only |
| [DMOJ](https://github.com/DMOJ/online-judge) | Mature judge with contests, ratings, ICPC/IOI formats; Django, own accounts, AGPL-3.0, Linux ptrace judge |
| DOMjudge / CMS / Judge0 | ICPC/IOI systems and an execution API; Judge0 needs privileged Docker hosts |

**None of them grade data-engineering problems** — they compare stdout of compiled programs; ours compare tables from SQL, PySpark and pandas, and shell output over files. A separate app would also duplicate accounts, the problem bank, solved history (needed for "unsolved first"), the grader and profiles, and need syncing between two databases.

A contest is mostly **state** (who, which problems, when it ends, standings), not **compute** — the expensive part (grading) already exists, and Run stays in the browser. So contests are one more module in the same API, on the same Postgres and the same grader. **Extra infrastructure: none.**

### 12.3 Drawing the problems (`contests/rules.js` `pickProblems`)

At **start** (for solo: at creation), with the roster frozen:

1. **Candidates** = published problems in the chosen tracks and difficulties, overlapping the chosen topics (if any), each with `solvedBy` = how many players already solved it in practice.
2. **Pool**: `unsolved` → `solvedBy = 0` (unsolved by *everyone* in the contest); `solved` → `solvedBy > 0`; `both` → all, ordered by `solvedBy` ascending (so unsolved come first).
3. **Random** within each preference tier (`crypto.randomInt` Fisher–Yates).
4. If the strict pool is too small, it's **topped up** from the rest, least-solved first, and the contest shows a note ("Only 1 matching problem was unsolved for everyone…"). If even the filters can't supply `count` problems, creation fails with 400 (checked up front against the creator alone, re-checked at start).
5. Shown **Easy → Hard**, like a LeetCode round. Each problem's contest points = its base points (Easy 10, Medium 20, Hard 40).

Why at start, not at creation (group): "unsolved" must be judged against the people actually playing, and drawing late means nobody can look the set up in advance.

### 12.4 Scoring and ranking (`computeStandings`)

| | Rule |
|---|---|
| Score | Sum of points of the problems you solved |
| Finish time | Time (from the start) of your **last** Accepted + **5 minutes × wrong submissions on problems you solved** |
| Rank | Score descending, then finish time ascending; identical score and finish **share a rank** |
| Wrong on an unsolved problem | Shown (red −n) but **no penalty** |
| After Accepted | Further submissions to that problem are ignored |
| Never counted | "Internal Error" and failed jobs (our fault) |
| Deadline | A submission counts if it was **created** before `ends_at`, even if graded later; until then the board is *provisional* |

This is LeetCode's contest rule (ICPC-style penalty). The contest score is separate from practice points: the profile shows contests played, total contest score, wins (rank 1 in a group contest with a score), best group rank, and each finished contest's rank.

### 12.5 Real-time design

```
player submits ──► API: checks (§12.6) + INSERT submission + refreshStandings  ─┐
grader verdict ──► finish(): verdict + practice points + refreshStandings       ├─► NOTIFY contest_event '<contest id>'   (delivered on COMMIT)
join / start / end / invite ──► same, inside the contest-row lock               ─┘
          │
          ▼  every API process LISTENs (one connection, shared with content_changed)
   lib/events.js: EventEmitter keyed by contest id ──► SSE "update" to that contest's open streams (coalesced 250 ms)
          │
          ▼
   browser (useContest): on "update" → GET /api/contests/:code (single-flight) → re-render board / tabs / lobby
```

* **Standings are recomputed, not incremented.** `refreshStandings` reads the contest's submissions and runs the pure `computeStandings` (≤ 10 players × 8 problems — microseconds), then writes all rows with one `UPDATE … FROM unnest(…)`. An advisory transaction lock per contest serializes concurrent refreshes. Recomputing can never drift from the submissions; incremental counters can.
* **The event carries no data** — "contest X changed". Each browser re-fetches through the normal, authorized endpoint, so the stream can't leak what a viewer may not see (e.g. problem titles to non-players while live).
* **SSE, not WebSockets**: updates only flow server → browser; it's plain HTTP through any proxy/CDN; `EventSource` reconnects by itself; and it reuses cookie auth. Streams send a heartbeat every 25 s and are closed on shutdown.
* **Time** is the database's. The API returns `serverNow`; the browser computes its clock offset and counts down in server time. No timers or jobs run at the deadline — "ended" is derived from `ends_at` on every read; the client also re-fetches exactly at the deadline.
* **Scale across processes/machines** comes free from Postgres NOTIFY: a verdict committed by any grader reaches every API process.

### 12.6 Integrity rules

| Rule | Why | Where |
|---|---|---|
| Only joined players can submit with `contestId`, only for the contest's problems, only before `ends_at` | Obvious | `POST /api/submissions`, under `SELECT … FOR SHARE` of the contest row so it can't race "end" |
| **Practice Submit and Reveal solution are refused** (409) for a problem in your running contest | Practice submits would test the hidden tests without the wrong-answer penalty; a revealed solution answers the question | `contests/guards.js` → `practice.js`, `submissions.js` |
| The solution is withheld from `GET /api/problems/:id` while it's in your running contest — even if you'd unlocked it before | Same | `practice.js` |
| **Hints are withheld too** (`hints: []`, `hintsHidden: true`) and the arena has no Hints panel | Hints are part of the challenge; they return in practice after the contest | `practice.js`, `ProblemView` |
| Problem ids/titles are shown to players only while live (spectators see positions and points) | Spectators shouldn't preview the set | `GET /api/contests/:code` |
| Contest code is kept in a device-local draft; your practice draft is not overwritten | Contest attempts shouldn't clobber practice work | `ProblemView` + `submissions.js` |
| Hidden tests stay redacted exactly as in practice | Same grader | §8.9 |

### 12.7 Lifecycle and concurrency

```
create ──solo──► live ──(ends_at passes | host ends)──► ended
   └──group──► lobby ──start──► live ──► ended
                 └──cancel──► cancelled
```

Every lifecycle action (`join`, `decline`, `leave`, `invite`, `start`, `end`, `cancel`) runs in one transaction holding `SELECT … FOR UPDATE` on the contest row and re-checks the phase, so double-starts, joins racing the start, and ending during a submit all resolve cleanly. Invitations nobody accepted are removed at start. Limits: 10 players, 8 problems, 5–180 minutes, 3 open contests per host, 20 creations per user per hour (counted in the DB, after validation, so correcting a form never burns the quota) (`config.contests`, env `CONTEST_MAX_PLAYERS`, `CONTEST_MAX_OPEN_PER_HOST`, `CONTEST_MAX_PROBLEMS`).

### 12.8 Contest experience (what makes it feel like a contest)

| Moment | What the player sees |
|---|---|
| Lobby | A waiting room: spec cards (questions, duration, tracks, difficulty, pool, scoring), player seats with "Host / Ready", open seats, a pulsing "waiting for host" note, invite link + username invites for the host |
| Start | Everyone in the lobby is moved into the arena automatically (SSE); a 3-2-1-Go overlay |
| During | Focus-mode arena (no site nav), lettered problems with live state, rank/score pill, colour-coded countdown + progress line, toasts for solves and time warnings, the standings one click away |
| End | "Time's up" overlay with your result, then a results page: rank hero, podium, board, links to the problems (solutions open in practice) |

### 12.9 Capacity and cost

| Resource | Per contest | Notes |
|---|---|---|
| Postgres | 1 + players + problems rows; a recompute per verdict (one indexed read of a few dozen rows + one UPDATE) | Negligible next to grading |
| API | One open SSE connection per player tab (idle except heartbeats) | Node holds thousands per process; capped at 6 per user per process |
| Grader | Same jobs as practice — a 6-player × 4-problem contest is at most a few dozen submissions over its duration | §9 measured 100 simultaneous submissions |
| Run (examples) | In the browser, as always | Zero server cost |

**No new servers or services**; cost grows with grading volume exactly like practice. Contest submissions share the per-track queues with practice (FIFO), so a big practice backlog slows contest verdicts too — the fix, if ever needed, is a priority column in the claim query or a dedicated contest lane (§8.8).

---

## 13. Content pipeline

```
server/content/**  (authoring source, in git)
   │  npm run verify:problems   ← quality gate: reference solution passes ALL tests,
   │                               starter code does NOT pass all (tests not too weak)
   ▼
npm run seed  (idempotent upsert; derives lessons/minutes; bumps problem versions on change)
   ▼
PostgreSQL (runtime truth)  ──NOTIFY content_changed──►  every API process clears its cache
   ▼
API (cached reads)  ──►  browser
```

### 13.1 Files or database? (decision)

**At runtime, everything is read from PostgreSQL** — courses, problems, tracks and docs. The files in the repo are the *authoring source*, not something the server reads per request. We deliberately keep both:

| | Repo files (source) | Database (runtime) |
|---|---|---|
| Why | Version history, code review, diffs, the `verify:problems` quality gate, and the handbook must change *together with* the code it describes | Transactions, versioning (`problem_version`), hidden-test isolation, cache invalidation via `NOTIFY`, admin edits, one consistent read path |
| Flow | edit file → commit | `npm run seed` (and, for docs, every API boot) upserts into the DB |

Sync rules differ on purpose: **docs are synced automatically on every API boot** (they're only ever edited in the repo, so a deploy can never show a stale handbook). **Courses and problems are synced only by `npm run seed`**, because admins can edit them in the database through the admin API, and an automatic boot-time sync would silently overwrite those edits. The seeder skips unchanged items (content hashes), so syncs are cheap and idempotent.

**Add a problem:** copy a file in `server/content/problems/`, register it in `problems/index.js`, then run `npm run verify:problems` and `npm run seed`. Topics must come from the track's taxonomy in `content/tracks.js`.
**Add a course or module:** add the markdown under `server/content/courses/`, list it in `content/courses.js`, then `npm run seed`. `##` headings become lessons automatically.
**Edit the handbook:** edit `docs/ARCHITECTURE.md` → it's published to `/docs/architecture` at the next API start (or run `npm run seed`). Add more docs in `server/content/docs.js`.
**Edit live:** `PUT /api/admin/problems/:id`, `PUT /api/admin/courses/:id`. These go through the same derivation code as the seeder.

---

### 13.2 Authoring at volume: SQL packs and golden outputs

SQL problems beyond the first few live in **packs** (`server/content/problems/sql/pack-*.js`, loaded automatically — no registry to forget) written with the compact `sql({...})` helper (`sql/define.js`): schema as a one-line spec per table, tests as data only.

**Golden outputs.** Expected results aren't hand-typed. `npm run problems:freeze` runs each reference solution on each test in the same DuckDB/Pyodide harness the grader uses and stores the result (and the output columns) in `sql/golden.json` with a fingerprint of the problem's schema, data and solution. `npm run problems:freeze -- --show` prints every output for **human review** — this is where wrong solutions are caught (examples found while writing the bank: a funnel reporting 100 % conversion after a step with 0 users, an SCD2 query splitting consecutive NULLs into two versions, a DuckDB quirk that drops rows after an empty lateral `generate_series`). `verify:problems` fails when a pack problem's golden output is missing or **stale** (fingerprint mismatch), and requires at least one test with a non-empty expected result.

Workflow: write/edit a pack → `npm run problems:freeze -- --show` → review the diff of `golden.json` → `npm run verify:problems` → `npm run seed`.

## 14. Testing

| Suite | Command | What it proves |
|---|---|---|
| Integration | `npm test` (server/) | 27 integration tests over real HTTP, real Postgres (`datadrill_test`) and a **real grader process**: signup/login/lockout/enumeration-resistance, refresh rotation + theft detection + multi-tab grace, logout, CSRF, password reset single-use, public vs gated access, **hidden tests and unearned solutions never in responses**, admin forbidden to learners, handbook access (anonymous 401 / learner 403 / admin 200), progress, drafts, idempotency + pending cap, end-to-end grading (Wrong Answer with redaction → Accepted → solution unlocked → DuckDB file access blocked), **points** (2nd-attempt solve = half, re-solve = 0, reveal-before-solve = 0), profile + leaderboard (no email leak, owner-only submissions), **Shell and pandas end to end** (incl. a shell escape attempt), username rules, **contests**: creation validation + feasibility, solo auto-start and Easy→Hard order, group invite by username → inbox → join by link → host-only start → late join refused → spectators can't see the problem set → SSE stream answers → practice submit/reveal blocked and solution hidden during the contest → outsiders can't submit → wrong-then-right gives a 5-minute penalty and the right rank → contest solve counts in practice with the 2nd-attempt multiplier → host-only end → late submit refused → profile contest history; **problem bank**: every problem of every track is published with complete tags, company tags backed by https sources, exactly its visible examples, the right hidden count, no hidden-test names and no unearned solution in the response; **contest error handling**: 24 invalid create payloads each get a specific message (none generic, none 500), 19 lifecycle misuses (unknown code, decline/leave when not applicable, non-host start/invite/end, double start, cancel while live, late join/invite, bad ids, empty code) get the right status and reason; hints hidden during a contest and back after; **interview prep**: case studies listed with parts 1..n and a non-decreasing difficulty ladder, interview questions with roles, case pages, part details carry their case study |
| Architecture | `npm test` (`test/architecture.test.js`) | Runtime code never imports problem files; the browser never imports server content; no full-table aggregation over submissions in request paths |
| Unit | `npm test` (server/, `test/contest-rules.test.js`) | 5 tests: problem draw (pools, top-up note, randomness, Easy→Hard), standings (penalties, ties, Internal Error / failed / pending) |
| Content gate | `npm run verify:problems` | The content audit (§8.12) + pack golden outputs present and current (§13.2) + case studies consistent + every reference solution passes all tests + no starter passes all; prints a per-track summary (problems, difficulty mix, tests, company-tagged). Shell problems run on just-bash and were cross-checked on real bash |
| Load | `npm run loadtest` | §9.3 |
| Frontend | `npx vite build` + manual browser walkthrough | Builds, no console errors |

---

## 15. Running & operating it

**First-time setup**
```bash
# prerequisites: Node ≥ 22.13, PostgreSQL ≥ 14 running locally
createdb datadrill && createdb datadrill_test
npm install && (cd server && npm install)
cp server/.env.example server/.env        # then edit
cd server && npm run grader:prepare        # one-time: vendor wheels, warm package cache
npm run seed                               # migrations + content → Postgres
npm run make-admin -- you@example.com <password> <name>   # create an admin account
# (or, for an account that already signed up: npm run make-admin -- you@example.com)
```

**Every day** (from the repo root): **`npm run dev`** (or `npm start`) runs API + grader + web app together, with coloured `api` / `grader` / `web` log prefixes. Run them separately with `npm run server`, `npm run grader`, `npm run dev:web`. The web app alone can't do anything useful: every `/api` request would fail with `ECONNREFUSED`.

**Ports**: the API listens on `PORT` from `server/.env` (default 3001). The Vite dev proxy **reads the same value** (`vite.config.js`), so changing it in one place is enough; `API_PORT` overrides it for one-off runs.

**Admins**: `npm run make-admin -- <email>` promotes an existing account; `npm run make-admin -- <email> <password> [name]` creates or resets one directly in the database (bypasses the 8-character signup rule, with a warning: local use only). New accounts get a generated username, like sign-up.

**Test users** (local development only — try group contests by signing in as different users in different browsers or a private window): `npm run seed:test-users` creates or resets them. The script refuses to run with `NODE_ENV=production`.

| Name | Email | Username | Password |
|---|---|---|---|
| Asha Rao | `asha.rao@datadrill.test` | `asharao` | `DrillTest#2026` |
| Ben Carter | `ben.carter@datadrill.test` | `bencarter` | `DrillTest#2026` |
| Chen Li | `chen.li@datadrill.test` | `chenli` | `DrillTest#2026` |
| Demo Learner (seeded earlier) | `demo.learner@datadrill.test` | `demolearner` | see `server/.env.example` |

These passwords are public — never create these accounts on a real deployment.

**Health**: `GET /api/health` (liveness), `GET /api/ready` (DB reachable + pool stats). **Logs**: JSON lines (pino) carrying `reqId`, status and latency. The grader logs each verdict with `queueMs`, `acquireMs` and `runMs`, plus a stats line every minute.

**Migrations** run automatically at API boot (primary process, advisory-locked), or manually with `npm run migrate`.

---

## 16. Production deployment blueprint

```
             ┌─────────┐
  users ───► │   CDN   │── static web app (dist/)
             └────┬────┘
                  │ /api/*
             ┌────▼─────────┐    health: /api/ready
             │ Load balancer│────────────────────────┐
             └────┬─────────┘                        │
        ┌─────────┴─────────┐                        │
   ┌────▼────┐         ┌────▼────┐                   │
   │ API #1  │   …     │ API #N  │  NODE_ENV=production, WEB_CONCURRENCY=cores
   └────┬────┘         └────┬────┘  COOKIE_SECURE=true, TRUST_PROXY=1, JWT_SECRET
        └──────────┬────────┘
              ┌────▼─────┐   (PgBouncer when connections grow)
              │ Postgres │   managed, daily backups + PITR, statement_timeout
              └────▲─────┘
        ┌──────────┴────────┐
   ┌────┴─────┐       ┌─────┴────┐
   │ Grader#1 │  …    │ Grader#M │  NO network egress, memory limit,
   └──────────┘       └──────────┘  wheels + package cache baked into the image
```

* Serve the web app and API under **one site** (e.g. `datadrill.com` and `/api`), so cookies stay first-party and `SameSite=Lax` works.
* Build the grader image with `npm run grader:prepare` already run, then block outbound network for those containers.
* Scale API on CPU and grader on queue wait time (the `queueMs` log field).

---

## 17. Security checklist

- [x] Passwords: scrypt (N=2^14), per-user salt, constant-time compare; timing-equalized unknown-email path
- [x] Sessions: httpOnly, `SameSite=Lax`, `Secure` in production; refresh tokens hashed at rest; rotation + reuse detection
- [x] CSRF: SameSite + mandatory custom header
- [x] Brute force: per-account lockout (DB) + per-IP limits
- [x] Account enumeration: identical responses for unknown emails (login, forgot-password)
- [x] Authorization: server-side on every route; ownership checks return 404
- [x] Hidden tests and solutions: never selected / redacted
- [x] Untrusted code: six isolation layers (§8.4)
- [x] Input validation: zod on every body; size caps
- [x] Security headers: helmet
- [x] Secrets: only in server env; never in the frontend bundle; sandboxes get an empty env
- [x] No open redirects (`next=` must be a same-site path)
- [x] Contests: submit only as a joined player, before the deadline (row lock); practice submit/reveal and solutions blocked during your contest; live stream carries no data; problem set hidden from spectators while live (§12.6)
- [ ] Production: grader network egress blocked, memory limits (deployment task)
- [ ] Email verification on signup (roadmap)
- [ ] 2FA for admins (roadmap)

---

## 18. Known limitations & roadmap

* **PySpark sandbox start-up (~3 s)** dominates PySpark grading time; snapshots don't support DuckDB's compiled library yet. Watch for Pyodide releases that allow it.
* **Per-IP limits are per process** (approximate). Fine for abuse protection; use Redis if they must be exact.
* **Polling** for verdicts: simple and proxy-friendly. Server-Sent Events could cut the requests if needed.
* **Contests**: no public contest list or scheduled public weekly rounds yet; no rating (Elo / Codeforces-style) — only score and rank; lobbies never expire (a host can cancel); contest jobs share the practice queues (§12.9); the non-SQL tracks (5 problems each) still repeat over many contests — see the backlog in `docs/QUESTION_BANK.md`.
* **Shell = just-bash, not GNU bash**: rare flags may be missing (see the `sort` shim, §8.11).
* **Profile queries** run ~12 aggregate queries per view; fine at current scale, cache per user if profiles get hot.
* **Design and hackathon tracks** are previews: they need a submission + review workflow (rubric scoring, reviewer UI).
* **No email verification yet**; addresses are trusted at signup.
* **Legacy CMS** (MongoDB + its own admin password) should eventually move onto platform roles.
* Leftover portfolio files in `src/` (`App.jsx`, `components/GuideSection.jsx`, `src/guide/`) are no longer loaded; delete them once the CMS is retired.

---

## 19. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-11-15 | Pivot from portfolio to DataDrill platform; dark editor-first theme | Product direction |
| 2026-11-15 | Courses derived from existing guide markdown (course → module → lesson) | Reuse content; lessons = `##` headings |
| 2026-11-15 | In-browser execution with Pyodide + DuckDB + sqlframe | No servers needed for Run; real PySpark API without a JVM |
| 2026-11-15 | **Backend**: Node/Express API + PostgreSQL system of record; MongoDB kept only for legacy CMS; no Redis yet | §3.2 |
| 2026-11-15 | Cookie auth: 15-min JWT + rotating 30-day refresh sessions with reuse detection | §7 |
| 2026-11-15 | Courses/problems served from the API; lesson bodies and the workspace behind sign-in | Product requirement |
| 2026-11-15 | **Run in browser, Submit on server** | Hidden tests stay secret; Run costs nothing |
| 2026-11-15 | Postgres `SKIP LOCKED` queue with leases, fencing, reaper, idempotency | Durable and transactional with the data; no extra infrastructure |
| 2026-11-15 | Sandbox = child process + Node `--permission` + empty env + WASM + JS bridge removed (+ no egress in prod) | §8.4 |
| 2026-11-15 | SQL sandboxes reusable; Python/PySpark single-use | Cross-user tampering risk (§8.5) |
| 2026-11-15 | Fix: refresh grace window applied to logged-out/stolen tokens → `revoke_reason` (migration 002) | Found by integration tests |
| 2026-11-15 | Fix: removed `maxRequestsPerSocket` (caused 503s on long keep-alive connections) | Found by load test |
| 2026-11-15 | Per-track grading lanes (migration 003) + Python memory snapshots | Load test: Python max verdict 42.9 s → ~5 s |
| 2026-11-15 | Handbook readable on the website at `/docs/architecture`, admin-only; stored in a `docs` table (migration 004) | Better reading; internals shouldn't be public |
| 2026-11-15 | Content: repo files stay the authoring source, PostgreSQL is the only runtime store; docs auto-sync on boot, courses/problems via `npm run seed` | §13.1 — keeps git history/review and the verify gate while serving everything from the DB |
| 2026-11-15 | Fix: `#hash` links within a page now scroll (hashchange) | Found while testing the docs reader |
| 2026-11-17 | `npm run dev` starts the full stack; Vite proxy reads `PORT` from `server/.env`; `make-admin` can create accounts | Running only Vite, and a changed PORT (3002) vs the proxy's hard-coded 3001, both produced `ECONNREFUSED` |
| 2026-11-17 | **Shell track** on just-bash (browser + grader, reusable sandboxes) with a `sort -b` shim | Real bash can't be sandboxed in-browser; just-bash has no processes/network (§8.11) |
| 2026-11-17 | **pandas as its own track** (not inside Python) | Table I/O like SQL/PySpark, its own skill taxonomy, and keeps the Python snapshot path free of the pandas import |
| 2026-11-17 | Problem tags: topics / patterns / domains / companies (verified only) + computed acceptance (migration 005) | Competitive analysis, §8.12 |
| 2026-11-17 | Points: base by difficulty × 100/50/25/0 % by attempt; 0 if the solution was revealed first; awarded in the verdict transaction | User requirement; row lock prevents double awards (§8.13) |
| 2026-11-17 | Fix: attempt counting moved into SQL (`(created_at, id)` row comparison) | JS `Date` truncates Postgres microseconds → `attempt_no` was 0 |
| 2026-11-17 | Public profiles (`/u/:username`), leaderboard, usernames, denormalized `users.points` | LeetCode/GitHub/Codeforces-style activity; rank by index scan |
| 2026-11-18 | SQL bank 104 → 178: packs 11–15 of company-reported question types (DataLemur company pages for ~40 companies, SparkPlayground, dev.to, Interview Query); existing problems gained matching company tags; 75 companies in total | User request: questions from the top 60–90 companies for data roles |
| 2026-11-18 | SQL bank 16 → 104 via packs: foundations, windows, strings/regex/lexicographic, recursion & hierarchies, pivot & dates, analytics & statistics, data-engineering patterns, original hard challenges, 4 case studies (13 parts) | User request: as many SQL questions and patterns as possible, for every data role |
| 2026-11-18 | Golden outputs (`problems:freeze`, reviewed) instead of hand-typed expected rows for packs; staleness fingerprint enforced by the audit | Hand-typing hundreds of result sets is error-prone; reviewing machine outputs caught 4 real bugs (§13.2) |
| 2026-11-18 | Interview prep: `interview` / `roles` / case studies (migration 009), `/interview` section + case pages, tags kept on problems in their tracks | A home for interview material now and the planned interview area later, without duplicating problems |
| 2026-11-18 | Fix: untitled group contest → 500 (default title read `req.user.name`, which the JWT doesn't carry) | Found by the new contest error tests — the likely "something went wrong" seen in the UI |
| 2026-11-18 | Human validation messages (`friendlyIssue`), 500s carry a reference, per-user DB creation cap instead of a per-IP bucket that counted failed attempts | Contest errors were vague ("Required") or turned into "too many requests" while fixing a form |
| 2026-11-18 | Hints withheld in contests (server + UI) | User request |
| 2026-11-18 | Problem stats from `problem_stats` counters (migration 008) maintained by the grader; registry audit; architecture guard tests | §9.5 — the full-scan stats query would not survive millions of submissions |
| 2026-11-18 | SQL bank 7 → 16 (+9: CTR, histogram, 2nd-highest salary, odd/even readings, YoY growth, shopping sprees, median from frequencies, repeated payments, server running hours) | Point 4 of the request; total bank 36 |
| 2026-11-18 | Problem bank 7 → 27 (4 new per track: SQL, Python, PySpark, pandas, Shell), original problems for the most-reported interview question types | User request; research catalogue in `docs/QUESTION_BANK.md` |
| 2026-11-18 | Company tags allowed when a public source attributes the question type; `sources` stored per problem (migration 007), shown as "Asked at" links, enforced by the content audit | Honest attribution: users can see where a tag comes from |
| 2026-11-18 | `verify:problems` became a full content audit (fields, tags, sources, test coverage, schema shapes) + a problem-bank integration test | "Complete testing" of tests, tags and solutions |
| 2026-11-18 | Workspace redesigned as a "workbench" (icon rail, brief + spec strip, toolbar Run/Submit with file tab, Output dock, status bar) | Own visual identity; the previous layout mirrored LeetCode's |
| 2026-11-18 | Contest arena in focus mode: lettered problems, timer progress, toasts, start countdown, time's-up result, podium, waiting room | Contests felt like solving single problems |
| 2026-11-17 | **Contests built into DataDrill** (migration 006), not a separate app | Open-source contest platforms can't grade SQL/PySpark/pandas/shell and would duplicate accounts, problems, solved history and the grader (§12.2) |
| 2026-11-17 | Contest scoring = LeetCode/ICPC: points, then finish time + 5 min per wrong submission on solved problems | User requirement (§12.4) |
| 2026-11-17 | Contest solves also count in practice (solved, attempts, points); contest score kept separately | User requirement |
| 2026-11-17 | Invite-only contests: by username or by link (the code is the invitation) | User requirement |
| 2026-11-17 | Problems drawn at start against the frozen roster; "unsolved" = unsolved by everyone; top-up with a note | Fair for groups; set can't be previewed (§12.3) |
| 2026-11-17 | Standings recomputed from submissions in the verdict transaction; live updates via NOTIFY → SSE; deadline derived from `ends_at` | No drift, no timers, no new services (§12.5) |
| 2026-11-17 | Practice submit/reveal and solutions blocked for problems in your running contest | Prevents penalty-free testing and peeking (§12.6) |
| 2026-11-17 | Username generation moved to `lib/users.js`; `make-admin` and `seed:test-users` use it | `make-admin` could no longer create accounts once `username` became NOT NULL (migration 005) |
| 2026-11-17 | 2 SQL problems added (Daily Active Users — Easy; Longest Login Streak — Hard, gaps & islands) | Contests need a choice of problems per track |
| 2026-11-16 | Fail fast on `EADDRINUSE`: the cluster stops with a clear message instead of restarting workers forever | A second instance crash-looped with growing backoff; a busy port is a configuration problem, not a crash |
| 2026-11-19 | **Data Arcade light theme** replaces the dark editor-first theme: graph-paper ground, ink outlines, hard offset shadows, candy fills, Bricolage Grotesque / Figtree; landing page rebuilt around an interactive Run console; light CodeMirror theme; new brand mark and favicon (§11.1) | The dark theme read as a generic dev tool; the product should feel playful and engaging for learners while staying accessible (candy colours only as fills under ink text) |
| 2026-11-19 | **Lineage theme** replaces Data Arcade: neutral paper, Geist 600 two-tone headlines, Geist Mono labels, hairline structure, one green "pass" accent; landing rebuilt product-first (live hero demo, real catalog numbers, walkthrough, tracks table, grading panel) with tighter 112 px section rhythm (§11.1) | Arcade read as playful but not trustworthy; reviewing 12 reference sites and dev-tool landing research favoured a calm, product-first page whose motion only demonstrates the product |
| 2026-11-19 | Dot-grid page ground for Lineage (1 px dots / 22 px), with text-heavy blocks on plain paper and a fade behind the hero (§11.1) | Adds texture and an engineering-paper feel without competing with the hairline tables; a line grid was tried and rejected because it echoed the table rules |
| 2026-11-19 | Finer dotted-paper ground (0.75 px / 5 px, staggered, no patches); tags become plain text; track filters become one toolbar with a custom `Dropdown`; problem facts as a list; profile rebuilt as header + stats strip + open sections (§11.1) | The 22 px dot grid with paper patches flickered between blocks, and boxed chips and cards everywhere made the practice screens noisy; a calmer, more typographic treatment fits the serious tone |

---

## 20. Glossary

* **Bulkhead** — isolating capacity per category (here: per track) so one can't exhaust the others.
* **Fencing** — making a write conditional on still owning the lease, so a stale worker can't overwrite newer results.
* **Lease** — a time-limited claim on a job; if it isn't completed in time, the job becomes claimable again.
* **Single-flight** — collapsing concurrent identical cache misses into one load.
* **SKIP LOCKED** — a Postgres row-locking mode that skips rows other transactions hold, letting many workers pull from one table safely.
* **Pyodide** — CPython compiled to WebAssembly.
* **sqlframe** — a library implementing the PySpark DataFrame API on SQL engines (here DuckDB).
* **SSE (Server-Sent Events)** — a long-lived HTTP response the server writes events into; the browser's `EventSource` reads them and reconnects automatically.
* **ICPC-style penalty** — ranking by problems/points, then by total time where each wrong submission on a solved problem adds a fixed penalty.
* **Memory snapshot** — a saved image of an initialized interpreter's memory, restored to skip start-up work.
