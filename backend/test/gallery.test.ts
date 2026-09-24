import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { storage } from '../src/storage';
import { getApp, login, makePng, resetDb, seedEvents, seedUsers } from './helpers';

describe('gallery & media uploads', () => {
  let albumId: string;

  beforeEach(async () => {
    await resetDb();
    await seedUsers();
    const { events } = await seedEvents();
    albumId = (await prisma.album.create({ data: { name: 'Sangeet', slug: 'sangeet', eventId: events[2]!.id } })).id;
  });

  it('uploads an image, preserves the original and generates optimised renditions', async () => {
    const { agent, csrf } = await login();
    const png = await makePng(2400, 1600);
    const res = await agent
      .post('/api/admin/media')
      .set('X-CSRF-Token', csrf)
      .field('purpose', 'GALLERY')
      .field('albumId', albumId)
      .field('caption', 'The dance floor')
      .attach('files', png, { filename: 'dance.png', contentType: 'image/png' })
      .expect(201);
    const result = res.body.results[0];
    expect(result.ok).toBe(true);
    expect(result.media).toMatchObject({ type: 'IMAGE', width: 2400, height: 1600, caption: 'The dance floor', mimeType: 'image/png' });
    expect(result.media.placeholder).toMatch(/^data:image\/webp;base64,/);

    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: result.media.id } });
    expect(asset.storageKey).toMatch(/^wedding\/gallery\/sangeet\/[0-9a-f-]+\/original\.png$/);
    const variants = asset.variants as { thumb: { key: string; width: number }; medium: { key: string; width: number } };
    expect(variants.thumb.width).toBe(640);
    expect(variants.medium.width).toBe(1800);
    for (const key of [asset.storageKey, variants.thumb.key, variants.medium.key]) {
      expect(await storage().exists(key)).toBe(true);
    }
    // Guests get the thumbnail/medium URLs, never just the original.
    expect(result.media.urls.thumb).toContain('thumb.webp');
    expect(result.media.urls.medium).toContain('medium.webp');
  });

  it('rejects executables disguised as images (magic-byte check)', async () => {
    const { agent, csrf } = await login();
    const fakeExe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 0x90)]);
    const res = await agent
      .post('/api/admin/media')
      .set('X-CSRF-Token', csrf)
      .field('purpose', 'GALLERY')
      .attach('files', fakeExe, { filename: 'holiday.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(res.body.results[0]).toMatchObject({ ok: false });
    expect(await prisma.mediaAsset.count()).toBe(0);
  });

  it('rejects disallowed extensions outright', async () => {
    const { agent, csrf } = await login();
    const res = await agent
      .post('/api/admin/media')
      .set('X-CSRF-Token', csrf)
      .attach('files', Buffer.from('#!/bin/sh\nrm -rf /'), { filename: 'script.sh', contentType: 'text/x-sh' });
    expect(res.status).toBe(415);
  });

  it('rejects images that are too small', async () => {
    const { agent, csrf } = await login();
    const tiny = await makePng(50, 50);
    const res = await agent.post('/api/admin/media').set('X-CSRF-Token', csrf).attach('files', tiny, { filename: 'tiny.png', contentType: 'image/png' }).expect(400);
    expect(res.body.results[0].error).toMatch(/too small/);
  });

  it('shows published gallery media publicly, filterable by album, and hides unpublished', async () => {
    const { agent, csrf } = await login();
    const up = await agent
      .post('/api/admin/media')
      .set('X-CSRF-Token', csrf)
      .field('albumId', albumId)
      .attach('files', await makePng(), { filename: 'a.png', contentType: 'image/png' })
      .attach('files', await makePng(), { filename: 'b.png', contentType: 'image/png' })
      .expect(201);
    expect(up.body.results).toHaveLength(2);

    const albums = await request(getApp()).get('/api/albums').expect(200);
    expect(albums.body[0]).toMatchObject({ slug: 'sangeet', count: 2 });

    const gallery = await request(getApp()).get('/api/gallery?album=sangeet').expect(200);
    expect(gallery.body.total).toBe(2);
    expect(gallery.body.items[0].storageKey).toBeUndefined(); // storage internals are admin-only

    const firstId = up.body.results[0].media.id;
    await agent.patch(`/api/admin/media/${firstId}`).set('X-CSRF-Token', csrf).send({ isPublished: false }).expect(200);
    expect((await request(getApp()).get('/api/gallery').expect(200)).body.total).toBe(1);

    await agent.delete(`/api/admin/media/${firstId}`).set('X-CSRF-Token', csrf).expect(204);
    expect(await prisma.mediaAsset.count()).toBe(1);
  });

  it('serves local media files and never exposes private backups', async () => {
    const { agent, csrf } = await login();
    const up = await agent.post('/api/admin/media').set('X-CSRF-Token', csrf).attach('files', await makePng(), { filename: 'a.png', contentType: 'image/png' }).expect(201);
    const url: string = up.body.results[0].media.urls.thumb;
    const file = await request(getApp()).get(url).expect(200);
    expect(file.headers['content-type']).toContain('image/webp');

    await storage().put('private/backups/secret.sql.gz', Buffer.from('secret'), 'application/gzip');
    await request(getApp()).get('/media/private/backups/secret.sql.gz').expect(404);
    for (const path of ['/media/wedding/../private/backups/secret.sql.gz', '/media/wedding/%2e%2e/private/backups/secret.sql.gz']) {
      const res = await request(getApp()).get(path);
      expect([403, 404]).toContain(res.status);
      expect(res.text).not.toContain('secret');
    }
  });

  it('holds guestbook messages (with photos) for approval', async () => {
    const res = await request(getApp())
      .post('/api/guestbook')
      .field('guestName', 'Nani')
      .field('message', 'All our blessings')
      .attach('photo', await makePng(), { filename: 'us.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.status).toBe('PENDING');
    expect((await request(getApp()).get('/api/guestbook')).body.total).toBe(0);

    const { agent, csrf } = await login();
    await agent.patch(`/api/admin/guestbook/${res.body.id}`).set('X-CSRF-Token', csrf).send({ status: 'APPROVED' }).expect(200);
    const list = await request(getApp()).get('/api/guestbook').expect(200);
    expect(list.body.items[0]).toMatchObject({ guestName: 'Nani', status: 'APPROVED' });
    expect(list.body.items[0].media.type).toBe('IMAGE');
  });
});
