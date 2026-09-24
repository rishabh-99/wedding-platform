import webpush from 'web-push';
import type { RealtimeMessage, pushSubscriptionSchema } from '@wedding/shared';
import type { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { broker } from '../realtime/sseBroker';

/**
 * Web Push notifications for live updates ("The baraat is leaving!").
 * Standards-based (VAPID) — no third-party account needed. Keys come from
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY if set, otherwise they are generated
 * once and stored in the database so existing subscriptions keep working.
 */

let keys: { publicKey: string; privateKey: string } | null = null;

async function vapidKeys() {
  if (keys) return keys;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  } else {
    const stored = await prisma.keyValue.findUnique({ where: { key: 'vapid' } });
    if (stored) keys = JSON.parse(stored.value) as { publicKey: string; privateKey: string };
    else {
      const generated = webpush.generateVAPIDKeys();
      // create-or-keep: if two processes race, the first write wins and both use it.
      const row = await prisma.keyValue.upsert({
        where: { key: 'vapid' },
        create: { key: 'vapid', value: JSON.stringify(generated) },
        update: {},
      });
      keys = JSON.parse(row.value) as { publicKey: string; privateKey: string };
    }
  }
  const subject = env.VAPID_SUBJECT ?? (env.PUBLIC_URL.startsWith('https://') ? env.PUBLIC_URL : 'mailto:hello@example.com');
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return keys;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export const pushService = {
  async publicKey(): Promise<string> {
    return (await vapidKeys()).publicKey;
  },

  async subscribe(sub: z.output<typeof pushSubscriptionSchema>, rsvpId: string | null, userAgent?: string) {
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, rsvpId, userAgent: userAgent?.slice(0, 300) ?? null },
      update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, ...(rsvpId ? { rsvpId } : {}) },
    });
  },

  async unsubscribe(endpoint: string) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  },

  async count() {
    return prisma.pushSubscription.count();
  },

  /** Sends to every subscriber; removes subscriptions the push service reports as gone. */
  async broadcast(payload: PushPayload): Promise<{ sent: number; removed: number }> {
    await vapidKeys();
    const subs = await prisma.pushSubscription.findMany();
    let sent = 0;
    let removed = 0;
    const body = JSON.stringify(payload);
    const queue = [...subs];
    const worker = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600, urgency: 'high' });
          sent++;
          await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: new Date() } }).catch(() => undefined);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            removed++;
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          } else {
            logger.warn({ status, endpoint: s.endpoint.slice(0, 60) }, 'push send failed');
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(10, subs.length) }, worker));
    return { sent, removed };
  },

  /** Hooks live-update broadcasts (including scheduled posts) to push notifications. */
  start() {
    broker.on('message', (msg: RealtimeMessage) => {
      if (msg.type !== 'LIVE_UPDATE_CREATED' || !msg.postId) return;
      void (async () => {
        const post = await prisma.liveUpdate.findUnique({ where: { id: msg.postId! }, include: { event: { select: { name: true } } } });
        if (!post?.published) return;
        const title = post.title ?? (post.event ? `${post.event.name} · Live` : 'Live from the celebrations');
        const body = post.content.length > 140 ? `${post.content.slice(0, 137)}…` : post.content;
        const result = await this.broadcast({ title, body, url: '/now', tag: post.id });
        logger.info({ postId: post.id, ...result }, 'push notifications sent');
      })().catch((err) => logger.error({ err }, 'push broadcast failed'));
    });
  },
};
