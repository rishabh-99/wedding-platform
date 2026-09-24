import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env';

const handler: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests — please wait a moment and try again.' },
  });
};

const make = (windowMs: number, limit: number, opts: Partial<Options> = {}) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler,
    ...opts,
  });

/*
 * Limits are per network address. At the venue, dozens of guests share one address
 * (the venue WiFi, or Jio/Airtel carrier NAT), so these are sized for a crowd, not a person.
 * Sign-in limits count only failed attempts, so a room full of people signing in is fine
 * while password/phone guessing is still slowed down.
 */
export const apiLimiter = make(60_000, 3000);
export const loginLimiter = make(15 * 60_000, 20, { skipSuccessfulRequests: true });
export const guestLoginLimiter = make(10 * 60_000, 100, { skipSuccessfulRequests: true });
export const rsvpLimiter = make(10 * 60_000, 100);
export const guestbookLimiter = make(10 * 60_000, 60);
export const uploadLimiter = make(10 * 60_000, 600);
