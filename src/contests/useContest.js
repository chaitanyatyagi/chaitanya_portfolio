import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

// ---------------------------------------------------------------------------
// One contest, kept live (docs §12.5):
//   • GET /api/contests/:code for the data;
//   • an EventSource on /api/contests/:code/events — each "update" event
//     triggers a re-fetch (coalesced: at most one in flight + one queued);
//   • a slow poll as a safety net, and a refresh exactly at the deadline.
// `offset` = server clock − this device's clock, so countdowns use the
// server's time even when the device clock is wrong.
// ---------------------------------------------------------------------------
const POLL_MS = 20_000;

export function useContest(code) {
  const [state, setState] = useState({ data: null, error: null, loading: true, offset: 0, offline: false });
  const inflight = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    try {
      const sent = Date.now();
      const data = await api(`/contests/${code}`);
      const received = Date.now();
      // Assume the server stamped its clock halfway through the round trip.
      const offset = new Date(data.contest.serverNow).getTime() - (sent + received) / 2;
      setState({ data, error: null, loading: false, offset, offline: false });
    } catch (error) {
      // Once loaded, keep showing the last data and flag the connection instead.
      setState((s) => (s.data ? { ...s, offline: error.status === 0 || error.status >= 500 } : { ...s, error, loading: false }));
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; refresh(); }
    }
  }, [code]);

  useEffect(() => { refresh(); }, [refresh]);

  // Live stream. EventSource retries network drops by itself; a non-200
  // (e.g. the 15-minute access token expired → 401) closes it, so we refresh
  // the session through a normal API call and reopen with backoff.
  useEffect(() => {
    let es;
    let stopped = false;
    let delay = 2000;
    let timer;
    const open = () => {
      if (stopped) return;
      es = new EventSource(`/api/contests/${code}/events`);
      es.addEventListener('update', () => { delay = 2000; refresh(); });
      es.onerror = () => {
        if (es.readyState !== EventSource.CLOSED) return;
        timer = setTimeout(async () => {
          await api('/auth/me').catch(() => {});
          refresh();
          open();
        }, delay);
        delay = Math.min(delay * 2, 30_000);
      };
    };
    open();
    const poll = setInterval(refresh, POLL_MS);
    return () => { stopped = true; es?.close(); clearTimeout(timer); clearInterval(poll); };
  }, [code, refresh]);

  // Flip to "ended" exactly when the clock runs out.
  const endsAt = state.data?.contest.endsAt;
  const phase = state.data?.contest.phase;
  useEffect(() => {
    if (phase !== 'live' || !endsAt) return undefined;
    const ms = new Date(endsAt).getTime() - (Date.now() + state.offset);
    const t = setTimeout(refresh, Math.max(0, ms) + 300);
    return () => clearTimeout(t);
  }, [phase, endsAt, state.offset, refresh]);

  return { ...state, refresh };
}

// Server time, ticking once a second.
export function useServerNow(offset, active = true) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset, active]);
  return now;
}

export function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

export const TRACK_LABEL = { sql: 'SQL', python: 'Python', dsa: 'DSA', pyspark: 'PySpark', pandas: 'pandas', shell: 'Shell' };
export const POOL_LABEL = { unsolved: 'Unsolved', solved: 'Solved (revise)', both: 'Both, unsolved first' };
