import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env';

const handler: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests — please wait a moment and try again.' },
  });
};

const make = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler,
  });

export const apiLimiter = make(60_000, 600);
export const loginLimiter = make(15 * 60_000, 10);
export const rsvpLimiter = make(10 * 60_000, 20);
export const guestbookLimiter = make(10 * 60_000, 10);
export const uploadLimiter = make(10 * 60_000, 300);
export const guestLoginLimiter = make(10 * 60_000, 40);
