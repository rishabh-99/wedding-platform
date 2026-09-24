import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { at, getApp, login, resetDb, seedEvents, seedUsers } from './helpers';

let eventIds: string[] = [];

async function rsvp(guestName: string, phone: string, side: 'BRIDE' | 'GROOM', status = 'ATTENDING') {
  const res = await request(getApp())
    .post('/api/rsvp')
    .send({ guestName, phone, side, numberOfGuests: 2, attendanceStatus: status, eventIds: status === 'DECLINED' ? [] : [eventIds[5]] })
    .expect(201);
  return res.body.id as string;
}

describe('guest side tag', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    eventIds = (await seedEvents()).events.map((e) => e.id);
  });

  it('requires guests to say whose side they are from', async () => {
    const res = await request(getApp())
      .post('/api/rsvp')
      .send({ guestName: 'No Side', phone: '+91 98100 22222', numberOfGuests: 1, attendanceStatus: 'ATTENDING', eventIds: [eventIds[0]] })
      .expect(400);
    expect(res.body.error.details.fields.side).toBe('Please tell us whose side you are from');
  });

  it('stores the side, filters by it and reports it on the dashboard', async () => {
    await rsvp('Bride Friend', '+91 98100 30001', 'BRIDE');
    await rsvp('Groom Cousin', '+91 98100 30002', 'GROOM');
    await rsvp('Groom Uncle', '+91 98100 30003', 'GROOM');
    const { agent } = await login();
    const groom = await agent.get('/api/admin/rsvps?side=GROOM').expect(200);
    expect(groom.body.items.map((r: { guestName: string }) => r.guestName).sort()).toEqual(['Groom Cousin', 'Groom Uncle']);
    const dash = await agent.get('/api/admin/dashboard').expect(200);
    expect(dash.body.sides).toEqual(expect.arrayContaining([{ side: 'GROOM', responses: 2, guests: 4 }, { side: 'BRIDE', responses: 1, guests: 2 }]));
  });
});

describe('room management', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    eventIds = (await seedEvents()).events.map((e) => e.id);
  });

  it('manages accommodations and allots rooms to RSVP parties', async () => {
    const a = await rsvp('Ananya Sharma', '+91 98100 11002', 'BRIDE');
    const b = await rsvp('Kabir Singh', '+91 98100 11010', 'GROOM');
    await rsvp('Arjun Malhotra', '+44 7700 900123', 'GROOM', 'DECLINED');
    const { agent, csrf } = await login();

    const hotel = await agent.post('/api/admin/accommodations').set('X-CSRF-Token', csrf).send({ name: 'Hotel One', contactPhone: '+91 90000 00001' }).expect(201);
    const club = await agent.post('/api/admin/accommodations').set('X-CSRF-Token', csrf).send({ name: 'Club Rooms' }).expect(201);

    // Only attending/maybe parties need rooms.
    let board = await agent.get('/api/admin/rooms').expect(200);
    expect(board.body.unassigned.map((u: { guestName: string }) => u.guestName).sort()).toEqual(['Ananya Sharma', 'Kabir Singh']);

    const room = await agent
      .post('/api/admin/rooms')
      .set('X-CSRF-Token', csrf)
      .send({ rsvpId: a, accommodationId: hotel.body.id, roomNumber: '204', checkIn: at('2026-12-02T14:00').toISOString(), checkOut: at('2026-12-05T11:00').toISOString() })
      .expect(201);
    expect(room.body).toMatchObject({ accommodationName: 'Hotel One', roomNumber: '204', sharedWith: [] });

    // A party can hold several rooms, across venues.
    await agent.post('/api/admin/rooms').set('X-CSRF-Token', csrf).send({ rsvpId: a, accommodationId: club.body.id, roomNumber: 'G2' }).expect(201);
    // Sharing a room is allowed but flagged.
    const shared = await agent.post('/api/admin/rooms').set('X-CSRF-Token', csrf).send({ rsvpId: b, accommodationId: hotel.body.id, roomNumber: '204' }).expect(201);
    expect(shared.body.sharedWith).toEqual(['Ananya Sharma']);

    board = await agent.get('/api/admin/rooms').expect(200);
    expect(board.body.unassigned).toHaveLength(0);
    const hotelBoard = board.body.accommodations.find((x: { id: string }) => x.id === hotel.body.id);
    expect(hotelBoard.rooms).toHaveLength(2);
    expect(hotelBoard.roomsAssigned).toBe(2);

    // RSVP list shows rooms and supports filters.
    const list = await agent.get(`/api/admin/rsvps?accommodationId=${club.body.id}`).expect(200);
    expect(list.body.items[0].rooms.map((r: { roomNumber: string }) => r.roomNumber).sort()).toEqual(['204', 'G2']);

    await agent.put(`/api/admin/rooms/${shared.body.id}`).set('X-CSRF-Token', csrf).send({ rsvpId: b, accommodationId: hotel.body.id, roomNumber: '205' }).expect(200);
    await agent.delete(`/api/admin/rooms/${room.body.id}`).set('X-CSRF-Token', csrf).expect(204);
    const needs = await agent.get('/api/admin/rsvps?needsRoom=true').expect(200);
    expect(needs.body.total).toBe(0); // Ananya still has G2

    // Excel includes the Rooms sheet.
    const res = await agent
      .get('/api/admin/rsvps/export.xlsx')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as Parameters<typeof wb.xlsx.load>[0]);
    const sheet = wb.getWorksheet('Rooms')!;
    const rows: string[] = [];
    sheet.eachRow((row, i) => i > 1 && rows.push(`${row.getCell(1).value} ${row.getCell(2).value} ${row.getCell(3).value}`));
    expect(rows).toEqual(['Club Rooms G2 Ananya Sharma', 'Hotel One 205 Kabir Singh']);

    // Deleting an RSVP frees its rooms (cascade).
    await agent.delete(`/api/admin/rsvps/${a}`).set('X-CSRF-Token', csrf).expect(204);
    expect(await prisma.roomAssignment.count()).toBe(1);
  });

  it('validates room input', async () => {
    const a = await rsvp('Ananya Sharma', '+91 98100 11002', 'BRIDE');
    const { agent, csrf } = await login();
    const hotel = await agent.post('/api/admin/accommodations').set('X-CSRF-Token', csrf).send({ name: 'Hotel One' }).expect(201);
    const bad = await agent
      .post('/api/admin/rooms')
      .set('X-CSRF-Token', csrf)
      .send({ rsvpId: a, accommodationId: hotel.body.id, roomNumber: '', checkIn: '2026-12-05T00:00:00Z', checkOut: '2026-12-02T00:00:00Z' })
      .expect(400);
    expect(Object.keys(bad.body.error.details.fields)).toEqual(expect.arrayContaining(['roomNumber', 'checkOut']));
    await agent.post('/api/admin/rooms').set('X-CSRF-Token', csrf).send({ rsvpId: 'nope', accommodationId: hotel.body.id, roomNumber: '1' }).expect(404);
  });
});

describe('WhatsApp group link (settings)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
  });

  it('saves the invite link, exposes it publicly and rejects non-URLs', async () => {
    const { agent, csrf } = await login();
    const current = (await agent.get('/api/admin/settings').expect(200)).body;
    const base = { ...current };
    for (const k of ['logoUrl', 'ogImageUrl']) delete base[k];
    const bad = await agent.put('/api/admin/settings').set('X-CSRF-Token', csrf).send({ ...base, whatsappGroupUrl: 'not a link' }).expect(400);
    expect(bad.body.error.details.fields.whatsappGroupUrl).toBeDefined();
    await agent.put('/api/admin/settings').set('X-CSRF-Token', csrf).send({ ...base, whatsappGroupUrl: 'https://chat.whatsapp.com/AbC123' }).expect(200);
    expect((await request(getApp()).get('/api/settings').expect(200)).body.whatsappGroupUrl).toBe('https://chat.whatsapp.com/AbC123');
    await agent.put('/api/admin/settings').set('X-CSRF-Token', csrf).send({ ...base, whatsappGroupUrl: '' }).expect(200);
    expect((await request(getApp()).get('/api/settings').expect(200)).body.whatsappGroupUrl).toBeNull();
  });

  it('no longer stores dietary preferences', async () => {
    eventIds = (await seedEvents()).events.map((e) => e.id);
    const id = await rsvp('Ananya Sharma', '+91 98100 11002', 'BRIDE');
    const { agent } = await login();
    const list = await agent.get('/api/admin/rsvps').expect(200);
    expect(list.body.items.find((r: { id: string }) => r.id === id)).not.toHaveProperty('dietaryPreference');
  });
});

describe('event manager contacts', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    eventIds = (await seedEvents()).events.map((e) => e.id);
  });

  it('admins manage contacts; guests only see public ones', async () => {
    const { agent, csrf } = await login();
    const manager = await agent
      .post('/api/admin/contacts')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Priya', role: 'Event Manager — Sangeet', phone: '+91 90000 00012', eventId: eventIds[2] })
      .expect(201);
    expect(manager.body.event.slug).toBe('sangeet');
    await agent.post('/api/admin/contacts').set('X-CSRF-Token', csrf).send({ name: 'Vendor', role: 'Decor', phone: '1234567', isPublic: false }).expect(201);
    const missing = await agent.post('/api/admin/contacts').set('X-CSRF-Token', csrf).send({ name: 'No Way', role: 'Nobody' }).expect(400);
    expect(missing.body.error.details.fields.phone).toMatch(/at least/);

    expect((await agent.get('/api/admin/contacts').expect(200)).body).toHaveLength(2);
    const pub = await request(getApp()).get('/api/contacts').expect(200);
    expect(pub.body.map((c: { name: string }) => c.name)).toEqual(['Priya']);

    await agent.put(`/api/admin/contacts/${manager.body.id}`).set('X-CSRF-Token', csrf).send({ name: 'Priya S', role: 'Event Manager', email: 'p@example.com' }).expect(200);
    await agent.delete(`/api/admin/contacts/${manager.body.id}`).set('X-CSRF-Token', csrf).expect(204);
    expect((await request(getApp()).get('/api/contacts')).body).toHaveLength(0);
  });
});
