// ---------------------------------------------------------------------------
// One API process: HTTP server with defensive timeouts, content-change
// listener, and graceful shutdown.
// ---------------------------------------------------------------------------
import http from 'node:http';
import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';
import { pool } from './db.js';
import { createApp } from './app.js';
import { clearContentCache } from './content/store.js';
import { emitContestEvent, emitAll, closeAllStreams } from './lib/events.js';
import { connectMongo } from '../legacy/router.js';

// Every API process holds one LISTEN connection:
//   content_changed  an admin published content → drop the in-memory cache;
//   contest_event    a contest changed (verdict, join, start…) → push to the
//                    browsers this process streams that contest to (lib/events.js).
// On reconnect we clear the cache and nudge every stream, in case a
// notification was missed while disconnected.
function listenForChanges() {
  let client;
  let stopped = false;
  let delay = 1000;
  const connect = async () => {
    if (stopped) return;
    client = new pg.Client({ connectionString: config.postgres.url, application_name: 'datadrill-listen' });
    client.on('error', () => {});
    client.on('end', () => { if (!stopped) setTimeout(connect, delay = Math.min(delay * 2, 30_000)); });
    client.on('notification', (msg) => {
      if (msg.channel === 'contest_event') emitContestEvent(msg.payload);
      else clearContentCache();
    });
    try {
      await client.connect();
      await client.query('LISTEN content_changed');
      await client.query('LISTEN contest_event');
      clearContentCache();
      emitAll();
      delay = 1000;
    } catch {
      client.end().catch(() => {});
    }
  };
  connect();
  return () => { stopped = true; client?.end().catch(() => {}); };
}

export async function startServer({ port = config.port } = {}) {
  const app = createApp();
  const server = http.createServer(app);

  // Slow or stuck clients can't hold sockets forever.
  server.headersTimeout = 10_000;   // must receive headers within 10s
  server.requestTimeout = 30_000;   // whole request within 30s
  server.keepAliveTimeout = 5_000;  // idle keep-alive sockets close after 5s

  const stopListening = listenForChanges();
  if (config.mongoUrl) connectMongo();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => { server.off('error', reject); resolve(); });
  }).catch((err) => {
    // A busy port won't fix itself — restarting would just loop. Tell the
    // cluster primary to stop everything with a clear message.
    if (err.code === 'EADDRINUSE') {
      const message = `Port ${port} is already in use — another API instance is probably running. Stop it (lsof -nP -iTCP:${port} -sTCP:LISTEN) or set PORT.`;
      if (process.send) process.send({ type: 'fatal', message });
      else logger.fatal(message);
      process.exit(78); // EX_CONFIG: configuration problem, not a crash
    }
    throw err;
  });
  logger.info({ port }, 'API listening');

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down: draining in-flight requests');
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    stopListening();
    closeAllStreams(); // live contest streams would otherwise hold server.close() open
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}
