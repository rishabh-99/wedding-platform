import request from 'supertest';
import webpush from 'web-push';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { broker } from '../src/realtime/sseBroker';
import { hashPassword } from '../src/services/auth.service';
import { pushService } from '../src/services/push.service';
import { ADMIN, at, getApp, login, makePng, resetDb, seedEvents, seedUsers } from './helpers';

let eventIds: string[] = [];
const PASSWORD = 'staff-password-123';

async function addStaff(role: 'COORDINATOR' | 'HOSPITALITY' | 'PHOTOGRAPHER' | 'EDITOR', email = `${role.toLowerCase()}-staff@test.local`) {
  await prisma.user.create({ data: { email, name: `${role} person`, role, passwordHash: await hashPassword(PASSWORD) } });
  return login({ email, password: PASSWORD });
}

async function rsvp(name: string, phone: string, events = [eventIds[2]!, eventIds[5]!], numberOfGuests = 3) {
  const agent = request.agent(getApp());
  const res = await agent
    .post('/api/rsvp')
    .send({ guestName: name, phone, side: 'BRIDE', numberOfGuests, attendanceStatus: 'ATTENDING', eventIds: events })
    .expect(201);
  return { id: res.body.id as string, agent };
}

beforeEach(async () => {
  await resetDb();
  await seedUsers();
  eventIds = (await seedEvents()).events.map((e) => e.id);
});

describe('staff roles & permissions', () => {
  it('limits each role to its own screens', async () => {
    const coord = await addStaff('COORDINATOR');
    await coord.agent.get('/api/admin/checkin').expect(200);
    await coord.agent.get('/api/admin/rsvps').expect(200);
    await coord.agent.get('/api/admin/rooms').expect(403);
    await coord.agent.get('/api/admin/portraits').expect(403);
    await coord.agent.get('/api/admin/team').expect(403);
    await coord.agent.put('/api/admin/rsvps/x').set('X-CSRF-Token', coord.csrf).send({}).expect(403);

    const hosp = await addStaff('HOSPITALITY');
    await hosp.agent.get('/api/admin/rooms').expect(200);
    await hosp.agent.get('/api/admin/arrivals').expect(200);
    await hosp.agent.get('/api/admin/checkin').expect(200);
    await hosp.agent.get('/api/admin/story').expect(403);

    const photo = await addStaff('PHOTOGRAPHER');
    await photo.agent.get('/api/admin/portraits').expect(200);
    await photo.agent.get('/api/admin/media').expect(200);
    await photo.agent.get('/api/admin/checkin').expect(403);
    await photo.agent.get('/api/admin/arrivals').expect(403);

    const editor = await addStaff('EDITOR');
    await editor.agent.get('/api/admin/rooms').expect(403);
    await editor.agent.get('/api/admin/story').expect(200);
  });
});

describe('team page', () => {
  it('creates staff logins, resets passwords, deactivates, and protects the last admin', async () => {
    const { agent, csrf } = await login();
    const created = await agent
      .post('/api/admin/team')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Priya', email: 'Priya@Photos.in', role: 'PHOTOGRAPHER', phone: '+91 90000 11111', password: 'a-long-password' })
      .expect(201);
    expect(created.body).toMatchObject({ email: 'priya@photos.in', role: 'PHOTOGRAPHER', isActive: true });
    expect(created.body.passwordHash).toBeUndefined();
    await agent.post('/api/admin/team').set('X-CSRF-Token', csrf).send({ name: 'Dup', email: 'priya@photos.in', role: 'EDITOR', password: 'a-long-password' }).expect(409);

    const priya = await login({ email: 'priya@photos.in', password: 'a-long-password' });
    await priya.agent.get('/api/admin/portraits').expect(200);

    // Password reset logs her out everywhere; deactivation blocks login.
    await agent.put(`/api/admin/team/${created.body.id}`).set('X-CSRF-Token', csrf).send({ name: 'Priya', role: 'PHOTOGRAPHER', isActive: true, password: 'another-long-pass' }).expect(200);
    await priya.agent.get('/api/admin/portraits').expect(401);
    await agent.put(`/api/admin/team/${created.body.id}`).set('X-CSRF-Token', csrf).send({ name: 'Priya', role: 'PHOTOGRAPHER', isActive: false }).expect(200);
    const denied = await request(getApp()).post('/api/admin/auth/login').send({ email: 'priya@photos.in', password: 'another-long-pass' }).expect(401);
    expect(denied.body.error.message).toMatch(/deactivated/);

    // Cannot remove your own admin access or the last admin.
    const me = (await agent.get('/api/admin/team').expect(200)).body.find((u: { email: string }) => u.email === ADMIN.email);
    await agent.put(`/api/admin/team/${me.id}`).set('X-CSRF-Token', csrf).send({ name: 'Admin', role: 'EDITOR', isActive: true }).expect(400);
    await agent.delete(`/api/admin/team/${me.id}`).set('X-CSRF-Token', csrf).expect(400);
    await agent.delete(`/api/admin/team/${created.body.id}`).set('X-CSRF-Token', csrf).expect(204);
  });
});

describe('guest portal', () => {
  it('signs guests in with their RSVP phone number and shows their pass', async () => {
    const { id } = await rsvp('Ananya Sharma', '+91 98100 11002');
    const guest = request.agent(getApp());
    await guest.get('/api/guest/me').expect(401);
    expect((await guest.get('/api/guest/session').expect(200)).body).toEqual({ signedIn: false });
    const missing = await guest.post('/api/guest/login').send({ phone: '+91 99999 99999' }).expect(404);
    expect(missing.body.error.message).toMatch(/couldn’t find an RSVP/);

    const portal = await guest.post('/api/guest/login').send({ phone: '098100 11002' }).expect(200);
    expect(portal.body).toMatchObject({ rsvpId: id, guestName: 'Ananya Sharma', numberOfGuests: 3, rooms: [], portraitsAvailable: false });
    expect(portal.body.qrUrl).toMatch(/^http:\/\/localhost:3000\/q\/[0-9a-f-]{36}$/);
    expect(portal.body.events.map((e: { name: string }) => e.name)).toEqual(['Sangeet', 'Jaimal & Phere']);
    await guest.get('/api/guest/me').expect(200);
    expect((await guest.get('/api/guest/session').expect(200)).body).toEqual({ signedIn: true });
    await guest.post('/api/guest/logout').expect(200);
    await guest.get('/api/guest/me').expect(401);
  });

  it('is signed in automatically after submitting an RSVP', async () => {
    const { agent } = await rsvp('Kabir Singh', '+91 98100 11010');
    const me = await agent.get('/api/guest/me').expect(200);
    expect(me.body.guestName).toBe('Kabir Singh');
  });

  it('shows the allotted room once hospitality assigns it', async () => {
    const { id, agent: guest } = await rsvp('Ananya Sharma', '+91 98100 11002');
    const hosp = await addStaff('HOSPITALITY');
    const hotel = await hosp.agent.post('/api/admin/accommodations').set('X-CSRF-Token', hosp.csrf).send({ name: 'Hotel One' }).expect(201);
    await hosp.agent.post('/api/admin/rooms').set('X-CSRF-Token', hosp.csrf).send({ rsvpId: id, accommodationId: hotel.body.id, roomNumber: '204' }).expect(201);
    const me = await guest.get('/api/guest/me').expect(200);
    expect(me.body.rooms).toEqual([expect.objectContaining({ accommodationName: 'Hotel One', roomNumber: '204' })]);
  });

  it('records the journey; asking for a pickup puts it on the hospitality list', async () => {
    const { id, agent: guest } = await rsvp('Ananya Sharma', '+91 98100 11002');
    await guest
      .put('/api/guest/travel')
      .send({ arrivalMode: 'TRAIN', arrivalAt: at('2026-12-02T14:35').toISOString(), arrivalDetails: '12034 Shatabdi', pickupNeeded: true, dropNeeded: false })
      .expect(200);
    const hosp = await addStaff('HOSPITALITY');
    const rows = (await hosp.agent.get('/api/admin/arrivals?needsTransport=true').expect(200)).body;
    expect(rows).toEqual([expect.objectContaining({ rsvpId: id, arrivalMode: 'TRAIN', pickupNeeded: true, pickupStatus: 'PENDING', arrivalDetails: '12034 Shatabdi' })]);

    await hosp.agent
      .put(`/api/admin/arrivals/${id}`)
      .set('X-CSRF-Token', hosp.csrf)
      .send({ ...rows[0], pickupStatus: 'ASSIGNED', transportNotes: 'Driver Ramesh' })
      .expect(200);
    const after = (await hosp.agent.get('/api/admin/arrivals').expect(200)).body[0];
    expect(after).toMatchObject({ pickupStatus: 'ASSIGNED', transportNotes: 'Driver Ramesh' });
    // Guests don't see internal notes.
    expect((await guest.get('/api/guest/me')).body.travel.transportNotes).toBeUndefined();
  });

  it('shared album: guest photos stay hidden until approved', async () => {
    const { agent: guest } = await rsvp('Ananya Sharma', '+91 98100 11002');
    const up = await guest.post('/api/guest/photos').attach('files', await makePng(), { filename: 'us.png', contentType: 'image/png' }).expect(201);
    expect(up.body.results).toEqual([expect.objectContaining({ ok: true })]);
    const me = await guest.get('/api/guest/me').expect(200);
    expect(me.body.uploads).toEqual([expect.objectContaining({ status: 'PENDING' })]);
    expect((await request(getApp()).get('/api/gallery').expect(200)).body.total).toBe(0);

    const { agent, csrf } = await login();
    await agent.patch(`/api/admin/media/${me.body.uploads[0].id}`).set('X-CSRF-Token', csrf).send({ isPublished: true }).expect(200);
    expect((await request(getApp()).get('/api/gallery?album=guest-moments').expect(200)).body.total).toBe(1);
    expect((await guest.get('/api/guest/me')).body.uploads[0].status).toBe('APPROVED');
  });
});

describe('check-in (coordinators)', () => {
  it('checks a family in by QR, shows who has arrived and who needs a call', async () => {
    const a = await rsvp('Ananya Sharma', '+91 98100 11002');
    await rsvp('Kabir Singh', '+91 98100 11010', [eventIds[2]!], 5);
    const qrUrl = (await a.agent.get('/api/guest/me')).body.qrUrl as string;
    const coord = await addStaff('COORDINATOR');

    // Scanned URL resolves to the guest card.
    const card = await coord.agent.get(`/api/admin/pass/${encodeURIComponent(qrUrl.split('/q/')[1]!)}`).expect(200);
    expect(card.body).toMatchObject({ guestName: 'Ananya Sharma', numberOfGuests: 3 });

    let board = (await coord.agent.get(`/api/admin/checkin?eventId=${eventIds[2]}`).expect(200)).body;
    expect(board).toMatchObject({ expectedParties: 2, expectedGuests: 8, arrivedParties: 0 });

    await coord.agent.post('/api/admin/checkin').set('X-CSRF-Token', coord.csrf).send({ token: qrUrl, eventId: eventIds[2], count: 2, method: 'QR' }).expect(200);
    const kabir = board.rows.find((r: { guestName: string }) => r.guestName === 'Kabir Singh');
    await coord.agent.put('/api/admin/followup').set('X-CSRF-Token', coord.csrf).send({ rsvpId: kabir.rsvpId, eventId: eventIds[2], status: 'ON_THE_WAY', note: '10 min away' }).expect(200);

    board = (await coord.agent.get(`/api/admin/checkin?eventId=${eventIds[2]}`).expect(200)).body;
    expect(board).toMatchObject({ arrivedParties: 1, arrivedGuests: 2 });
    const ananya = board.rows.find((r: { guestName: string }) => r.guestName === 'Ananya Sharma');
    expect(ananya.checkIn).toMatchObject({ count: 2, method: 'QR', by: 'COORDINATOR person' });
    expect(board.rows.find((r: { guestName: string }) => r.guestName === 'Kabir Singh').followUp).toMatchObject({ status: 'ON_THE_WAY', note: '10 min away' });

    // Guest sees they're checked in.
    expect((await a.agent.get('/api/guest/me')).body.events.find((e: { id: string }) => e.id === eventIds[2]).checkedIn).toBe(2);

    await coord.agent.delete(`/api/admin/checkin/${ananya.rsvpId}/${eventIds[2]}`).set('X-CSRF-Token', coord.csrf).expect(204);
    expect((await coord.agent.get(`/api/admin/checkin?eventId=${eventIds[2]}`)).body.arrivedParties).toBe(0);
    await coord.agent.get('/api/admin/pass/not-a-real-token').expect(404);
  });
});

describe('photo of the day (photographer)', () => {
  it('tracks coverage per day and shows photos to guests only after the wedding', async () => {
    const a = await rsvp('Ananya Sharma', '+91 98100 11002', [eventIds[2]!]); // 3 Dec
    const b = await rsvp('Kabir Singh', '+91 98100 11010', [eventIds[1]!, eventIds[5]!]); // 3 & 4 Dec
    const qrUrl = (await a.agent.get('/api/guest/me')).body.qrUrl as string;
    const photo = await addStaff('PHOTOGRAPHER');

    let board = (await photo.agent.get('/api/admin/portraits?day=2026-12-03').expect(200)).body;
    expect(board.days.map((d: { day: string }) => d.day)).toEqual(['2026-10-20', '2026-12-03', '2026-12-04']);
    expect(board).toMatchObject({ day: '2026-12-03', covered: 0, total: 2 });

    // Scan QR + photo, and a manual tick for the other family.
    await photo.agent
      .post('/api/admin/portraits')
      .set('X-CSRF-Token', photo.csrf)
      .field('token', qrUrl)
      .field('day', '2026-12-03')
      .field('method', 'QR')
      .attach('photo', await makePng(1200, 900), { filename: 'family.png', contentType: 'image/png' })
      .expect(200);
    await photo.agent.post('/api/admin/portraits').set('X-CSRF-Token', photo.csrf).field('rsvpId', b.id).field('day', '2026-12-03').expect(200);
    await photo.agent.post('/api/admin/portraits').set('X-CSRF-Token', photo.csrf).field('rsvpId', b.id).field('day', '2026-09-25').expect(400);

    board = (await photo.agent.get('/api/admin/portraits?day=2026-12-03').expect(200)).body;
    expect(board).toMatchObject({ covered: 2, total: 2 });
    expect(board.rows.find((r: { rsvpId: string }) => r.rsvpId === a.id).portrait).toMatchObject({ method: 'QR', by: 'PHOTOGRAPHER person' });
    expect((await photo.agent.get('/api/admin/portraits?day=2026-12-04')).body).toMatchObject({ covered: 0, total: 1 });

    // Portraits are private: not in the public gallery, hidden from the guest until after the wedding.
    expect((await request(getApp()).get('/api/gallery').expect(200)).body.total).toBe(0);
    expect((await a.agent.get('/api/guest/me')).body).toMatchObject({ portraitsAvailable: false, portraits: [] });
    const after = (await a.agent.get(`/api/guest/me?now=${at('2026-12-06T10:00').toISOString()}`)).body;
    expect(after.portraitsAvailable).toBe(true);
    expect(after.portraits).toEqual([expect.objectContaining({ day: '2026-12-03' })]);
    expect(after.portraits[0].media.urls.medium).toContain('/wedding/portraits/');
  });
});

describe('push notifications', () => {
  afterEach(() => vi.restoreAllMocks());

  it('serves a VAPID key, stores subscriptions and notifies on new live posts', async () => {
    const key = (await request(getApp()).get('/api/push/public-key').expect(200)).body.publicKey;
    expect(key).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    // Stable across calls (persisted).
    expect((await request(getApp()).get('/api/push/public-key')).body.publicKey).toBe(key);

    const sub = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
    await request(getApp()).post('/api/push/subscribe').send(sub).expect(201);
    await request(getApp()).post('/api/push/subscribe').send(sub).expect(201); // idempotent
    expect(await prisma.pushSubscription.count()).toBe(1);

    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    const listeners = broker.listenerCount('message');
    pushService.start();
    try {
      const { agent, csrf } = await login();
      await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ eventId: eventIds[2], content: 'The baraat is leaving!', action: 'publish' }).expect(201);
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1), { timeout: 3000 });
      const payload = JSON.parse(send.mock.calls[0]![1] as string);
      expect(payload).toMatchObject({ title: 'Sangeet · Live', body: 'The baraat is leaving!', url: '/now' });

      // Gone subscriptions are cleaned up.
      send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
      await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ content: 'Second post', action: 'publish' }).expect(201);
      await vi.waitFor(async () => expect(await prisma.pushSubscription.count()).toBe(0), { timeout: 3000 });
    } finally {
      broker.removeAllListeners('message');
      expect(listeners).toBe(0);
    }
  });
});
