import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SessionUser } from '@wedding/shared';
import { env } from '../config/env';
import { badRequest, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';

export const SESSION_COOKIE = 'wedding_session';
const BCRYPT_COST = 12;

export interface SessionClaims {
  sub: string;
  role: SessionUser['role'];
  /** CSRF synchroniser token; must be echoed in the X-CSRF-Token header on mutations. */
  csrf: string;
  /** Password version — changing the password invalidates existing sessions. */
  pv: string;
}

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const passwordVersion = (hash: string) => createHash('sha256').update(hash).digest('hex').slice(0, 16);

// Used to equalise timing when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const authService = {
  async login(email: string, password: string): Promise<{ user: SessionUser; token: string; csrfToken: string }> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw unauthorized('Incorrect email or password');
    if (!user.isActive) throw unauthorized('This account has been deactivated. Ask an admin to re-enable it.');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const csrfToken = randomBytes(24).toString('base64url');
    const claims: SessionClaims = { sub: user.id, role: user.role, csrf: csrfToken, pv: passwordVersion(user.passwordHash) };
    const token = jwt.sign(claims, env.JWT_SECRET, { expiresIn: `${env.SESSION_TTL_HOURS}h`, algorithm: 'HS256' });
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, token, csrfToken };
  },

  async verify(token: string): Promise<{ user: SessionUser; claims: SessionClaims }> {
    let claims: SessionClaims;
    try {
      claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as SessionClaims;
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || !user.isActive || passwordVersion(user.passwordHash) !== claims.pv) {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, claims };
  },

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(current, user.passwordHash))) {
      throw badRequest('Current password is incorrect', { fields: { currentPassword: 'Current password is incorrect' } });
    }
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  },

  cookieOptions() {
    return {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'strict' as const,
      path: '/api',
      maxAge: env.SESSION_TTL_HOURS * 3600 * 1000,
    };
  },
};
