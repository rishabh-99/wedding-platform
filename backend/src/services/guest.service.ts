import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Prisma, Rsvp } from '@prisma/client';
import { localDateKey, type GuestPortalDTO, type TravelDTO, type guestTravelSchema } from '@wedding/shared';
import type { z } from 'zod';
import { env } from '../config/env';
import { AppError, notFound, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { contactsService } from './contacts.service';
import { eventService } from './event.service';
import { toMediaDTO, toRoomDTO } from './mappers';
import { mediaService, type IncomingFile } from './media.service';
import { normalizePhone } from './rsvp.service';
import { settingsService } from './settings.service';

/**
 * Guest portal: guests "sign up / log in" with the phone number on their RSVP
 * (no PIN/OTP by design — the data shown is not sensitive). The session is a
 * long-lived httpOnly cookie that only identifies the RSVP.
 */

export const GUEST_COOKIE = 'wedding_guest';
const GUEST_SESSION_DAYS = 120;
export const GUEST_ALBUM_SLUG = 'guest-moments';

interface GuestClaims {
  sub: string;
  typ: 'guest';
}

export function setGuestSession(res: Response, rsvpId: string) {
  const token = jwt.sign({ sub: rsvpId, typ: 'guest' } satisfies GuestClaims, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${GUEST_SESSION_DAYS}d`,
  });
  res.cookie(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/api',
    maxAge: GUEST_SESSION_DAYS * 24 * 3600 * 1000,
  });
}

export function clearGuestSession(res: Response) {
  res.clearCookie(GUEST_COOKIE, { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax', path: '/api' });
}

/** The RSVP id of the signed-in guest, or null. */
export function guestRsvpId(req: Request): string | null {
  const token = req.cookies?.[GUEST_COOKIE] as string | undefined;
  if (!token) return null;
  try {
    const claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as GuestClaims;
    return claims.typ === 'guest' ? claims.sub : null;
  } catch {
    return null;
  }
}

export function requireGuestId(req: Request): string {
  const id = guestRsvpId(req);
  if (!id) throw unauthorized('Please sign in with the phone number you used to RSVP');
  return id;
}

export function toTravelDTO(r: Rsvp, includeNotes = false): TravelDTO {
  return {
    arrivalMode: r.arrivalMode,
    arrivalAt: r.arrivalAt?.toISOString() ?? null,
    arrivalDetails: r.arrivalDetails,
    pickupNeeded: r.pickupNeeded,
    pickupStatus: r.pickupStatus,
    departureMode: r.departureMode,
    departureAt: r.departureAt?.toISOString() ?? null,
    departureDetails: r.departureDetails,
    dropNeeded: r.dropNeeded,
    dropStatus: r.dropStatus,
    ...(includeNotes ? { transportNotes: r.transportNotes } : {}),
  };
}

/** Converts the guest's travel form into DB fields; a pickup/drop request moves its status to "to arrange". */
export function travelData(input: z.output<typeof guestTravelSchema>, existing: Rsvp): Prisma.RsvpUpdateInput {
  const statusFor = (needed: boolean, current: Rsvp['pickupStatus']) =>
    !needed ? 'NOT_NEEDED' : current === 'NOT_NEEDED' ? 'PENDING' : current;
  return {
    arrivalMode: input.arrivalMode,
    arrivalAt: input.arrivalAt ? new Date(input.arrivalAt) : null,
    arrivalDetails: input.arrivalDetails,
    pickupNeeded: input.pickupNeeded,
    pickupStatus: statusFor(input.pickupNeeded, existing.pickupStatus),
    departureMode: input.departureMode,
    departureAt: input.departureAt ? new Date(input.departureAt) : null,
    departureDetails: input.departureDetails,
    dropNeeded: input.dropNeeded,
    dropStatus: statusFor(input.dropNeeded, existing.dropStatus),
  };
}

export const partyInclude = {
  events: { include: { event: { select: { id: true, name: true, slug: true, startDateTime: true, isPublished: true } } } },
  rooms: { include: { accommodation: { select: { name: true } } }, orderBy: { roomNumber: 'asc' } },
  checkIns: true,
} satisfies Prisma.RsvpInclude;

export type PartyRow = Prisma.RsvpGetPayload<{ include: typeof partyInclude }>;

export function partyEvents(r: PartyRow) {
  return r.events
    .filter((e) => e.event.isPublished)
    .sort((a, b) => a.event.startDateTime.getTime() - b.event.startDateTime.getTime())
    .map((e) => ({
      id: e.event.id,
      name: e.event.name,
      slug: e.event.slug,
      startDateTime: e.event.startDateTime.toISOString(),
      checkedIn: r.checkIns.find((c) => c.eventId === e.event.id)?.count ?? null,
    }));
}

async function guestAlbumId(): Promise<string> {
  const album = await prisma.album.upsert({
    where: { slug: GUEST_ALBUM_SLUG },
    update: {},
    create: { slug: GUEST_ALBUM_SLUG, name: 'Guest moments', description: 'Photographs shared by our guests', displayOrder: 99 },
  });
  return album.id;
}

export const guestService = {
  async exists(rsvpId: string): Promise<boolean> {
    return !!(await prisma.rsvp.findUnique({ where: { id: rsvpId }, select: { id: true } }));
  },

  async login(phone: string): Promise<string> {
    const normalized = normalizePhone(phone);
    const rsvp = await prisma.rsvp.findUnique({ where: { phoneNormalized: normalized } });
    if (!rsvp) {
      throw new AppError(404, 'NO_RSVP', 'We couldn’t find an RSVP with this number. Please RSVP first, or try the number you used.');
    }
    return rsvp.id;
  },

  async portal(rsvpId: string, now: Date = new Date()): Promise<GuestPortalDTO> {
    const r = await prisma.rsvp.findUnique({
      where: { id: rsvpId },
      include: {
        ...partyInclude,
        portraits: { include: { mediaAsset: true }, orderBy: { day: 'asc' } },
      },
    });
    if (!r) throw unauthorized('Your RSVP could not be found. Please sign in again.');

    const schedule = await eventService.schedule(now);
    const portraitsAvailable = schedule.phase === 'archive';
    const uploads = await prisma.mediaAsset.findMany({
      where: { uploadedByRsvpId: rsvpId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const contacts = (await contactsService.list()).filter(
      (c) => /hospitality|room|stay|travel|transport/i.test(`${c.role} ${c.name}`) || !c.eventId,
    );

    return {
      rsvpId: r.id,
      guestName: r.guestName,
      phone: r.phone,
      numberOfGuests: r.numberOfGuests,
      side: r.side,
      attendanceStatus: r.attendanceStatus,
      qrUrl: `${env.PUBLIC_URL.replace(/\/$/, '')}/q/${r.qrToken}`,
      events: partyEvents(r),
      rooms: r.rooms.map(toRoomDTO),
      travel: toTravelDTO(r),
      hospitalityContacts: contacts,
      portraitsAvailable,
      portraits: portraitsAvailable
        ? await Promise.all(
            r.portraits.filter((p) => p.mediaAsset).map(async (p) => ({ day: p.day, media: await toMediaDTO(p.mediaAsset!) })),
          )
        : [],
      uploads: await Promise.all(
        uploads.map(async (m) => ({ ...(await toMediaDTO(m)), status: m.isPublished ? ('APPROVED' as const) : ('PENDING' as const) })),
      ),
    };
  },

  async updateTravel(rsvpId: string, input: z.output<typeof guestTravelSchema>) {
    const existing = await prisma.rsvp.findUnique({ where: { id: rsvpId } });
    if (!existing) throw notFound('RSVP');
    await prisma.rsvp.update({ where: { id: rsvpId }, data: travelData(input, existing) });
  },

  /** Shared album: guest photos go into "Guest moments", hidden until approved in the admin gallery. */
  async uploadPhotos(rsvpId: string, files: IncomingFile[]) {
    const albumId = await guestAlbumId();
    const rsvp = await prisma.rsvp.findUnique({ where: { id: rsvpId } });
    if (!rsvp) throw notFound('RSVP');
    const results: { filename: string; ok: boolean; error?: string }[] = [];
    for (const file of files) {
      try {
        const asset = await mediaService.upload(file, {
          purpose: 'GALLERY',
          albumId,
          guest: true,
          allowVideo: false,
          isPublished: false,
          caption: `Shared by ${rsvp.guestName}`,
        });
        await prisma.mediaAsset.update({ where: { id: asset.id }, data: { uploadedByRsvpId: rsvpId } });
        results.push({ filename: file.originalname, ok: true });
      } catch (err) {
        results.push({ filename: file.originalname, ok: false, error: (err as Error).message });
      }
    }
    return results;
  },
};

/** Local wedding-day keys (YYYY-MM-DD) for a list of instants. */
export function dayKeys(dates: Date[], tz: string): string[] {
  return [...new Set(dates.map((d) => localDateKey(d, tz)))].sort();
}

export async function weddingTimezone() {
  return (await settingsService.get()).timezone;
}
