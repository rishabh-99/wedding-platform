import type { NextFunction, Request, Response } from 'express';
import type { Role, SessionUser } from '@wedding/shared';
import { AppError, forbidden, unauthorized } from '../lib/errors';
import { SESSION_COOKIE, authService, safeEqual, type SessionClaims } from '../services/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      session?: SessionClaims;
    }
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Authentication: valid session cookie required. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw unauthorized();
    const { user, claims } = await authService.verify(token);
    req.user = user;
    req.session = claims;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * CSRF protection (synchroniser token): state-changing requests must send the
 * per-session token in X-CSRF-Token. Combined with SameSite=Strict cookies.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const header = req.header('X-CSRF-Token');
  if (!req.session || !header || !safeEqual(header, req.session.csrf)) {
    return next(new AppError(403, 'CSRF_FAILED', 'Your session token is invalid. Please refresh the page.'));
  }
  next();
}

/** Authorisation: restrict to the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
