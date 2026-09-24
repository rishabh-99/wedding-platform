import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { normalizePhone } from '../src/services/rsvp.service';
import { getApp, login, resetDb, seedEvents, seedUsers } from './helpers';

let eventIds: string[] = [];

const validRsvp = () => ({
  guestName: 'Ananya Sharma',
  phone: '+91 98100 11002',
  email: 'ananya@example.com',
  numberOfGuests: 2,
  side: 'BRIDE',
  attendanceStatus: 'ATTENDING',
  eventIds: [eventIds[2], eventIds[5]],
  message: 'So happy for you both!',
});

describe('RSVP API', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    eventIds = (await seedEvents()).events.map((e) => e.id);
  });

  it('creates an RSVP with its events', async () => {
    const res = await request(getApp()).post('/api/rsvp').send(validRsvp()).expect(201);
    expect(res.body).toMatchObject({ updated: false, guestName: 'Ananya Sharma', attendanceStatus: 'ATTENDING' });
    const row = await prisma.rsvp.findUniqueOrThrow({ where: { id: res.body.id }, include: { events: true } });
    expect(row.numberOfGuests).toBe(2);
    expect(row.events.map((e) => e.eventId).sort()).toEqual([eventIds[2], eventIds[5]].sort());
  });

  it('validates required fields with field-level messages', async () => {
    const res = await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), guestName: '', phone: 'abc', email: 'nope' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details.fields)).toEqual(expect.arrayContaining(['guestName', 'phone', 'email']));
  });

  it('requires at least one celebration unless declining', async () => {
    const res = await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), eventIds: [] }).expect(400);
    expect(res.body.error.details.fields.eventIds).toBeDefined();
    const declined = await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), attendanceStatus: 'DECLINED', eventIds: [] }).expect(201);
    const row = await prisma.rsvp.findUniqueOrThrow({ where: { id: declined.body.id } });
    expect(row.numberOfGuests).toBe(0);
  });

  it('rejects unknown or unpublished events', async () => {
    await prisma.event.update({ where: { id: eventIds[0] }, data: { isPublished: false } });
    await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), eventIds: [eventIds[0]] }).expect(400);
    await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), eventIds: ['does-not-exist'] }).expect(400);
  });

  it('bounds the number of guests', async () => {
    await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), numberOfGuests: 0 }).expect(400);
    await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), numberOfGuests: 99 }).expect(400);
  });

  it('prevents duplicates: the same phone updates the existing RSVP', async () => {
    const first = await request(getApp()).post('/api/rsvp').send(validRsvp()).expect(201);
    const second = await request(getApp())
      .post('/api/rsvp')
      .send({ ...validRsvp(), phone: '098100 11002', numberOfGuests: 3, eventIds: [eventIds[0]] })
      .expect(200);
    expect(second.body).toMatchObject({ id: first.body.id, updated: true });
    expect(await prisma.rsvp.count()).toBe(1);
    const row = await prisma.rsvp.findUniqueOrThrow({ where: { id: first.body.id }, include: { events: true } });
    expect(row.numberOfGuests).toBe(3);
    expect(row.events.map((e) => e.eventId)).toEqual([eventIds[0]]);
  });

  it('is idempotent for retried submissions', async () => {
    const body = { ...validRsvp(), idempotencyKey: 'b6c1e0f4-1111-4444-8888-123456789abc' };
    const a = await request(getApp()).post('/api/rsvp').send(body).expect(201);
    const b = await request(getApp()).post('/api/rsvp').send(body);
    expect(b.body.id).toBe(a.body.id);
    expect(await prisma.rsvp.count()).toBe(1);
  });

  it('silently drops honeypot submissions', async () => {
    await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), website: '' }).expect(201);
    await prisma.rsvp.deleteMany();
    // Bots that fill the hidden field get a fake success; nothing is stored.
    await request(getApp()).post('/api/rsvp').send({ ...validRsvp(), website: 'http://spam' }).expect(201);
    expect(await prisma.rsvp.count()).toBe(0);
  });

  it('normalises Indian phone formats', () => {
    expect(normalizePhone('+91 98100 11002')).toBe('919810011002');
    expect(normalizePhone('09810011002')).toBe('919810011002');
    expect(normalizePhone('98100-11002')).toBe('919810011002');
  });
});

describe('RSVP admin', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    eventIds = (await seedEvents()).events.map((e) => e.id);
    await request(getApp()).post('/api/rsvp').send(validRsvp()).expect(201);
    await request(getApp())
      .post('/api/rsvp')
      .send({ ...validRsvp(), guestName: 'Kabir Singh', email: 'kabir@example.com', message: null, phone: '+91 98100 11010', numberOfGuests: 5, eventIds: [eventIds[4], eventIds[5]] })
      .expect(201);
    await request(getApp())
      .post('/api/rsvp')
      .send({ ...validRsvp(), guestName: 'Arjun Malhotra', email: 'arjun@example.com', message: null, phone: '+44 7700 900123', attendanceStatus: 'DECLINED', eventIds: [] })
      .expect(201);
  });

  it('lists, searches, filters and sorts', async () => {
    const { agent } = await login();
    const all = await agent.get('/api/admin/rsvps').expect(200);
    expect(all.body.total).toBe(3);
    const search = await agent.get('/api/admin/rsvps?q=kabir').expect(200);
    expect(search.body.items.map((r: { guestName: string }) => r.guestName)).toEqual(['Kabir Singh']);
    const declined = await agent.get('/api/admin/rsvps?status=DECLINED').expect(200);
    expect(declined.body.total).toBe(1);
    const byEvent = await agent.get(`/api/admin/rsvps?eventId=${eventIds[4]}`).expect(200);
    expect(byEvent.body.total).toBe(1);
    const sorted = await agent.get('/api/admin/rsvps?sort=numberOfGuests&order=desc').expect(200);
    expect(sorted.body.items[0].guestName).toBe('Kabir Singh');
  });

  it('edits and deletes', async () => {
    const { agent, csrf } = await login();
    const list = await agent.get('/api/admin/rsvps?q=ananya').expect(200);
    const rsvp = list.body.items[0];
    const updated = await agent
      .put(`/api/admin/rsvps/${rsvp.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ ...validRsvp(), numberOfGuests: 4, eventIds: [eventIds[1]] })
      .expect(200);
    expect(updated.body.numberOfGuests).toBe(4);
    await agent.delete(`/api/admin/rsvps/${rsvp.id}`).set('X-CSRF-Token', csrf).expect(204);
    expect(await prisma.rsvp.count()).toBe(2);
  });

  it('exports a real .xlsx workbook with the expected sheets', async () => {
    const { agent } = await login();
    const res = await agent
      .get('/api/admin/rsvps/export.xlsx')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="wedding-rsvps-.*\.xlsx"/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as Parameters<typeof wb.xlsx.load>[0]);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(['All RSVPs', 'Summary', 'Engagement', 'Haldi & Mehendi', 'Sangeet', 'Wedding', 'Rooms']);

    const all = wb.getWorksheet('All RSVPs')!;
    expect(all.getRow(1).getCell(1).value).toBe('Guest name');
    expect(all.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(all.autoFilter).toBeTruthy();
    expect(all.rowCount).toBe(1 + 3 + 1); // header + 3 RSVPs + totals

    const wedding = wb.getWorksheet('Wedding')!;
    const names2 = [] as string[];
    wedding.eachRow((row, i) => i > 1 && names2.push(String(row.getCell(1).value)));
    expect(names2).toEqual(expect.arrayContaining(['Ananya Sharma', 'Kabir Singh', 'Total guests']));

    const summary = wb.getWorksheet('Summary')!;
    expect(summary.getRow(2).values).toEqual(expect.arrayContaining(['Total responses', 3, 7]));
  });
});
