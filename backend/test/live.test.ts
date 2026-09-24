import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { broker } from '../src/realtime/sseBroker';
import { liveUpdateService } from '../src/services/liveUpdate.service';
import type { RealtimeMessage } from '@wedding/shared';
import { getApp, login, makePng, resetDb, seedEvents, seedUsers } from './helpers';

function captureBroadcasts() {
  const messages: RealtimeMessage[] = [];
  const listener = (m: RealtimeMessage) => messages.push(m);
  broker.on('message', listener);
  return { messages, stop: () => broker.off('message', listener) };
}

describe('live updates', () => {
  let sangeetId: string;

  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    sangeetId = (await seedEvents()).events[2]!.id;
  });

  it('publishes immediately, persists and broadcasts LIVE_UPDATE_CREATED', async () => {
    const { agent, csrf } = await login();
    const cap = captureBroadcasts();
    const res = await agent
      .post('/api/admin/live')
      .set('X-CSRF-Token', csrf)
      .send({ eventId: sangeetId, content: 'The dance floor is officially open!', action: 'publish' })
      .expect(201);
    cap.stop();
    expect(res.body).toMatchObject({ status: 'PUBLISHED', published: true, event: { slug: 'sangeet' } });
    expect(await prisma.liveUpdate.count({ where: { published: true } })).toBe(1);
    expect(cap.messages).toEqual([expect.objectContaining({ type: 'LIVE_UPDATE_CREATED', postId: res.body.id, eventId: sangeetId })]);

    const feed = await request(getApp()).get('/api/live').expect(200);
    expect(feed.body[0].content).toBe('The dance floor is officially open!');
    const byEvent = await request(getApp()).get(`/api/live?eventId=${sangeetId}`).expect(200);
    expect(byEvent.body).toHaveLength(1);
  });

  it('keeps drafts private and does not broadcast them', async () => {
    const { agent, csrf } = await login();
    const cap = captureBroadcasts();
    const res = await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ content: 'Secret draft', action: 'draft' }).expect(201);
    cap.stop();
    expect(res.body.status).toBe('DRAFT');
    expect(cap.messages).toHaveLength(0);
    expect((await request(getApp()).get('/api/live')).body).toHaveLength(0);
    await request(getApp()).get(`/api/live/${res.body.id}`).expect(404);
  });

  it('schedules posts and publishes them when due', async () => {
    const { agent, csrf } = await login();
    const when = new Date(Date.now() + 60 * 60_000).toISOString();
    const res = await agent
      .post('/api/admin/live')
      .set('X-CSRF-Token', csrf)
      .send({ content: 'Lunch is served', action: 'schedule', scheduledFor: when })
      .expect(201);
    expect(res.body.status).toBe('SCHEDULED');
    expect(await liveUpdateService.publishDue(new Date())).toBe(0);

    const cap = captureBroadcasts();
    expect(await liveUpdateService.publishDue(new Date(Date.now() + 2 * 60 * 60_000))).toBe(1);
    cap.stop();
    const row = await prisma.liveUpdate.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.published).toBe(true);
    expect(row.publishedAt?.toISOString()).toBe(when);
    expect(cap.messages[0]).toMatchObject({ type: 'LIVE_UPDATE_CREATED', postId: res.body.id });
    // Running again must not double-publish.
    expect(await liveUpdateService.publishDue(new Date(Date.now() + 3 * 60 * 60_000))).toBe(0);
  });

  it('requires a schedule time when scheduling', async () => {
    const { agent, csrf } = await login();
    const res = await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ content: 'x', action: 'schedule' }).expect(400);
    expect(res.body.error.details.fields.scheduledFor).toBeDefined();
  });

  it('edits, unpublishes and deletes with matching broadcasts', async () => {
    const { agent, csrf } = await login();
    const created = await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ content: 'First', action: 'publish' }).expect(201);
    const cap = captureBroadcasts();
    await agent.put(`/api/admin/live/${created.body.id}`).set('X-CSRF-Token', csrf).send({ content: 'Edited', action: 'publish' }).expect(200);
    await agent.patch(`/api/admin/live/${created.body.id}/publish`).set('X-CSRF-Token', csrf).send({ isPublished: false }).expect(200);
    await agent.patch(`/api/admin/live/${created.body.id}/publish`).set('X-CSRF-Token', csrf).send({ isPublished: true }).expect(200);
    await agent.delete(`/api/admin/live/${created.body.id}`).set('X-CSRF-Token', csrf).expect(204);
    cap.stop();
    expect(cap.messages.map((m) => m.type)).toEqual(['LIVE_UPDATE_UPDATED', 'LIVE_UPDATE_DELETED', 'LIVE_UPDATE_CREATED', 'LIVE_UPDATE_DELETED']);
  });

  it('attaches media and infers the PHOTO type', async () => {
    const { agent, csrf } = await login();
    const up = await agent
      .post('/api/admin/media')
      .set('X-CSRF-Token', csrf)
      .field('purpose', 'LIVE')
      .attach('files', await makePng(), { filename: 'moment.png', contentType: 'image/png' })
      .expect(201);
    const mediaId = up.body.results[0].media.id;
    const post = await agent.post('/api/admin/live').set('X-CSRF-Token', csrf).send({ content: 'A moment', mediaAssetId: mediaId }).expect(201);
    expect(post.body.type).toBe('PHOTO');
    expect(post.body.media.urls.medium).toContain('/media/wedding/live/');
  });
});
