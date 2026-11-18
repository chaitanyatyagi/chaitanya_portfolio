// Typed HTTP errors. Route code throws these; the error middleware turns them
// into consistent JSON: { error: { code, message, details? } }.
export class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = extra.details;
    this.retryAfter = extra.retryAfter;
    this.expose = true;
  }
}

export const badRequest = (message, details) => new AppError(400, 'bad_request', message, { details });
export const unauthenticated = (message = 'Please sign in to continue.') => new AppError(401, 'unauthenticated', message);
export const forbidden = (message = "You don't have access to this.") => new AppError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'not_found', message);
export const conflict = (message) => new AppError(409, 'conflict', message);
export const tooMany = (message, retryAfter = 60) => new AppError(429, 'rate_limited', message, { retryAfter });
export const unavailable = (message = 'Service is busy — please retry shortly.', retryAfter = 5) =>
  new AppError(503, 'unavailable', message, { retryAfter });

// Wraps an async route so a rejected promise reaches the error middleware
// (Express 4 doesn't do this by itself).
export const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
