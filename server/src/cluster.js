// ---------------------------------------------------------------------------
// Process supervisor (node:cluster).
//
// The primary runs migrations once, then forks WEB_CONCURRENCY API workers
// that share the listening port. If a worker crashes (a bug, out of memory),
// the primary replaces it — with exponential backoff if it keeps crashing — so
// one bad request can't take the API down. The OS spreads connections across
// workers, using every CPU core.
// ---------------------------------------------------------------------------
import cluster from 'node:cluster';
import { config } from './config.js';
import { logger } from './logger.js';

if (cluster.isPrimary) {
  const { migrate, pool } = await import('./db.js');
  try {
    await migrate();
  } catch (err) {
    logger.fatal({ err: err.message }, 'migrations failed — refusing to start');
    process.exit(1);
  }
  // Publish the docs that shipped with this code (repo → `docs` table).
  // Non-fatal: the site works without them.
  try {
    const { syncDocs } = await import('./content/docs.js');
    logger.info(await syncDocs(), 'docs synced');
  } catch (err) {
    logger.warn({ err: err.message }, 'docs sync failed');
  }
  await pool.end();

  let shuttingDown = false;
  let recentCrashes = 0;
  const fork = () => cluster.fork();
  for (let i = 0; i < config.webConcurrency; i++) fork();
  logger.info({ workers: config.webConcurrency }, 'API primary started');

  // A worker reporting a configuration problem (e.g. port already in use)
  // stops the whole cluster: restarting can't fix it.
  cluster.on('message', (_worker, msg) => {
    if (msg?.type !== 'fatal' || shuttingDown) return;
    shuttingDown = true;
    process.exitCode = 1;
    logger.fatal(msg.message);
    for (const w of Object.values(cluster.workers)) w.process.kill('SIGTERM');
  });

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    recentCrashes += 1;
    setTimeout(() => { recentCrashes = Math.max(0, recentCrashes - 1); }, 60_000).unref();
    const delay = Math.min(30_000, 250 * 2 ** Math.min(recentCrashes, 7));
    logger.error({ pid: worker.process.pid, code, signal, restartInMs: delay }, 'API worker exited — restarting');
    setTimeout(fork, delay);
  });

  const stop = (signal) => {
    shuttingDown = true;
    logger.info({ signal }, 'primary stopping workers');
    for (const w of Object.values(cluster.workers)) w.process.kill('SIGTERM');
    setTimeout(() => process.exit(0), 12_000).unref();
    cluster.on('exit', () => { if (!Object.keys(cluster.workers).length) process.exit(0); });
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
} else {
  // A truly unexpected error leaves the process in an unknown state: log it
  // and exit; the primary starts a fresh worker.
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'uncaught exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    logger.fatal({ err: String(err?.message || err) }, 'unhandled rejection');
    process.exit(1);
  });
  const { startServer } = await import('./server.js');
  await startServer();
}
