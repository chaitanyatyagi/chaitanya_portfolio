// ---------------------------------------------------------------------------
// Shell grading — the shell-track counterpart of harness.py. Used by the
// browser runner (Run), the server grader's shell sandbox (Submit) and
// server/scripts/verify-problems.js, so every place grades identically.
//
// Learner scripts run in just-bash (Apache-2.0): a bash interpreter written
// in TypeScript with an in-memory filesystem. No real processes are started,
// there is no network, and python/js commands are disabled — a script can only
// see the files the test case provides. Each test case gets a fresh shell.
//
// The caller passes the `Bash` class (each environment imports its own copy).
//
// payload = { track: 'shell', code, tests: [{ name, hidden, files: {path: text}, stdin?, expected }] }
// result  = same shape as harness.py: [{ name, hidden, status, message, actual, stdout, ms }]
// ---------------------------------------------------------------------------

const WORKDIR = '/home/learner';
const LIMITS = { maxCommandCount: 200_000, maxLoopIterations: 200_000, maxCallDepth: 100 };
const MAX_OUTPUT = 20_000;

// Compatibility shim: just-bash's `sort` mishandles numeric keys on lines with
// leading blanks (e.g. `uniq -c | sort -k1,1nr`) unless -b is given. Real
// GNU/BSD sort ignores those blanks for numeric keys, so add -b whenever keys
// are used. Verified to match real sort on the test cases in docs §8.11.
const PRELUDE = 'sort() { case " $* " in *" -k"*) command sort -b "$@" ;; *) command sort "$@" ;; esac; }\n';

// Output comparison ignores trailing spaces on each line and trailing blank
// lines (a missing final newline shouldn't fail an otherwise correct answer).
export const normalizeOutput = (text) =>
  String(text).replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '');

function compare(actual, expected) {
  const a = normalizeOutput(actual).split('\n');
  const e = normalizeOutput(expected).split('\n');
  if (a.join('\n') === e.join('\n')) return { ok: true, message: '' };
  if (a.length === 1 && a[0] === '' && e.join('') !== '') return { ok: false, message: 'Your script printed nothing.' };
  const i = a.findIndex((line, k) => line !== e[k]);
  const line = i === -1 ? Math.min(a.length, e.length) + 1 : i + 1;
  if (a.length !== e.length) return { ok: false, message: `Expected ${e.length} line(s), got ${a.length}. First difference on line ${line}.` };
  return { ok: false, message: `Output differs on line ${line}.` };
}

const filesFor = (files = {}) =>
  Object.fromEntries(Object.entries(files).map(([p, text]) => [p.startsWith('/') ? p : `${WORKDIR}/${p}`, text]));

export async function runShell(payload, Bash) {
  const results = [];
  for (const test of payload.tests) {
    const started = Date.now();
    const res = { name: test.name, hidden: Boolean(test.hidden) };
    try {
      const bash = new Bash({ files: filesFor(test.files), cwd: WORKDIR, env: { HOME: WORKDIR, USER: 'learner' }, executionLimits: LIMITS });
      const r = await bash.exec(PRELUDE + payload.code, test.stdin != null ? { stdin: test.stdin } : undefined);
      const { ok, message } = compare(r.stdout, test.expected);
      const stderr = String(r.stderr || '').slice(0, MAX_OUTPUT);
      res.status = ok ? 'passed' : 'failed';
      res.message = ok ? '' : (message + (r.exitCode ? ` (exit code ${r.exitCode})` : ''));
      res.actual = String(r.stdout).slice(0, MAX_OUTPUT);
      res.stdout = stderr ? `stderr:\n${stderr}` : '';
      if (!ok && r.exitCode && !normalizeOutput(r.stdout)) {
        res.status = 'error';
        res.message = (stderr.trim().split('\n').pop() || `Script exited with code ${r.exitCode}`).slice(0, 300);
      }
    } catch (err) {
      res.status = 'error';
      res.message = String(err?.message || err).slice(0, 300);
    }
    res.ms = Date.now() - started;
    results.push(res);
  }
  return results;
}
