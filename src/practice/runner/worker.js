// Code runner worker. Learner code executes here, off the main thread, so a
// runaway loop can be killed by terminating the worker (see client.js).
//   → { id, type: 'prepare', track }        ← { id, ok }
//   → { id, type: 'run', payload }          ← { id, ok, results }
//   ← { type: 'status', text }              progress while loading
// Python / SQL / PySpark / pandas run on Pyodide + shared/grader/harness.py;
// shell runs on just-bash + shared/grader/shell.js (no Pyodide download).
import harness from '../../../shared/grader/harness.py?raw';
import { PYODIDE_URL, TRACK_RUNTIME } from '../../../shared/grader/runtime.js';

let pyodidePromise = null;
const prepared = new Map();
const status = (text) => self.postMessage({ type: 'status', text });

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      status('Downloading Python runtime…');
      const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
      const py = await loadPyodide({ indexURL: PYODIDE_URL });
      py.runPython(harness);
      return py;
    })();
  }
  return pyodidePromise;
}

let bashPromise = null;
const getBash = () => (bashPromise ||= Promise.all([import('just-bash'), import('../../../shared/grader/shell.js')]));

const LOADING = { sql: 'Loading DuckDB…', pyspark: 'Loading DuckDB engine…', pandas: 'Loading pandas…' };
const WARMING = { pyspark: 'Starting Spark session…', pandas: 'Importing pandas…' };

function prepare(track) {
  if (!prepared.has(track)) {
    prepared.set(track, (async () => {
      if (track === 'shell') {
        status('Starting sandboxed shell…');
        await getBash();
        return;
      }
      const py = await getPyodide();
      const rt = TRACK_RUNTIME[track];
      if (rt.packages.length) {
        status(LOADING[track] || 'Loading packages…');
        await py.loadPackage(rt.packages, { messageCallback: () => {} });
      }
      if (rt.pip.length) {
        status('Installing the PySpark API (sqlframe)…');
        await py.pyimport('micropip').install(rt.pip);
      }
      if (rt.warmup) {
        status(WARMING[track] || 'Warming up…');
        py.runPython(rt.warmup);
      }
    })());
  }
  return prepared.get(track);
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'prepare') {
      await prepare(data.track);
      self.postMessage({ id, ok: true });
    } else if (type === 'run') {
      await prepare(data.payload.track);
      let results;
      if (data.payload.track === 'shell') {
        const [{ Bash }, { runShell }] = await getBash();
        results = await runShell(data.payload, Bash);
      } else {
        const py = await getPyodide();
        results = JSON.parse(py.globals.get('run')(JSON.stringify(data.payload)));
      }
      self.postMessage({ id, ok: true, results });
    }
  } catch (err) {
    if (type === 'prepare') prepared.delete(data.track);
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
