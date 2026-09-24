import type { Request, Response } from 'express';
import {
  checkInSchema,
  followUpSchema,
  staffTravelSchema,
  teamUserCreateSchema,
  teamUserUpdateSchema,
} from '@wedding/shared';
import { z } from 'zod';
import { badRequest, parse } from '../lib/errors';
import { audit } from '../services/audit.service';
import { staffService } from '../services/staff.service';
import { teamService } from '../services/team.service';

const id = (req: Request) => req.params.id!;
const staffName = (req: Request) => req.user?.name ?? 'Staff';

export const teamController = {
  async list(_req: Request, res: Response) {
    res.json(await teamService.list());
  },
  async create(req: Request, res: Response) {
    const user = await teamService.create(parse(teamUserCreateSchema, req.body));
    audit(req, 'create', 'user', user.id, { role: user.role });
    res.status(201).json(user);
  },
  async update(req: Request, res: Response) {
    const input = parse(teamUserUpdateSchema, req.body);
    const user = await teamService.update(id(req), input, req.user!.id);
    audit(req, 'update', 'user', user.id, { role: user.role, active: user.isActive, passwordReset: !!input.password });
    res.json(user);
  },
  async remove(req: Request, res: Response) {
    await teamService.remove(id(req), req.user!.id);
    audit(req, 'delete', 'user', id(req));
    res.status(204).end();
  },
};

export const staffController = {
  async lookup(req: Request, res: Response) {
    res.json(await staffService.lookup(req.params.token!));
  },
  async guest(req: Request, res: Response) {
    res.json(await staffService.lookupById(id(req)));
  },

  async checkInBoard(req: Request, res: Response) {
    res.json(await staffService.checkInBoard(typeof req.query.eventId === 'string' ? req.query.eventId : undefined));
  },
  async checkIn(req: Request, res: Response) {
    const result = await staffService.checkIn(parse(checkInSchema, req.body), staffName(req));
    audit(req, 'check-in', 'rsvp', result.rsvpId, { eventId: result.eventId, count: result.count });
    res.json(result);
  },
  async undoCheckIn(req: Request, res: Response) {
    const { rsvpId, eventId } = parse(z.object({ rsvpId: z.string().min(1), eventId: z.string().min(1) }), req.params);
    await staffService.undoCheckIn(rsvpId, eventId);
    audit(req, 'undo-check-in', 'rsvp', rsvpId, { eventId });
    res.status(204).end();
  },
  async followUp(req: Request, res: Response) {
    const input = parse(followUpSchema, req.body);
    await staffService.followUp(input, staffName(req));
    res.json({ ok: true });
  },

  async portraitBoard(req: Request, res: Response) {
    res.json(await staffService.portraitBoard(typeof req.query.day === 'string' ? req.query.day : undefined));
  },
  async savePortrait(req: Request, res: Response) {
    const fields = parse(
      z.object({
        rsvpId: z.string().max(64).optional().transform((v) => v || undefined),
        token: z.string().max(200).optional().transform((v) => v || undefined),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a day'),
        method: z.enum(['QR', 'MANUAL']).default('MANUAL'),
      }),
      req.body,
    );
    if (!fields.rsvpId && !fields.token) throw badRequest('Choose a guest');
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const result = await staffService.savePortrait(fields, file, staffName(req), req.user!.id);
    audit(req, 'portrait', 'rsvp', result.rsvpId, { day: result.day, photo: result.hasPhoto });
    res.json(result);
  },
  async removePortrait(req: Request, res: Response) {
    await staffService.removePortrait(req.params.rsvpId!, req.params.day!);
    audit(req, 'delete-portrait', 'rsvp', req.params.rsvpId!, { day: req.params.day });
    res.status(204).end();
  },

  async arrivals(req: Request, res: Response) {
    res.json(
      await staffService.arrivals({
        q: typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim().slice(0, 100) : undefined,
        needsTransport: req.query.needsTransport === 'true',
      }),
    );
  },
  async updateTravel(req: Request, res: Response) {
    await staffService.updateTravel(id(req), parse(staffTravelSchema, req.body));
    audit(req, 'update-travel', 'rsvp', id(req));
    res.json({ ok: true });
  },
};
