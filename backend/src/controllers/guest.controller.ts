import type { Request, Response } from 'express';
import { guestLoginSchema, guestTravelSchema, pushSubscriptionSchema } from '@wedding/shared';
import { z } from 'zod';
import { env } from '../config/env';
import { badRequest, parse } from '../lib/errors';
import { clearGuestSession, guestRsvpId, guestService, requireGuestId, setGuestSession } from '../services/guest.service';
import { pushService } from '../services/push.service';

/** Development-only clock override so the Simulator can preview post-wedding portal content. */
function nowFrom(req: Request): Date {
  const raw = req.query.now;
  if (env.timeTravelEnabled && typeof raw === 'string' && raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export const guestController = {
  async login(req: Request, res: Response) {
    const { phone } = parse(guestLoginSchema, req.body);
    const rsvpId = await guestService.login(phone);
    setGuestSession(res, rsvpId);
    res.json(await guestService.portal(rsvpId, nowFrom(req)));
  },

  async logout(_req: Request, res: Response) {
    clearGuestSession(res);
    res.json({ ok: true });
  },

  /** Always 200: lets the site show "My pass" in the menu without a 401 for every visitor. */
  async session(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const rsvpId = guestRsvpId(req);
    res.json({ signedIn: rsvpId ? await guestService.exists(rsvpId) : false });
  },

  async me(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await guestService.portal(requireGuestId(req), nowFrom(req)));
  },

  async updateTravel(req: Request, res: Response) {
    const rsvpId = requireGuestId(req);
    await guestService.updateTravel(rsvpId, parse(guestTravelSchema, req.body));
    res.json(await guestService.portal(rsvpId, nowFrom(req)));
  },

  async uploadPhotos(req: Request, res: Response) {
    const rsvpId = requireGuestId(req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw badRequest('Choose at least one photo');
    const results = await guestService.uploadPhotos(rsvpId, files);
    res.status(results.some((r) => r.ok) ? 201 : 400).json({ results });
  },
};

export const pushController = {
  async publicKey(_req: Request, res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ publicKey: await pushService.publicKey() });
  },

  async subscribe(req: Request, res: Response) {
    const sub = parse(pushSubscriptionSchema, req.body);
    await pushService.subscribe(sub, guestRsvpId(req), req.header('user-agent'));
    res.status(201).json({ ok: true });
  },

  async unsubscribe(req: Request, res: Response) {
    const { endpoint } = parse(z.object({ endpoint: z.string().url().max(2000) }), req.body);
    await pushService.unsubscribe(endpoint);
    res.json({ ok: true });
  },
};
