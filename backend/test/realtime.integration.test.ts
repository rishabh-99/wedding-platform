import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LiveUpdateDTO, RealtimeMessage } from '@wedding/shared';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { broker } from '../src/realtime/sseBroker';
import { ADMIN, resetDb, seedEvents, seedUsers } from './helpers';

/**
 * End-to-end realtime flow over real HTTP:
 *   guest opens SSE stream → admin publishes a live post → DB row written →
 *   SSE event received by the guest → guest fetches and renders the new post.
 */
describe('realtime integration: admin post → SSE → guest', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    await resetDb();
    await seedUsers();
    await seedEvents();
    server = http.createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    broker.close();
    await new Promise((r) => server.close(r));
  });

  /** Minimal SSE client over fetch streaming. */
  async function openStream(url: string, headers: Record<string, string> = {}) {
    const controller = new AbortController();
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/event-stream', ...headers } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const events: { event: string; id?: string; data: string }[] = [];
    const waiters: (() => void)[] = [];
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const ev = { event: 'message', data: '' } as { event: string; id?: string; data: string };
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) ev.event = line.slice(6).trim();
              else if (line.startsWith('data:')) ev.data += line.slice(5).trim();
              else if (line.startsWith('id:')) ev.id = line.slice(3).trim();
            }
            if (ev.data) {
              events.push(ev);
              waiters.splice(0).forEach((w) => w());
            }
          }
        }
      } catch {
        /* aborted */
      }
    })();
    const waitFor = async (predicate: (e: { event: string; data: string }) => boolean, timeoutMs = 5000) => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = events.find(predicate);
        if (found) return found;
        if (Date.now() > deadline) throw new Error(`Timed out waiting for SSE event; got ${JSON.stringify(events)}`);
        await new Promise<void>((r) => {
          waiters.push(r);
          setTimeout(r, 100);
        });
      }
    };
    return { events, waitFor, close: () => controller.abort() };
  }

  it('delivers a newly published post to a connected guest without refresh', async () => {
    const guest = await openStream(`${base}/api/live/stream`);
    await guest.waitFor((e) => e.event === 'hello');

    // Admin signs in and publishes.
    const loginRes = await fetch(`${base}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN),
    });
    expect(loginRes.status).toBe(200);
    const { csrfToken } = (await loginRes.json()) as { csrfToken: string };
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!;
    const sangeet = await prisma.event.findUniqueOrThrow({ where: { slug: 'sangeet' } });

    const postRes = await fetch(`${base}/api/admin/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ eventId: sangeet.id, content: 'The dance floor is officially open!', action: 'publish' }),
    });
    expect(postRes.status).toBe(201);
    const post = (await postRes.json()) as LiveUpdateDTO;

    // Database updated.
    const row = await prisma.liveUpdate.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.published).toBe(true);

    // SSE event emitted and received.
    const ev = await guest.waitFor((e) => e.event === 'message' && (JSON.parse(e.data) as RealtimeMessage).postId === post.id);
    const msg = JSON.parse(ev.data) as RealtimeMessage;
    expect(msg).toMatchObject({ type: 'LIVE_UPDATE_CREATED', eventId: sangeet.id, postId: post.id });
    expect(msg.timestamp).toEqual(expect.any(String));

    // Guest fetches the content it was told about.
    const fetched = (await (await fetch(`${base}/api/live/${msg.postId}`)).json()) as LiveUpdateDTO;
    expect(fetched.content).toBe('The dance floor is officially open!');
    expect(fetched.event?.name).toBe('Sangeet');
    guest.close();
  });

  it('replays missed messages after a reconnect (Last-Event-ID)', async () => {
    const first = broker.publish('SCHEDULE_CHANGED');
    const missed = broker.publish('MEDIA_PUBLISHED');
    const guest = await openStream(`${base}/api/live/stream`, { 'Last-Event-ID': String(first.id) });
    const ev = await guest.waitFor((e) => e.event === 'message');
    expect(JSON.parse(ev.data)).toMatchObject({ id: missed.id, type: 'MEDIA_PUBLISHED' });
    guest.close();
  });
});
