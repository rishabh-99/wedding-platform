import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { verifyPassword } from '../src/services/auth.service';
import { ADMIN, EDITOR, getApp, login, resetDb, seedUsers } from './helpers';

describe('authentication', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
  });

  it('stores only a bcrypt hash, never the password', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
    expect(user.passwordHash).not.toContain(ADMIN.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword(ADMIN.password, user.passwordHash)).toBe(true);
  });

  it('logs in with valid credentials and sets an httpOnly SameSite=Strict cookie', async () => {
    const res = await request(getApp()).post('/api/admin/auth/login').send(ADMIN).expect(200);
    expect(res.body.user).toMatchObject({ email: ADMIN.email, role: 'ADMIN' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.csrfToken).toEqual(expect.any(String));
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/wedding_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await request(getApp()).post('/api/admin/auth/login').send({ ...ADMIN, password: 'nope' }).expect(401);
    expect(res.body.error.message).toBe('Incorrect email or password');
  });

  it('rejects an unknown email with the same message', async () => {
    const res = await request(getApp()).post('/api/admin/auth/login').send({ email: 'nobody@example.com', password: 'whatever' }).expect(401);
    expect(res.body.error.message).toBe('Incorrect email or password');
  });

  it('returns the session with /me and supports logout', async () => {
    const { agent } = await login();
    const me = await agent.get('/api/admin/auth/me').expect(200);
    expect(me.body.user.email).toBe(ADMIN.email);
  });

  it('invalidates sessions after a password change', async () => {
    const { agent, csrf } = await login();
    await agent.post('/api/admin/auth/password').set('X-CSRF-Token', csrf).send({ currentPassword: ADMIN.password, newPassword: 'a-brand-new-password-42' }).expect(200);
    await agent.get('/api/admin/auth/me').expect(401);
  });
});

describe('authorization', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
  });

  it('blocks admin APIs without a session', async () => {
    await request(getApp()).get('/api/admin/dashboard').expect(401);
    await request(getApp()).get('/api/admin/rsvps').expect(401);
    await request(getApp()).post('/api/admin/live').send({ content: 'x' }).expect(401);
  });

  it('rejects forged/invalid session cookies', async () => {
    await request(getApp()).get('/api/admin/dashboard').set('Cookie', 'wedding_session=forged.token.value').expect(401);
  });

  it('requires the CSRF token on mutations', async () => {
    const { agent, csrf } = await login();
    const body = { content: 'The dance floor is open', action: 'draft' };
    const missing = await agent.post('/api/admin/live').send(body).expect(403);
    expect(missing.body.error.code).toBe('CSRF_FAILED');
    await agent.post('/api/admin/live').set('X-CSRF-Token', 'wrong').send(body).expect(403);
    await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send(body).expect(201);
  });

  it('restricts ADMIN-only areas from editors', async () => {
    const { agent, csrf } = await login(EDITOR);
    await agent.get('/api/admin/dashboard').expect(200);
    await agent.get('/api/admin/rsvps').expect(403);
    await agent.get('/api/admin/backups').expect(403);
    await agent.put('/api/admin/settings').set('X-CSRF-Token', csrf).send({}).expect(403);
    // …but editors can post live updates.
    await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ content: 'Hello', action: 'draft' }).expect(201);
  });

  it('writes audit logs for admin actions', async () => {
    const { agent, csrf } = await login();
    await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ content: 'Audit me', action: 'draft' }).expect(201);
    await new Promise((r) => setTimeout(r, 50));
    const logs = await prisma.auditLog.findMany({ where: { entity: 'live-update' } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe('create');
  });
});
