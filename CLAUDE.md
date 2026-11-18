# DataDrill — working rules

**Read `docs/ARCHITECTURE.md` before changing anything.** It explains every component and the reasons behind each design choice.

## Keep the handbook current (mandatory)
Any change that adds or alters behaviour — endpoint, table/migration, track, config knob, failure mode, security property, grading rule or design decision — must, in the same change:
1. update the relevant section(s) of `docs/ARCHITECTURE.md` (and its "Last updated" date), and
2. add a row to its **Decision log** (§19) saying what changed and why.
If code and handbook disagree, fix whichever is wrong before finishing.
The handbook is published (admins) at `/docs/architecture`: the API syncs it into the `docs` table on every start, or run `cd server && npm run seed`.

## Invariants — don't break these
- Hidden tests and unearned solutions never reach the browser (`problem_tests WHERE NOT hidden`; grader redaction).
- One grading implementation: `shared/grader/harness.py` (+ `shell.js` for Shell) + `shared/grader/payload.js` are used by browser, grader and verify script alike.
- Python/PySpark/pandas sandboxes are single-use; only SQL and Shell sandboxes are reused (cross-user safety, §8.5).
- Points are awarded only inside the grader's verdict transaction (§8.13); company tags only with a verifiable source (§8.12).
- Contests (§12): standings are recomputed from submissions (never incremented); a contest submission is checked under a share lock on the contest row; practice submit/reveal stay blocked for problems in a user's running contest; lifecycle actions lock the contest row.
- Migrations are append-only — never edit a released file in `server/migrations/`; add a new one.
- Every new endpoint: zod-validated input, `requireAuth`/`requireRole` as appropriate, errors via `lib/errors.js`.

## Before finishing a change
- `cd server && npm test` (needs local Postgres with `datadrill_test`)
- `cd server && npm run problems:freeze -- --show` after adding/editing a SQL pack problem — review every output, then commit `golden.json`
- `cd server && npm run verify:problems` if problem content changed
- `npx vite build` at the repo root
