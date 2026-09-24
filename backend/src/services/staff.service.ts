import type { Prisma } from '@prisma/client';
import {
  formatInTz,
  localDateKey,
  type ArrivalRowDTO,
  type CheckInBoardDTO,
  type PortraitBoardDTO,
  type StaffGuestCardDTO,
  type checkInSchema,
  type followUpSchema,
  type staffTravelSchema,
} from '@wedding/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { broker } from '../realtime/sseBroker';
import { eventService } from './event.service';
import { partyEvents, partyInclude, toTravelDTO, travelData } from './guest.service';
import { toMediaDTO, toRoomDTO } from './mappers';
import { mediaService, type IncomingFile } from './media.service';
import { settingsService } from './settings.service';

/**
 * Staff operations on the wedding days: QR lookup, event check-in and follow-up
 * calls (coordinators), photo-of-the-day coverage (photographer) and
 * arrivals/pickups (hospitality).
 */

/** Accepts a raw token or a scanned URL like https://site/q/<token>. */
export function tokenFrom(input: string): string {
  const m = /\/q\/([^/?#\s]+)/.exec(input);
  return decodeURIComponent((m ? m[1]! : input).trim());
}

async function rsvpIdFor(input: { rsvpId?: string; token?: string }): Promise<string> {
  if (input.rsvpId) return input.rsvpId;
  const r = await prisma.rsvp.findUnique({ where: { qrToken: tokenFrom(input.token ?? '') }, select: { id: true } });
  if (!r) throw notFound('Guest pass');
  return r.id;
}

async function publishedEvents() {
  return prisma.event.findMany({
    where: { isPublished: true, status: { not: 'CANCELLED' } },
    orderBy: { startDateTime: 'asc' },
    select: { id: true, name: true, slug: true, startDateTime: true },
  });
}

/** The event to show by default: the one in progress, else the next, else the last. */
async function defaultEventId(): Promise<string | null> {
  const s = await eventService.schedule();
  return s.current?.id ?? s.next?.id ?? s.previous?.id ?? null;
}

export const staffService = {
  async lookup(token: string): Promise<StaffGuestCardDTO> {
    const r = await prisma.rsvp.findUnique({
      where: { qrToken: tokenFrom(token) },
      include: { ...partyInclude, portraits: { select: { day: true } } },
    });
    if (!r) throw notFound('Guest pass');
    return {
      rsvpId: r.id,
      qrToken: r.qrToken,
      guestName: r.guestName,
      phone: r.phone,
      numberOfGuests: r.numberOfGuests,
      side: r.side,
      attendanceStatus: r.attendanceStatus,
      events: partyEvents(r),
      rooms: r.rooms.map(toRoomDTO),
      travel: toTravelDTO(r, true),
      portraitDays: r.portraits.map((p) => p.day),
    };
  },

  async lookupById(rsvpId: string): Promise<StaffGuestCardDTO> {
    const r = await prisma.rsvp.findUnique({ where: { id: rsvpId }, select: { qrToken: true } });
    if (!r) throw notFound('Guest');
    return this.lookup(r.qrToken);
  },

  // ── Check-in ──────────────────────────────────────────────────────────────

  async checkInBoard(eventId?: string): Promise<CheckInBoardDTO> {
    const id = eventId || (await defaultEventId());
    if (!id) throw notFound('Celebration');
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true, name: true, slug: true, startDateTime: true } });
    if (!event) throw notFound('Celebration');

    const rsvps = await prisma.rsvp.findMany({
      where: { attendanceStatus: { not: 'DECLINED' }, events: { some: { eventId: id } } },
      include: {
        rooms: { include: { accommodation: { select: { name: true } } } },
        checkIns: { where: { eventId: id } },
        followUps: { where: { eventId: id } },
      },
      orderBy: { guestName: 'asc' },
    });
    // Walk-ins: checked in without having RSVP'd for this event.
    const walkIns = await prisma.rsvp.findMany({
      where: { checkIns: { some: { eventId: id } }, NOT: { id: { in: rsvps.map((r) => r.id) } } },
      include: {
        rooms: { include: { accommodation: { select: { name: true } } } },
        checkIns: { where: { eventId: id } },
        followUps: { where: { eventId: id } },
      },
    });
    const all = [...rsvps, ...walkIns];
    const rows = all.map((r) => {
      const c = r.checkIns[0];
      const f = r.followUps[0];
      return {
        rsvpId: r.id,
        guestName: r.guestName,
        phone: r.phone,
        numberOfGuests: r.numberOfGuests,
        side: r.side,
        attendanceStatus: r.attendanceStatus,
        rooms: r.rooms.map(toRoomDTO),
        checkIn: c ? { count: c.count, checkedInAt: c.checkedInAt.toISOString(), method: c.method, by: c.checkedInByName } : null,
        followUp: f ? { status: f.status, note: f.note, updatedAt: f.updatedAt.toISOString(), by: f.updatedByName } : null,
      };
    });
    return {
      event: { ...event, startDateTime: event.startDateTime.toISOString() },
      expectedParties: rsvps.length,
      expectedGuests: rsvps.reduce((n, r) => n + r.numberOfGuests, 0),
      arrivedParties: rows.filter((r) => r.checkIn).length,
      arrivedGuests: rows.reduce((n, r) => n + (r.checkIn?.count ?? 0), 0),
      rows,
    };
  },

  async checkIn(input: z.output<typeof checkInSchema>, byName: string) {
    const rsvpId = await rsvpIdFor(input);
    const event = await prisma.event.findUnique({ where: { id: input.eventId }, select: { id: true } });
    if (!event) throw badRequest('Choose a celebration');
    const row = await prisma.checkIn.upsert({
      where: { rsvpId_eventId: { rsvpId, eventId: input.eventId } },
      create: { rsvpId, eventId: input.eventId, count: input.count, method: input.method, checkedInByName: byName },
      update: { count: input.count, method: input.method, checkedInByName: byName },
    });
    broker.publish('CHECKIN_UPDATED', { eventId: input.eventId });
    return { rsvpId, eventId: row.eventId, count: row.count, checkedInAt: row.checkedInAt.toISOString() };
  },

  async undoCheckIn(rsvpId: string, eventId: string) {
    await prisma.checkIn.deleteMany({ where: { rsvpId, eventId } });
    broker.publish('CHECKIN_UPDATED', { eventId });
  },

  async followUp(input: z.output<typeof followUpSchema>, byName: string) {
    await prisma.followUp.upsert({
      where: { rsvpId_eventId: { rsvpId: input.rsvpId, eventId: input.eventId } },
      create: { ...input, updatedByName: byName },
      update: { status: input.status, note: input.note, updatedByName: byName },
    });
    broker.publish('CHECKIN_UPDATED', { eventId: input.eventId });
  },

  // ── Photo of the day ──────────────────────────────────────────────────────

  async portraitBoard(day?: string): Promise<PortraitBoardDTO> {
    const tz = (await settingsService.get()).timezone;
    const events = await publishedEvents();
    const days = [...new Set(events.map((e) => localDateKey(e.startDateTime, tz)))].sort();
    const today = localDateKey(new Date(), tz);
    const selected = day && days.includes(day) ? day : days.includes(today) ? today : days.find((d) => d >= today) ?? days.at(-1) ?? today;
    const dayEventIds = events.filter((e) => localDateKey(e.startDateTime, tz) === selected).map((e) => e.id);

    // Families expected that day, plus anyone already photographed that day.
    const rsvps = await prisma.rsvp.findMany({
      where: {
        OR: [
          { attendanceStatus: { not: 'DECLINED' }, events: { some: { eventId: { in: dayEventIds } } } },
          { portraits: { some: { day: selected } } },
        ],
      },
      include: { portraits: { where: { day: selected }, include: { mediaAsset: true } } },
      orderBy: { guestName: 'asc' },
    });
    const rows = await Promise.all(
      rsvps.map(async (r) => {
        const p = r.portraits[0];
        return {
          rsvpId: r.id,
          guestName: r.guestName,
          phone: r.phone,
          numberOfGuests: r.numberOfGuests,
          side: r.side,
          portrait: p
            ? { media: p.mediaAsset ? await toMediaDTO(p.mediaAsset) : null, method: p.method, by: p.takenByName, at: p.updatedAt.toISOString() }
            : null,
        };
      }),
    );
    return {
      day: selected,
      days: days.map((d) => ({
        day: d,
        label: formatInTz(new Date(`${d}T12:00:00Z`), 'UTC', { weekday: 'short', day: 'numeric', month: 'short' }),
      })),
      covered: rows.filter((r) => r.portrait).length,
      total: rows.length,
      rows,
    };
  },

  /** Marks a family as photographed for the day; attaches/replaces the photo if one is uploaded. */
  async savePortrait(input: { rsvpId?: string; token?: string; day: string; method: 'QR' | 'MANUAL' }, file: IncomingFile | undefined, byName: string, userId: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw badRequest('Invalid day');
    const tz = (await settingsService.get()).timezone;
    const weddingDays = new Set((await publishedEvents()).map((e) => localDateKey(e.startDateTime, tz)));
    if (!weddingDays.has(input.day)) throw badRequest('That date isn’t one of the celebration days');
    const rsvpId = await rsvpIdFor(input);
    const existing = await prisma.guestPortrait.findUnique({ where: { rsvpId_day: { rsvpId, day: input.day } } });
    let mediaAssetId = existing?.mediaAssetId ?? null;
    if (file) {
      const rsvp = await prisma.rsvp.findUnique({ where: { id: rsvpId }, select: { guestName: true } });
      const asset = await mediaService.upload(file, {
        purpose: 'PORTRAIT',
        allowVideo: false,
        isPublished: false,
        caption: `${rsvp?.guestName ?? 'Guest'} · ${input.day}`,
        uploadedById: userId,
      });
      if (existing?.mediaAssetId) await mediaService.remove(existing.mediaAssetId).catch(() => undefined);
      mediaAssetId = asset.id;
    }
    const data: Prisma.GuestPortraitUncheckedCreateInput = { rsvpId, day: input.day, mediaAssetId, method: input.method, takenByName: byName };
    await prisma.guestPortrait.upsert({ where: { rsvpId_day: { rsvpId, day: input.day } }, create: data, update: data });
    return { rsvpId, day: input.day, hasPhoto: !!mediaAssetId };
  },

  async removePortrait(rsvpId: string, day: string) {
    const existing = await prisma.guestPortrait.findUnique({ where: { rsvpId_day: { rsvpId, day } } });
    if (!existing) return;
    await prisma.guestPortrait.delete({ where: { id: existing.id } });
    if (existing.mediaAssetId) await mediaService.remove(existing.mediaAssetId).catch(() => undefined);
  },

  // ── Arrivals & pickups ────────────────────────────────────────────────────

  async arrivals(opts: { q?: string; needsTransport?: boolean }): Promise<ArrivalRowDTO[]> {
    const where: Prisma.RsvpWhereInput = { attendanceStatus: { not: 'DECLINED' } };
    if (opts.needsTransport) where.OR = [{ pickupNeeded: true }, { dropNeeded: true }];
    if (opts.q) {
      where.AND = [{ OR: [{ guestName: { contains: opts.q, mode: 'insensitive' } }, { phone: { contains: opts.q } }, { arrivalDetails: { contains: opts.q, mode: 'insensitive' } }] }];
    }
    const rows = await prisma.rsvp.findMany({
      where,
      include: { rooms: { include: { accommodation: { select: { name: true } } } } },
      orderBy: [{ arrivalAt: { sort: 'asc', nulls: 'last' } }, { guestName: 'asc' }],
    });
    return rows.map((r) => ({
      rsvpId: r.id,
      guestName: r.guestName,
      phone: r.phone,
      numberOfGuests: r.numberOfGuests,
      side: r.side,
      rooms: r.rooms.map(toRoomDTO),
      ...toTravelDTO(r, true),
    }));
  },

  async updateTravel(rsvpId: string, input: z.output<typeof staffTravelSchema>) {
    const existing = await prisma.rsvp.findUnique({ where: { id: rsvpId } });
    if (!existing) throw notFound('RSVP');
    const base = travelData(input, existing);
    await prisma.rsvp.update({
      where: { id: rsvpId },
      data: {
        ...base,
        pickupStatus: input.pickupNeeded ? input.pickupStatus === 'NOT_NEEDED' ? 'PENDING' : input.pickupStatus : 'NOT_NEEDED',
        dropStatus: input.dropNeeded ? input.dropStatus === 'NOT_NEEDED' ? 'PENDING' : input.dropStatus : 'NOT_NEEDED',
        transportNotes: input.transportNotes,
      },
    });
  },
};
