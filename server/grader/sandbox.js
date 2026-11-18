// ---------------------------------------------------------------------------
// Sandbox: a child process that runs learner code inside Pyodide (CPython
// compiled to WebAssembly). Started by the grader supervisor like this:
//
//   node --permission --allow-fs-read=<pyodide, wheels, harness, snapshot only>
//        --max-old-space-size=… sandbox.js <track> <wheelsDir> <harnessPath> [snapshot]
//   with an EMPTY environment (no secrets to read).
//
// Isolation layers, outermost first (docs/ARCHITECTURE.md §7.4):
//   1. separate OS process — a crash or runaway loop kills only this process;
//      the supervisor enforces the time limit by killing it;
//   2. Node permission model — no filesystem writes, no reads outside the
//      allow-list, no child processes, no worker threads, no native addons;
//   3. empty environment — process.env holds no credentials;
//   4. WebAssembly — Python runs in linear memory with a virtual filesystem;
//      it can't make syscalls on the host;
//   5. Python↔JS bridge removed — `import js` / `pyodide_js` are unregistered
//      after setup, and fetch/WebSocket globals are deleted;
//   6. (production) the grader container has no network egress.
//
// Protocol (IPC): → { id, payload }   ← { type: 'ready' } | { type: 'result', id, results }
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, constants as fsConstants } from 'node:fs';

// Under --permission, process.binding() is denied; Pyodide only uses it to
// read filesystem flag constants, which fs.constants provides safely.
process.binding = (name) => {
  if (name === 'constants') return { fs: fsConstants };
  throw new Error(`process.binding(${name}) is not available in the sandbox`);
};

const [mode, wheelsDir, harnessPath, snapshotPath] = process.argv.slice(2);

// Shell track: no Python at all. Scripts run in just-bash — a bash
// interpreter with an in-memory filesystem, no network and no real processes
// — inside this same locked-down process. A fresh shell per test case.
if (mode === 'shell') {
  const { Bash } = await import('just-bash');
  const { runShell } = await import(new URL('../../shared/grader/shell.js', import.meta.url));
  for (const name of ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource']) delete globalThis[name];
  process.on('message', async (msg) => {
    if (!msg || typeof msg.id !== 'string') return;
    process.send({ type: 'result', id: msg.id, results: await runShell(msg.payload, Bash) });
  });
  process.on('disconnect', () => process.exit(0));
  process.send({ type: 'ready' });
  await new Promise(() => {});
}

const { SANDBOX_PACKAGES: PACKAGES } = await import('./packages.js');
const { loadPyodide } = await import('pyodide');

// Snapshot maker: boot a pristine interpreter, load the harness, and hand the
// memory image to the supervisor. Python sandboxes then start by restoring
// this image (~0.1 s) instead of booting from scratch (~1 s). Pyodide can only
// snapshot plain-Python state, so SQL/PySpark (DuckDB is a compiled library)
// still boot normally.
if (mode === 'make-python-snapshot') {
  const py = await loadPyodide({ _makeSnapshot: true });
  py.runPython(readFileSync(harnessPath, 'utf8'));
  process.send({ type: 'snapshot', bytes: py.makeMemorySnapshot() }, () => process.exit(0));
  await new Promise(() => {});
}

const track = mode;
let py;
let harnessLoaded = false;
if (track === 'python' && snapshotPath) {
  try {
    py = await loadPyodide({ _loadSnapshot: readFileSync(snapshotPath) });
    harnessLoaded = true;
  } catch {
    py = null; // fall back to a normal boot
  }
}
py ||= await loadPyodide();
if (PACKAGES[track].length) await py.loadPackage(PACKAGES[track], { messageCallback: () => {} });

if (track === 'pyspark') {
  // sqlframe (the PySpark API) + deps from local, pre-downloaded wheels.
  py.FS.mkdirTree('/wheels');
  const files = readdirSync(wheelsDir).filter((f) => f.endsWith('.whl'));
  for (const f of files) py.FS.writeFile(`/wheels/${f}`, readFileSync(`${wheelsDir}/${f}`));
  await py.runPythonAsync(`import micropip
await micropip.install(${JSON.stringify(files.map((f) => `emfs:/wheels/${f}`))}, deps=False)
del micropip`);
}

if (!harnessLoaded) py.runPython(readFileSync(harnessPath, 'utf8'));
if (track === 'pyspark') py.runPython('_spark()'); // start the Spark session before any job
if (track === 'pandas') py.runPython('import pandas'); // ~1.5 s — pay it before the job, not during

// Lock down: cut every Python → JS bridge and drop network-capable globals.
py.unregisterJsModule('js');
py.unregisterJsModule('pyodide_js');
py.runPython(`import sys
for _m in [k for k in list(sys.modules) if k in ("js", "pyodide_js") or k.startswith(("pyodide.code", "pyodide.http", "pyodide.ffi", "micropip"))]:
    sys.modules.pop(_m, None)
del _m`);
for (const name of ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource']) delete globalThis[name];

const run = py.globals.get('run');
process.on('message', (msg) => {
  if (!msg || typeof msg.id !== 'string') return;
  // Synchronous: a runaway job blocks this process, and the supervisor kills it.
  const results = JSON.parse(run(JSON.stringify(msg.payload)));
  process.send({ type: 'result', id: msg.id, results });
});
process.on('disconnect', () => process.exit(0)); // supervisor went away
process.send({ type: 'ready' });
