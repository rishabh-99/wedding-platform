import type { Request, Response } from 'express';
import type { MediaPurpose } from '@prisma/client';
import {
  accommodationInputSchema,
  albumInputSchema,
  changePasswordSchema,
  contactInputSchema,
  roomAssignmentInputSchema,
  eventInputSchema,
  faqInputSchema,
  guestbookAdminUpdateSchema,
  liveUpdateInputSchema,
  loginSchema,
  mediaListQuerySchema,
  mediaUpdateSchema,
  reorderSchema,
  rsvpAdminUpdateSchema,
  rsvpListQuerySchema,
  settingsInputSchema,
  storySectionInputSchema,
  travelSectionInputSchema,
  venueInputSchema,
  type LiveUpdateStatus,
} from '@wedding/shared';
import { z } from 'zod';
import { badRequest, parse } from '../lib/errors';
import { broker } from '../realtime/sseBroker';
import { audit } from '../services/audit.service';
import { SESSION_COOKIE, authService } from '../services/auth.service';
import { backupService } from '../services/backup.service';
import { contactsService } from '../services/contacts.service';
import { roomsService } from '../services/rooms.service';
import { faqService, storyService, travelService, venueService } from '../services/content.service';
import { dashboardService } from '../services/dashboard.service';
import { eventService } from '../services/event.service';
import { galleryService } from '../services/gallery.service';
import { guestbookService } from '../services/guestbook.service';
import { liveUpdateService } from '../services/liveUpdate.service';
import { toMediaDTO } from '../services/mappers';
import { mediaService } from '../services/media.service';
import { rsvpService } from '../services/rsvp.service';
import { buildRsvpWorkbook } from '../services/rsvpExport.service';
import { settingsService } from '../services/settings.service';

const id = (req: Request) => req.params.id!;
const publishedBody = z.object({ isPublished: z.boolean() });

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = parse(loginSchema, req.body);
    const { user, token, csrfToken } = await authService.login(email, password);
    res.cookie(SESSION_COOKIE, token, authService.cookieOptions());
    req.user = user;
    audit(req, 'login', 'user', user.id);
    res.json({ user, csrfToken });
  },
  async logout(req: Request, res: Response) {
    const { maxAge: _ignored, ...opts } = authService.cookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
    if (req.user) audit(req, 'logout', 'user', req.user.id);
    res.json({ ok: true });
  },
  async me(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ user: req.user, csrfToken: req.session!.csrf });
  },
  async changePassword(req: Request, res: Response) {
    const input = parse(changePasswordSchema, req.body);
    await authService.changePassword(req.user!.id, input.currentPassword, input.newPassword);
    audit(req, 'change-password', 'user', req.user!.id);
    const { maxAge: _ignored, ...opts } = authService.cookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
    res.json({ ok: true, message: 'Password changed. Please sign in again.' });
  },
};

export const dashboardController = {
  async get(_req: Request, res: Response) {
    res.json(await dashboardService.get());
  },
};

export const eventsAdminController = {
  async list(_req: Request, res: Response) {
    res.json(await eventService.listAdmin());
  },
  async create(req: Request, res: Response) {
    const created = await eventService.create(parse(eventInputSchema, req.body));
    audit(req, 'create', 'event', created.id, { name: created.name });
    res.status(201).json(created);
  },
  async update(req: Request, res: Response) {
    const updated = await eventService.update(id(req), parse(eventInputSchema, req.body));
    audit(req, 'update', 'event', updated.id);
    res.json(updated);
  },
  async publish(req: Request, res: Response) {
    const { isPublished } = parse(publishedBody, req.body);
    const updated = await eventService.setPublished(id(req), isPublished);
    audit(req, isPublished ? 'publish' : 'unpublish', 'event', updated.id);
    res.json(updated);
  },
  async remove(req: Request, res: Response) {
    await eventService.remove(id(req));
    audit(req, 'delete', 'event', id(req));
    res.status(204).end();
  },
  async reorder(req: Request, res: Response) {
    const { ids } = parse(reorderSchema, req.body);
    await eventService.reorder(ids);
    audit(req, 'reorder', 'event');
    res.json({ ok: true });
  },
};

export const venuesAdminController = {
  async list(_req: Request, res: Response) {
    res.json(await venueService.list());
  },
  async create(req: Request, res: Response) {
    const v = await venueService.create(parse(venueInputSchema, req.body));
    audit(req, 'create', 'venue', v.id);
    res.status(201).json(v);
  },
  async update(req: Request, res: Response) {
    const v = await venueService.update(id(req), parse(venueInputSchema, req.body));
    audit(req, 'update', 'venue', v.id);
    res.json(v);
  },
  async remove(req: Request, res: Response) {
    await venueService.remove(id(req));
    audit(req, 'delete', 'venue', id(req));
    res.status(204).end();
  },
};

export const liveAdminController = {
  async list(req: Request, res: Response) {
    const status = ['PUBLISHED', 'SCHEDULED', 'DRAFT'].includes(String(req.query.status))
      ? (req.query.status as LiveUpdateStatus)
      : undefined;
    res.json(await liveUpdateService.listAdmin(status));
  },
  async create(req: Request, res: Response) {
    const post = await liveUpdateService.create(parse(liveUpdateInputSchema, req.body));
    audit(req, 'create', 'live-update', post.id, { status: post.status });
    res.status(201).json(post);
  },
  async update(req: Request, res: Response) {
    const post = await liveUpdateService.update(id(req), parse(liveUpdateInputSchema, req.body));
    audit(req, 'update', 'live-update', post.id, { status: post.status });
    res.json(post);
  },
  async publish(req: Request, res: Response) {
    const { isPublished } = parse(publishedBody, req.body);
    const post = await liveUpdateService.setPublished(id(req), isPublished);
    audit(req, isPublished ? 'publish' : 'unpublish', 'live-update', post.id);
    res.json(post);
  },
  async remove(req: Request, res: Response) {
    await liveUpdateService.remove(id(req));
    audit(req, 'delete', 'live-update', id(req));
    res.status(204).end();
  },
};

const uploadFields = z.object({
  purpose: z.enum(['GALLERY', 'LIVE', 'GUESTBOOK', 'BRANDING', 'DRESSCODE', 'STORY']).default('GALLERY'),
  albumId: z.string().max(64).optional().transform((v) => v || null),
  eventId: z.string().max(64).optional().transform((v) => v || null),
  caption: z.string().max(500).optional().transform((v) => v?.trim() || null),
  isPublished: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? true : v === true || v === 'true')),
});

export const mediaAdminController = {
  async list(req: Request, res: Response) {
    res.json(await mediaService.list(parse(mediaListQuerySchema, req.query)));
  },
  /** Multi-file upload. Each file is validated and processed independently; per-file results are returned. */
  async upload(req: Request, res: Response) {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw badRequest('Choose at least one file to upload');
    const fields = parse(uploadFields, req.body);
    const results = [];
    for (const file of files) {
      try {
        const asset = await mediaService.upload(file, {
          purpose: fields.purpose as MediaPurpose,
          albumId: fields.albumId,
          eventId: fields.eventId,
          caption: fields.caption,
          isPublished: fields.isPublished,
          uploadedById: req.user!.id,
          allowDocument: fields.purpose === 'GALLERY' ? false : true,
        });
        results.push({ ok: true, filename: file.originalname, media: await toMediaDTO(asset, { admin: true }) });
        audit(req, 'upload', 'media', asset.id, { filename: file.originalname, purpose: fields.purpose });
      } catch (err) {
        results.push({ ok: false, filename: file.originalname, error: (err as Error).message });
      }
    }
    const anyOk = results.some((r) => r.ok);
    if (anyOk && fields.purpose === 'GALLERY' && fields.isPublished) {
      broker.publish('MEDIA_PUBLISHED', { eventId: fields.eventId });
    }
    res.status(anyOk ? 201 : 400).json({ results });
  },
  async update(req: Request, res: Response) {
    const m = await mediaService.update(id(req), parse(mediaUpdateSchema, req.body));
    audit(req, 'update', 'media', m.id);
    res.json(m);
  },
  async reorder(req: Request, res: Response) {
    const { ids } = parse(reorderSchema, req.body);
    await mediaService.reorder(ids);
    audit(req, 'reorder', 'media');
    res.json({ ok: true });
  },
  async remove(req: Request, res: Response) {
    await mediaService.remove(id(req));
    audit(req, 'delete', 'media', id(req));
    res.status(204).end();
  },
};

export const albumsAdminController = {
  async list(_req: Request, res: Response) {
    res.json(await galleryService.listAlbums(true));
  },
  async create(req: Request, res: Response) {
    const a = await galleryService.createAlbum(parse(albumInputSchema, req.body));
    audit(req, 'create', 'album', a.id);
    res.status(201).json(a);
  },
  async update(req: Request, res: Response) {
    const a = await galleryService.updateAlbum(id(req), parse(albumInputSchema, req.body));
    audit(req, 'update', 'album', a.id);
    res.json(a);
  },
  async remove(req: Request, res: Response) {
    await galleryService.deleteAlbum(id(req));
    audit(req, 'delete', 'album', id(req));
    res.status(204).end();
  },
  async reorder(req: Request, res: Response) {
    const { ids } = parse(reorderSchema, req.body);
    await galleryService.reorderAlbums(ids);
    audit(req, 'reorder', 'album');
    res.json({ ok: true });
  },
};

export const rsvpAdminController = {
  async list(req: Request, res: Response) {
    res.json(await rsvpService.list(parse(rsvpListQuerySchema, req.query)));
  },
  async update(req: Request, res: Response) {
    const r = await rsvpService.update(id(req), parse(rsvpAdminUpdateSchema, req.body));
    audit(req, 'update', 'rsvp', r.id);
    res.json(r);
  },
  async remove(req: Request, res: Response) {
    await rsvpService.remove(id(req));
    audit(req, 'delete', 'rsvp', id(req));
    res.status(204).end();
  },
  async exportXlsx(req: Request, res: Response) {
    const wb = await buildRsvpWorkbook();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="wedding-rsvps-${date}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    audit(req, 'export', 'rsvp');
    await wb.xlsx.write(res);
    res.end();
  },
};

export const guestbookAdminController = {
  async list(req: Request, res: Response) {
    const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(String(req.query.status))
      ? (req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED')
      : undefined;
    res.json(await guestbookService.listAdmin(status));
  },
  async update(req: Request, res: Response) {
    const g = await guestbookService.update(id(req), parse(guestbookAdminUpdateSchema, req.body));
    audit(req, 'update', 'guestbook', g.id, { status: g.status });
    res.json(g);
  },
  async remove(req: Request, res: Response) {
    await guestbookService.remove(id(req));
    audit(req, 'delete', 'guestbook', id(req));
    res.status(204).end();
  },
};

function contentController<S extends z.ZodTypeAny>(
  entity: string,
  schema: S,
  service: {
    list(includeHidden?: boolean): Promise<unknown>;
    create(input: z.output<S>): Promise<{ id: string }>;
    update(id: string, input: z.output<S>): Promise<{ id: string }>;
    remove(id: string): Promise<void>;
  },
) {
  return {
    async list(_req: Request, res: Response) {
      res.json(await service.list(true));
    },
    async create(req: Request, res: Response) {
      const row = await service.create(parse(schema, req.body));
      audit(req, 'create', entity, row.id);
      res.status(201).json(row);
    },
    async update(req: Request, res: Response) {
      const row = await service.update(id(req), parse(schema, req.body));
      audit(req, 'update', entity, row.id);
      res.json(row);
    },
    async remove(req: Request, res: Response) {
      await service.remove(id(req));
      audit(req, 'delete', entity, id(req));
      res.status(204).end();
    },
  };
}

export const storyAdminController = contentController('story', storySectionInputSchema, storyService);
export const travelAdminController = contentController('travel', travelSectionInputSchema, travelService);
export const faqAdminController = contentController('faq', faqInputSchema, faqService);

export const roomsAdminController = {
  async accommodations(_req: Request, res: Response) {
    res.json(await roomsService.listAccommodations());
  },
  async createAccommodation(req: Request, res: Response) {
    const a = await roomsService.createAccommodation(parse(accommodationInputSchema, req.body));
    audit(req, 'create', 'accommodation', a.id, { name: a.name });
    res.status(201).json(a);
  },
  async updateAccommodation(req: Request, res: Response) {
    const a = await roomsService.updateAccommodation(id(req), parse(accommodationInputSchema, req.body));
    audit(req, 'update', 'accommodation', a.id);
    res.json(a);
  },
  async removeAccommodation(req: Request, res: Response) {
    await roomsService.removeAccommodation(id(req));
    audit(req, 'delete', 'accommodation', id(req));
    res.status(204).end();
  },
  async board(_req: Request, res: Response) {
    res.json(await roomsService.board());
  },
  async assign(req: Request, res: Response) {
    const room = await roomsService.assign(parse(roomAssignmentInputSchema, req.body));
    audit(req, 'assign', 'room', room.id, { rsvpId: room.rsvpId, room: `${room.accommodationName} ${room.roomNumber}` });
    res.status(201).json(room);
  },
  async updateRoom(req: Request, res: Response) {
    const room = await roomsService.updateRoom(id(req), parse(roomAssignmentInputSchema, req.body));
    audit(req, 'update', 'room', room.id);
    res.json(room);
  },
  async removeRoom(req: Request, res: Response) {
    await roomsService.removeRoom(id(req));
    audit(req, 'delete', 'room', id(req));
    res.status(204).end();
  },
};

export const contactsAdminController = contentController('contact', contactInputSchema, contactsService);

export const settingsAdminController = {
  async get(_req: Request, res: Response) {
    settingsService.invalidate();
    res.json(await settingsService.get());
  },
  async update(req: Request, res: Response) {
    const s = await settingsService.update(parse(settingsInputSchema, req.body));
    audit(req, 'update', 'settings', 'default');
    res.json(s);
  },
};

export const backupAdminController = {
  async list(_req: Request, res: Response) {
    res.json(await backupService.list());
  },
  async create(req: Request, res: Response) {
    const b = await backupService.create(req.user!.email);
    audit(req, 'create', 'backup', b.filename, { size: b.size });
    res.status(201).json(b);
  },
  async download(req: Request, res: Response) {
    const filename = req.params.filename!;
    if (!/^[\w.-]+\.sql\.gz$/.test(filename)) throw badRequest('Invalid backup name');
    const { stream, size } = await backupService.open(filename);
    audit(req, 'download', 'backup', filename);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (size) res.setHeader('Content-Length', String(size));
    stream.pipe(res);
  },
};
