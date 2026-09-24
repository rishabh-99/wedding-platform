import type { Express } from 'express';
import sharp from 'sharp';
import request from 'supertest';
import { parseLocalDateTime } from '@wedding/shared';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/services/auth.service';
import { settingsService } from '../src/services/settings.service';

export const ADMIN = { email: 'admin@test.local', password: 'correct-horse-battery-staple' };
export const EDITOR = { email: 'editor@test.local', password: 'editor-password-123' };

let app: Express | null = null;
export function getApp(): Express {
  if (!app) app = createApp();
  return app;
}

/** Empties every table (fast, keeps the schema). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  settingsService.invalidate();
}

export async function seedUsers() {
  await prisma.user.create({ data: { email: ADMIN.email, name: 'Admin', role: 'ADMIN', passwordHash: await hashPassword(ADMIN.password) } });
  await prisma.user.create({ data: { email: EDITOR.email, name: 'Editor', role: 'EDITOR', passwordHash: await hashPassword(EDITOR.password) } });
}

const TZ = 'Asia/Kolkata';
export const at = (local: string) => parseLocalDateTime(local, TZ);

export async function seedEvents() {
  const venue = await prisma.venue.create({ data: { name: 'Status Club Kanpur', mapsUrl: 'https://share.google/WNdAo3dcJVuN6znho' } });
  const data = [
    { name: 'Engagement', slug: 'engagement', startDateTime: at('2026-10-20T11:00'), displayOrder: 1 },
    { name: 'Haldi / Mehendi', slug: 'haldi-mehendi', startDateTime: at('2026-12-03T09:00'), displayOrder: 2 },
    { name: 'Sangeet', slug: 'sangeet', startDateTime: at('2026-12-03T21:00'), displayOrder: 3 },
    { name: 'Sehra-Bandhi', slug: 'sehra-bandhi', startDateTime: at('2026-12-04T08:00'), displayOrder: 4 },
    { name: 'Baraat', slug: 'baraat', startDateTime: at('2026-12-04T09:00'), displayOrder: 5 },
    { name: 'Jaimal & Phere', slug: 'jaimal-phere', startDateTime: at('2026-12-04T11:00'), displayOrder: 6 },
  ];
  const events = [];
  for (const d of data) events.push(await prisma.event.create({ data: { ...d, venueId: venue.id } }));
  return { venue, events };
}

/** Logs in and returns a supertest agent (keeps the cookie) plus the CSRF token. */
export async function login(creds = ADMIN) {
  const agent = request.agent(getApp());
  const res = await agent.post('/api/admin/auth/login').send(creds).expect(200);
  return { agent, csrf: res.body.csrfToken as string, cookie: res.headers['set-cookie'] as unknown as string[] };
}

export async function makePng(width = 800, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 168, g: 137, b: 79 } } })
    .png()
    .toBuffer();
}
