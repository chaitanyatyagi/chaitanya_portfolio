# DataDrill

Learning + practice platform for data engineers, analytics engineers and analysts: structured courses, and SQL / Python / PySpark problems solved in an in-browser editor — **Run** executes the examples in your browser, **Submit** is graded on the server against hidden tests.

**→ Full architecture, design decisions, scaling and failure handling: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**

## Stack
React + Vite + CodeMirror 6 · Node.js/Express API (cluster) · PostgreSQL (system of record + job queue) · grader service running learner code in Pyodide (WebAssembly) sandboxes with DuckDB and sqlframe (PySpark API) · MongoDB only for the legacy portfolio CMS.

## Quick start
```bash
# Node ≥ 22.13 and PostgreSQL running locally
createdb datadrill && createdb datadrill_test
npm install && (cd server && npm install)
cp server/.env.example server/.env          # edit values
(cd server && npm run grader:prepare && npm run seed)
npm run dev                                 # API + grader + web app :5173 (all three)
```

| Command (in `server/`) | Does |
|---|---|
| `npm start` / `npm run grader` | API cluster / grader service |
| `npm run seed:test-users` | (server/) Create local test users for trying group contests — see docs §15 |
| `npm run seed` | Sync `server/content/**` (courses, tracks, problems) into Postgres |
| `npm run verify:problems` | Reference solutions pass all tests; starters don't |
| `npm test` | Integration tests (real HTTP + Postgres + grader) |
| `npm run loadtest` | Load test (see handbook §9) |
| `npm run make-admin -- you@example.com [password] [name]` | Grant admin role (creates the account if a password is given) |

Routes: `/` landing · `/learn` courses · `/practice` tracks & problems (SQL, Python, PySpark, pandas, Shell) · `/contests` solo & group contests · `/u/:username` profiles · `/leaderboard` · `/login` `/signup` · `/blog`, `/admin` (legacy CMS).
