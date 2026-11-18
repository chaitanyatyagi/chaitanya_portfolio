// Cross-cutting HTTP middleware: request ids + access logs, CSRF guard,
// 404 and the error handler.
import crypto from 'node:crypto';
import { logger } from '../logger.js';
import { AppError, forbidden } from '../lib/errors.js';

export function requestContext(req, res, next) {
  const given = req.headers['x-request-id'];
  req.id = typeof given === 'string' && /^[\w-]{8,64}$/.test(given) ? given : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({ reqId: req.id, method: req.method, url: req.originalUrl, status: res.statusCode, ms: Math.round(ms), user: req.user?.id }, 'request');
  });
  next();
}

// CSRF defence for cookie-authenticated, state-changing requests.
// Browsers attach cookies to cross-site requests, so a malicious page could
// try to POST to our API "as" a signed-in user. Two layers stop that:
//   1. cookies are SameSite=Lax — not sent on cross-site POST/PUT/DELETE;
//   2. this check requires a custom header. A cross-site page cannot add
//      custom headers without a CORS preflight, which our API never approves.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export function csrfGuard(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  if (req.get('X-Requested-With') !== 'datadrill') return next(forbidden('Missing CSRF header.'));
  next();
}

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, 'not_found', `No route for ${req.method} ${req.path}`));
}

// Postgres errors that mean "the database is overloaded or unreachable".
const PG_UNAVAILABLE = new Set(['57014', '53300', '57P01', '57P03', '08000', '08003', '08006']);

// eslint-disable-next-line no-unused-vars
// Validation errors in plain words, naming the field: zod's defaults
// ("Required", "Expected number, received string") don't tell a person what
// to fix. Custom messages written in a schema are kept as they are.
const FIELD = {
  tracks: 'Tracks', difficulties: 'Difficulty', topics: 'Topics', count: 'Number of questions', minutes: 'Duration',
  pool: 'Problem pool', mode: 'Contest type', title: 'Title', invite: 'Invitations', usernames: 'Usernames',
  problemId: 'Problem', problem: 'Problem', code: 'Code', clientToken: 'Request id', contestId: 'Contest',
  email: 'Email', password: 'Password', name: 'Name', username: 'Username', headline: 'Headline', token: 'Reset link', tz: 'Time zone',
};
const TYPE = { number: 'a number', integer: 'a whole number', string: 'text', array: 'a list', object: 'an object', boolean: 'true or false' };
const DEFAULT_MESSAGE = /^(Required|Expected |Invalid enum value|Number must be|String must contain|Array must contain|Invalid uuid|Invalid input|Invalid email|Invalid literal)/;
export function friendlyIssue(issue) {
  if (issue.message && !DEFAULT_MESSAGE.test(issue.message)) return issue.message;
  const key = [...issue.path].reverse().find((k) => typeof k === 'string');
  const label = FIELD[key] || (key ? key[0].toUpperCase() + key.slice(1) : 'The request');
  const item = issue.path.some((k) => typeof k === 'number') ? ' (each item)' : '';
  switch (issue.code) {
    case 'invalid_type':
      if (!issue.path.length) return 'The request body must be a JSON object.';
      return issue.received === 'undefined' ? `${label} is required.` : `${label}${item} must be ${TYPE[issue.expected] || issue.expected}.`;
    case 'invalid_enum_value': return `${label}${item} must be one of: ${issue.options.join(', ')}.`;
    case 'too_small':
      if (issue.type === 'array') return `${label}: choose at least ${issue.minimum}.`;
      if (issue.type === 'string') return issue.minimum <= 1 ? `${label} can't be empty.` : `${label} must be at least ${issue.minimum} characters.`;
      return `${label} must be at least ${issue.minimum}.`;
    case 'too_big':
      if (issue.type === 'array') return `${label}: choose at most ${issue.maximum}.`;
      if (issue.type === 'string') return `${label} must be at most ${issue.maximum} characters.`;
      return `${label} must be at most ${issue.maximum}.`;
    case 'invalid_string': return issue.validation === 'uuid' ? `${label} is not a valid id.` : `${label} is not valid.`;
    default: return `${label}: ${issue.message}`;
  }
}

export function errorHandler(err, req, res, _next) {
  let status = 500;
  let body = { code: 'internal', message: 'Something went wrong on our side.' };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message, details: err.details };
    if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
  } else if (err?.name === 'ZodError') {
    status = 400;
    body = { code: 'validation', message: err.issues[0] ? friendlyIssue(err.issues[0]) : 'Invalid input.', details: err.issues.map((i) => ({ path: i.path.join('.'), message: friendlyIssue(i) })) };
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    body = { code: 'too_large', message: 'Request body is too large.' };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'bad_json', message: 'Malformed JSON body.' };
  } else if (PG_UNAVAILABLE.has(err?.code) || /timeout exceeded when trying to connect|Connection terminated|ECONNREFUSED/.test(err?.message || '')) {
    status = 503;
    res.setHeader('Retry-After', '3');
    body = { code: 'unavailable', message: 'The service is temporarily overloaded — please retry.' };
  }

  // A 500 says *what to quote* when reporting it: the request id is in the logs.
  if (status === 500) body.message = `Something went wrong on our side (reference ${req.id}). Please try again.`;
  if (status >= 500) logger.error({ reqId: req.id, err: { message: err?.message, code: err?.code, stack: err?.stack } }, 'request failed');
  if (res.headersSent) return;
  res.status(status).json({ error: body });
}
