// ---------------------------------------------------------------------------
// Live contest updates (docs §12.5).
//
// Postgres NOTIFY 'contest_event' (payload = contest id) reaches every API
// process through its LISTEN connection (server.js). Here each process fans the
// event out to the browsers it is streaming to (Server-Sent Events). The
// event only says "something changed"; browsers re-fetch the contest, so the
// stream never carries data a viewer isn't allowed to see.
//
// SSE rather than WebSockets: updates flow one way (server → browser), it is
// plain HTTP through any proxy, and EventSource reconnects by itself.
// ---------------------------------------------------------------------------
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(0);
const ALL = '*';                       // emitted after a LISTEN reconnect: events may have been missed
const streams = new Set();             // open responses, closed on shutdown
const perUser = new Map();             // userId → open stream count (this process)
const MAX_STREAMS_PER_USER = 6;
const HEARTBEAT_MS = 25_000;           // keeps proxies from closing an idle stream
const COALESCE_MS = 250;               // a burst of verdicts → one update per browser

export const emitContestEvent = (contestId) => bus.emit(contestId || ALL);
export const emitAll = () => bus.emit(ALL);
export const openStreamCount = () => streams.size;

// Returns false if this user already has too many streams open.
export function openContestStream(req, res, contestId) {
  const userId = req.user.id;
  if ((perUser.get(userId) || 0) >= MAX_STREAMS_PER_USER) return false;
  perUser.set(userId, (perUser.get(userId) || 0) + 1);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',         // nginx: don't buffer the stream
  });
  res.write('retry: 3000\n\n');
  res.write('event: update\ndata: {}\n\n');
  streams.add(res);

  let timer = null;
  const push = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; res.write('event: update\ndata: {}\n\n'); }, COALESCE_MS);
  };
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  bus.on(contestId, push);
  bus.on(ALL, push);

  const close = () => {
    clearTimeout(timer);
    clearInterval(heartbeat);
    bus.off(contestId, push);
    bus.off(ALL, push);
    if (streams.delete(res)) {
      const n = (perUser.get(userId) || 1) - 1;
      if (n) perUser.set(userId, n); else perUser.delete(userId);
    }
  };
  req.on('close', close);
  res.on('close', close);
  return true;
}

// Graceful shutdown: end every stream so server.close() can finish; the
// browsers reconnect (to another process) after `retry`.
export function closeAllStreams() {
  for (const res of streams) res.end();
}
