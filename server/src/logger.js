// Structured JSON logs (pino): one line per event, machine-parseable, cheap.
// Every request log carries a request id so a single request can be traced.
import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
  base: { pid: process.pid },
  redact: ['req.headers.cookie', 'req.headers.authorization', 'password', '*.password'],
});
