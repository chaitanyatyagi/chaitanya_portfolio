import { TRACK_RUNTIME } from '../../../shared/grader/runtime.js';

// ---------------------------------------------------------------------------
// In-browser runner for **Run** (visible examples only). Submit is graded on
// the server (server/grader) against every test, including hidden ones.
//
// Main-thread handle to the runner worker. One worker serves the whole tab;
// if a run exceeds the time limit the worker is terminated and recreated
// (the next run reloads the runtime).
// ---------------------------------------------------------------------------

const RUN_TIMEOUT_MS = 15_000;

let worker = null;
let nextId = 1;
const pending = new Map();
const readyTracks = new Set();
const listeners = new Set();
let state = { phase: 'idle', text: '' };

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'status') { setState({ text: data.text }); return; }
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.ok) entry.resolve(data); else entry.reject(new Error(data.error));
  };
  worker.onerror = (e) => {
    e.preventDefault();
    failAll(new Error('The code runner crashed. Try again.'));
    reset();
  };
  return worker;
}

function reset() {
  worker?.terminate();
  worker = null;
  readyTracks.clear();
}

function failAll(err) {
  pending.forEach((entry) => { clearTimeout(entry.timer); entry.reject(err); });
  pending.clear();
}

function call(message, timeoutMs) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, timer: null };
    if (timeoutMs) {
      entry.timer = setTimeout(() => {
        pending.delete(id);
        const err = new Error(`Time limit exceeded (${timeoutMs / 1000}s). Check for infinite loops — the runtime was restarted.`);
        err.timeout = true;
        failAll(err);
        reset();
        reject(err);
      }, timeoutMs);
    }
    pending.set(id, entry);
    getWorker().postMessage({ id, ...message });
  });
}

export const runtimeLabel = (track) => TRACK_RUNTIME[track]?.label || track;

// Loads the runtime for a track; safe to call repeatedly.
export async function prepare(track) {
  if (readyTracks.has(track)) { setState({ phase: 'ready', text: `${runtimeLabel(track)} ready` }); return; }
  setState({ phase: 'loading', text: 'Starting runtime…' });
  try {
    await call({ type: 'prepare', track });
    readyTracks.add(track);
    setState({ phase: 'ready', text: `${runtimeLabel(track)} ready` });
  } catch (err) {
    setState({ phase: 'error', text: `Runtime failed to load: ${err.message}` });
    throw err;
  }
}

export async function runTests(payload) {
  await prepare(payload.track);
  setState({ phase: 'running', text: 'Running tests…' });
  try {
    const { results } = await call({ type: 'run', payload }, RUN_TIMEOUT_MS);
    setState({ phase: 'ready', text: `${runtimeLabel(payload.track)} ready` });
    return results;
  } catch (err) {
    setState({ phase: err.timeout ? 'idle' : 'error', text: err.timeout ? 'Runtime restarted' : err.message });
    throw err;
  }
}
