import type { Request, Response } from 'express';
import { guestbookInputSchema, rsvpInputSchema } from '@wedding/shared';
import { env } from '../config/env';
import { badRequest, parse } from '../lib/errors';
import { contactsService } from '../services/contacts.service';
import { eventService } from '../services/event.service';
import { faqService, storyService, travelService, venueService } from '../services/content.service';
import { galleryService } from '../services/gallery.service';
import { guestbookService } from '../services/guestbook.service';
import { liveUpdateService } from '../services/liveUpdate.service';
import { rsvpService } from '../services/rsvp.service';
import { settingsService } from '../services/settings.service';

const cacheShort = (res: Response, seconds = 15) =>
  res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`);

function parseNow(req: Request): Date {
  const raw = req.query.now;
  if (env.timeTravelEnabled && typeof raw === 'string' && raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

async function requireSection(key: keyof Awaited<ReturnType<typeof settingsService.get>>['sections']) {
  const s = await settingsService.get();
  if (!s.sections[key]) throw badRequest('This section is currently closed');
}

export const publicController = {
  async settings(_req: Request, res: Response) {
    cacheShort(res, 30);
    res.json(await settingsService.get());
  },

  async schedule(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await eventService.schedule(parseNow(req)));
  },

  async events(_req: Request, res: Response) {
    cacheShort(res);
    res.json(await eventService.listPublic());
  },

  async event(req: Request, res: Response) {
    cacheShort(res);
    res.json(await eventService.getPublicBySlug(req.params.slug!));
  },

  async eventIcs(req: Request, res: Response) {
    const { filename, body } = await eventService.ics(req.params.slug);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  },

  async venues(_req: Request, res: Response) {
    cacheShort(res, 60);
    res.json(await venueService.list());
  },

  async live(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const since = typeof req.query.since === 'string' && req.query.since ? new Date(req.query.since) : undefined;
    const before = typeof req.query.before === 'string' && req.query.before ? new Date(req.query.before) : undefined;
    res.json(
      await liveUpdateService.listPublic({
        eventId: typeof req.query.eventId === 'string' ? req.query.eventId : undefined,
        since: since && !Number.isNaN(since.getTime()) ? since : undefined,
        before: before && !Number.isNaN(before.getTime()) ? before : undefined,
        limit: req.query.limit ? Number(req.query.limit) || 50 : 50,
      }),
    );
  },

  async liveOne(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await liveUpdateService.getPublic(req.params.id!));
  },

  async albums(_req: Request, res: Response) {
    cacheShort(res, 30);
    res.json(await galleryService.listAlbums());
  },

  async gallery(req: Request, res: Response) {
    cacheShort(res, 15);
    const q = req.query;
    res.json(
      await galleryService.listMedia({
        album: typeof q.album === 'string' && q.album ? q.album : undefined,
        eventId: typeof q.eventId === 'string' && q.eventId ? q.eventId : undefined,
        type: q.type === 'IMAGE' || q.type === 'VIDEO' ? q.type : undefined,
        page: Number(q.page) || 1,
        pageSize: Number(q.pageSize) || 40,
      }),
    );
  },

  async submitRsvp(req: Request, res: Response) {
    await requireSection('rsvp');
    const input = parse(rsvpInputSchema, req.body);
    if (input.website) {
      // Honeypot filled in: pretend success, store nothing.
      return res.status(201).json({ id: 'ok', updated: false, guestName: input.guestName, attendanceStatus: input.attendanceStatus });
    }
    const result = await rsvpService.submit(input);
    res.status(result.updated ? 200 : 201).json(result);
  },

  async guestbook(req: Request, res: Response) {
    cacheShort(res, 20);
    res.json(await guestbookService.listApproved(Number(req.query.page) || 1));
  },

  async submitGuestbook(req: Request, res: Response) {
    await requireSection('guestbook');
    const input = parse(guestbookInputSchema, req.body);
    if (input.website) return res.status(201).json({ ok: true });
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const created = await guestbookService.submit(input, file);
    res.status(201).json({ id: created.id, status: created.status });
  },

  async story(_req: Request, res: Response) {
    cacheShort(res, 60);
    res.json(await storyService.list());
  },

  async travel(_req: Request, res: Response) {
    cacheShort(res, 60);
    res.json(await travelService.list());
  },

  async faq(_req: Request, res: Response) {
    cacheShort(res, 60);
    res.json(await faqService.list());
  },

  async contacts(_req: Request, res: Response) {
    cacheShort(res, 60);
    res.json(await contactsService.list());
  },
};
