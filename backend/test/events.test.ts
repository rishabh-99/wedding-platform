import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { at, getApp, login, resetDb, seedEvents, seedUsers } from './helpers';

describe('events API', () => {
  let events: Awaited<ReturnType<typeof seedEvents>>['events'];

  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    ({ events } = await seedEvents());
  });

  it('lists published events chronologically with venues', async () => {
    await prisma.event.update({ where: { id: events[1]!.id }, data: { isPublished: false } });
    const res = await request(getApp()).get('/api/events').expect(200);
    expect(res.body.map((e: { slug: string }) => e.slug)).toEqual(['engagement', 'sangeet', 'sehra-bandhi', 'baraat', 'jaimal-phere']);
    expect(res.body[0].venue.mapsUrl).toBe('https://share.google/WNdAo3dcJVuN6znho');
    expect(res.body[0].startDateTime).toBe('2026-10-20T05:30:00.000Z');
  });

  it('returns event detail by slug and 404 for unpublished/unknown', async () => {
    const res = await request(getApp()).get('/api/events/sangeet').expect(200);
    expect(res.body.name).toBe('Sangeet');
    await prisma.event.update({ where: { id: events[2]!.id }, data: { isPublished: false } });
    await request(getApp()).get('/api/events/sangeet').expect(404);
    await request(getApp()).get('/api/events/nope').expect(404);
  });

  it('computes what is happening now from the database schedule', async () => {
    const before = await request(getApp()).get(`/api/schedule?now=${at('2026-09-24T10:00').toISOString()}`).expect(200);
    expect(before.body.phase).toBe('pre');
    expect(before.body.next.slug).toBe('engagement');

    const live = await request(getApp()).get(`/api/schedule?now=${at('2026-12-03T21:18').toISOString()}`).expect(200);
    expect(live.body).toMatchObject({ phase: 'live', isLiveMode: true });
    expect(live.body.current.slug).toBe('sangeet');
    expect(live.body.previous.slug).toBe('haldi-mehendi');
    expect(live.body.next.slug).toBe('sehra-bandhi');

    const archive = await request(getApp()).get(`/api/schedule?now=${at('2026-12-06T10:00').toISOString()}`).expect(200);
    expect(archive.body.phase).toBe('archive');
  });

  it('respects schedule edits immediately (nothing hardcoded)', async () => {
    const { agent, csrf } = await login();
    const created = await agent
      .post('/api/admin/events')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Welcome Dinner', slug: 'welcome-dinner', startDateTime: at('2026-12-02T20:00').toISOString(), displayOrder: 0 })
      .expect(201);
    const schedule = await request(getApp()).get(`/api/schedule?now=${at('2026-11-30T10:00').toISOString()}`).expect(200);
    expect(schedule.body.next.id).toBe(created.body.id);
  });

  it('serves ICS calendars for one event and the whole itinerary', async () => {
    const one = await request(getApp()).get('/api/events/sangeet/calendar.ics').expect(200);
    expect(one.headers['content-type']).toContain('text/calendar');
    expect(one.text).toContain('BEGIN:VEVENT');
    expect(one.text).toContain('DTSTART:20261203T153000Z');
    expect(one.text).toContain('LOCATION:Status Club Kanpur');
    const all = await request(getApp()).get('/api/events/calendar.ics').expect(200);
    expect(all.text.match(/BEGIN:VEVENT/g)).toHaveLength(6);
  });

  it('admin can create, update, publish, reorder and delete', async () => {
    const { agent, csrf } = await login();
    const updated = await agent
      .put(`/api/admin/events/${events[0]!.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Ring Ceremony', slug: 'engagement', startDateTime: at('2026-10-20T11:30').toISOString(), dressCode: 'Pastels', displayOrder: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Ring Ceremony', dressCode: 'Pastels' });

    await agent.patch(`/api/admin/events/${events[0]!.id}/publish`).set('X-CSRF-Token', csrf).send({ isPublished: false }).expect(200);
    expect((await request(getApp()).get('/api/events')).body).toHaveLength(5);

    const reversed = [...events].reverse().map((e) => e.id);
    await agent.post('/api/admin/events/reorder').set('X-CSRF-Token', csrf).send({ ids: reversed }).expect(200);
    const list = await agent.get('/api/admin/events').expect(200);
    expect(list.body[0].id).toBe(reversed[0]);

    await agent.delete(`/api/admin/events/${events[5]!.id}`).set('X-CSRF-Token', csrf).expect(204);
    expect(await prisma.event.count()).toBe(5);
  });

  it('validates event input and rejects duplicate slugs', async () => {
    const { agent, csrf } = await login();
    const bad = await agent.post('/api/admin/events').set('X-CSRF-Token', csrf).send({ name: 'X', slug: 'Bad Slug!', startDateTime: 'not a date' }).expect(400);
    expect(Object.keys(bad.body.error.details.fields)).toEqual(expect.arrayContaining(['slug', 'startDateTime']));
    await agent
      .post('/api/admin/events')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Sangeet again', slug: 'sangeet', startDateTime: at('2026-12-03T21:00').toISOString() })
      .expect(409);
    const endBeforeStart = await agent
      .post('/api/admin/events')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Brunch', slug: 'brunch', startDateTime: at('2026-12-05T11:00').toISOString(), endDateTime: at('2026-12-05T10:00').toISOString() })
      .expect(400);
    expect(endBeforeStart.body.error.details.fields.endDateTime).toBeDefined();
  });

  it('never exposes stack traces or internals to guests', async () => {
    const res = await request(getApp()).get('/api/does-not-exist').expect(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(/);
    const settings = await request(getApp()).get('/api/settings').expect(200);
    const json = JSON.stringify(settings.body);
    expect(json).not.toMatch(/DATABASE_URL|JWT_SECRET|S3_BUCKET|password/i);
  });
});
