import type { Prisma } from '@prisma/client';
import {
  ATTENDANCE_LABELS,
  type Paginated,
  type RsvpDTO,
  type RsvpParsed,
  type RsvpSubmitResult,
  type rsvpAdminUpdateSchema,
  type rsvpListQuerySchema,
} from '@wedding/shared';
import type { z } from 'zod';
import { env } from '../config/env';
import { badRequest, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { toRsvpDTO } from './mappers';
import { sendEmailSafely } from './email.service';

export const rsvpInclude = {
  events: { include: { event: { select: { id: true, name: true, slug: true, startDateTime: true } } } },
  rooms: { include: { accommodation: { select: { name: true } } }, orderBy: { roomNumber: 'asc' } },
} satisfies Prisma.RsvpInclude;

/** Digits only; bare 10-digit Indian mobile numbers are prefixed with 91 so +91 and 0-prefixed forms match. */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

async function validEventIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const found = await prisma.event.findMany({ where: { id: { in: unique }, isPublished: true }, select: { id: true } });
  if (found.length !== unique.length) throw badRequest('One of the selected celebrations is not available', { fields: { eventIds: 'Please re-select your celebrations' } });
  return unique;
}

export const rsvpService = {
  /**
   * Creates or updates an RSVP. Duplicate protection:
   *  - the same idempotency key (double-click / network retry) returns the original result;
   *  - the same phone number updates the existing RSVP instead of creating a second one.
   */
  async submit(input: RsvpParsed): Promise<RsvpSubmitResult> {
    if (input.idempotencyKey) {
      const prior = await prisma.rsvp.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (prior) return { id: prior.id, updated: false, guestName: prior.guestName, attendanceStatus: prior.attendanceStatus };
    }
    const eventIds = input.attendanceStatus === 'DECLINED' ? [] : await validEventIds(input.eventIds);
    const phoneNormalized = normalizePhone(input.phone);
    if (phoneNormalized.length < 7) throw badRequest('Please enter a valid phone number', { fields: { phone: 'Please enter a valid phone number' } });

    const data = {
      guestName: input.guestName,
      phone: input.phone,
      email: input.email,
      numberOfGuests: input.attendanceStatus === 'DECLINED' ? 0 : input.numberOfGuests,
      side: input.side ?? null,
      attendanceStatus: input.attendanceStatus,
      message: input.message,
    };

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rsvp.findUnique({ where: { phoneNormalized } });
      if (existing) {
        await tx.rsvpEvent.deleteMany({ where: { rsvpId: existing.id } });
        const updated = await tx.rsvp.update({
          where: { id: existing.id },
          data: {
            ...data,
            idempotencyKey: input.idempotencyKey ?? existing.idempotencyKey,
            events: { create: eventIds.map((eventId) => ({ eventId })) },
          },
          include: rsvpInclude,
        });
        return { row: updated, updated: true };
      }
      const created = await tx.rsvp.create({
        data: {
          ...data,
          phoneNormalized,
          idempotencyKey: input.idempotencyKey ?? null,
          events: { create: eventIds.map((eventId) => ({ eventId })) },
        },
        include: rsvpInclude,
      });
      return { row: created, updated: false };
    });

    if (env.ADMIN_NOTIFY_EMAIL || env.EMAIL_DRIVER === 'log') {
      const r = result.row;
      sendEmailSafely({
        to: env.ADMIN_NOTIFY_EMAIL ?? 'admin@localhost',
        subject: `${result.updated ? 'Updated' : 'New'} RSVP: ${r.guestName} (${ATTENDANCE_LABELS[r.attendanceStatus]})`,
        text: [
          `${r.guestName} — ${ATTENDANCE_LABELS[r.attendanceStatus]}`,
          `Guests: ${r.numberOfGuests}`,
          `Phone: ${r.phone}`,
          r.email ? `Email: ${r.email}` : null,
          `Celebrations: ${r.events.map((e) => e.event.name).join(', ') || '—'}`,
          r.message ? `Message: ${r.message}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }

    return {
      id: result.row.id,
      updated: result.updated,
      guestName: result.row.guestName,
      attendanceStatus: result.row.attendanceStatus,
    };
  },

  async list(query: z.output<typeof rsvpListQuerySchema>): Promise<Paginated<RsvpDTO>> {
    const where: Prisma.RsvpWhereInput = {};
    if (query.status) where.attendanceStatus = query.status;
    if (query.side) where.side = query.side;
    if (query.accommodationId) where.rooms = { some: { accommodationId: query.accommodationId } };
    if (query.needsRoom) {
      where.rooms = { none: {} };
      where.attendanceStatus = query.status && query.status !== 'DECLINED' ? query.status : { not: 'DECLINED' };
    }
    if (query.eventId) where.events = { some: { eventId: query.eventId } };
    if (query.q) {
      where.OR = [
        { guestName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
        { message: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.rsvp.count({ where }),
      prisma.rsvp.findMany({
        where,
        include: rsvpInclude,
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toRsvpDTO), total, page: query.page, pageSize: query.pageSize };
  },

  async all() {
    return prisma.rsvp.findMany({ include: rsvpInclude, orderBy: { submittedAt: 'asc' } });
  },

  async update(id: string, input: z.output<typeof rsvpAdminUpdateSchema>): Promise<RsvpDTO> {
    const existing = await prisma.rsvp.findUnique({ where: { id } });
    if (!existing) throw notFound('RSVP');
    const eventIds = await validEventIds(input.eventIds);
    const row = await prisma.$transaction(async (tx) => {
      await tx.rsvpEvent.deleteMany({ where: { rsvpId: id } });
      return tx.rsvp.update({
        where: { id },
        data: {
          guestName: input.guestName,
          phone: input.phone,
          phoneNormalized: normalizePhone(input.phone),
          email: input.email,
          numberOfGuests: input.numberOfGuests,
          side: input.side,
          attendanceStatus: input.attendanceStatus,
          message: input.message,
          events: { create: eventIds.map((eventId) => ({ eventId })) },
        },
        include: rsvpInclude,
      });
    });
    return toRsvpDTO(row);
  },

  async remove(id: string): Promise<void> {
    if (!(await prisma.rsvp.findUnique({ where: { id } }))) throw notFound('RSVP');
    await prisma.rsvp.delete({ where: { id } });
  },
};
