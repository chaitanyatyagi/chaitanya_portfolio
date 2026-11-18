// ---------------------------------------------------------------------------
// Express application: middleware order matters and is deliberate.
//
//   security headers → request id/log → cookies → body (size-capped)
//   → authenticate (cheap JWT check, never rejects) → coarse per-IP limit
//   → health → platform routers (CSRF-guarded) → legacy CMS → 404 → errors
// ---------------------------------------------------------------------------
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { pool } from './db.js';
import { requestContext, csrfGuard, notFoundHandler, errorHandler } from './middleware/http.js';
import { authenticate } from './middleware/auth.js';
import { rateLimit } from './lib/rateLimit.js';
import { authRouter } from './modules/auth.js';
import { learnRouter } from './modules/learn.js';
import { practiceRouter } from './modules/practice.js';
import { submissionsRouter } from './modules/submissions.js';
import { adminRouter } from './modules/admin.js';
import { docsRouter } from './modules/docs.js';
import { profileRouter } from './modules/profile.js';
import { contestsRouter } from './modules/contests.js';
import { interviewRouter } from './modules/interview.js';
import { legacyRouter } from '../legacy/router.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy); // correct req.ip behind a load balancer
  app.set('etag', 'strong');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(requestContext);
  app.use(cookieParser());
  app.use('/api/cms', express.json({ limit: '2mb' }));   // legacy CMS saves whole site documents
  app.use(express.json({ limit: '256kb' }));             // everything else: small JSON only
  app.use(authenticate);

  // Liveness: the process is up. Readiness: it can reach Postgres. Load
  // balancers should route traffic only to ready instances.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  // Coarse per-IP ceiling across the API (abuse protection, not a quota).
  const apiLimit = rateLimit({ name: 'api', capacity: config.limits.apiPerMinute, perSeconds: 60 });

  const platform = express.Router();
  platform.use(apiLimit, csrfGuard);
  platform.use('/auth', authRouter);
  platform.use('/admin', adminRouter);
  platform.use('/docs', docsRouter);
  platform.use(learnRouter);
  platform.use(practiceRouter);
  platform.use(submissionsRouter);
  platform.use(profileRouter);
  platform.use(contestsRouter);
  platform.use(interviewRouter);
  app.use('/api', platform);

  app.use(legacyRouter);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
