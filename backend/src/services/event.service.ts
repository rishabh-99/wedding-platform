import { Prisma } from '@prisma/client';
import {
  buildIcs,
  computeSchedule,
  effectiveSpans,
  eventInputSchema,
  type CalendarEventInput,
  type EventDTO,
  type ScheduleDTO,
} from '@wedding/shared';
import type { z } from 'zod';
import { env } from '../config/env';
import { conflict, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { broker } from '../realtime/sseBroker';
import { eventRepository } from '../repositories/event.repository';
import { toEventDTO, toMediaDTOs } from './mappers';
import { settingsService } from './settings.service';

type EventParsed = z.output<typeof eventInputSchema>;

function toData(input: EventParsed) {
  return {
    ...input,
    startDateTime: new Date(input.startDateTime),
    endDateTime: input.endDateTime ? new Date(input.endDateTime) : null,
    dressPalette: input.dressPalette as unknown as Prisma.InputJsonValue,
  };
}

function handleUnique(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw conflict('An event with this slug already exists');
  }
  throw err;
}

export const eventService = {
  async listPublic(): Promise<EventDTO[]> {
    const events = await eventRepository.listPublished();
    return events.map(toEventDTO);
  },

  async listAdmin(): Promise<EventDTO[]> {
    return (await eventRepository.listAll()).map(toEventDTO);
  },

  async getPublicBySlug(slug: string): Promise<EventDTO> {
    const event = await eventRepository.findBySlug(slug);
    if (!event || !event.isPublished) throw notFound('Celebration');
    const refs = await prisma.mediaAsset.findMany({
      where: { eventId: event.id, purpose: 'DRESSCODE', isPublished: true },
      orderBy: { displayOrder: 'asc' },
    });
    return { ...toEventDTO(event), dressReferenceImages: await toMediaDTOs(refs) };
  },

  async create(input: EventParsed): Promise<EventDTO> {
    const created = await eventRepository.create(toData(input)).catch(handleUnique);
    broker.publish('SCHEDULE_CHANGED', { eventId: created.id });
    return toEventDTO(created);
  },

  async update(id: string, input: EventParsed): Promise<EventDTO> {
    if (!(await eventRepository.findById(id))) throw notFound('Event');
    const updated = await eventRepository.update(id, toData(input)).catch(handleUnique);
    broker.publish('SCHEDULE_CHANGED', { eventId: id });
    return toEventDTO(updated);
  },

  async setPublished(id: string, isPublished: boolean): Promise<EventDTO> {
    if (!(await eventRepository.findById(id))) throw notFound('Event');
    const updated = await eventRepository.update(id, { isPublished });
    broker.publish('SCHEDULE_CHANGED', { eventId: id });
    return toEventDTO(updated);
  },

  async remove(id: string): Promise<void> {
    if (!(await eventRepository.findById(id))) throw notFound('Event');
    await eventRepository.delete(id);
    broker.publish('SCHEDULE_CHANGED', { eventId: id });
  },

  async reorder(ids: string[]): Promise<void> {
    await eventRepository.reorder(ids);
    broker.publish('SCHEDULE_CHANGED');
  },

  /** "What is happening now?" — computed from the database schedule by the shared engine. */
  async schedule(now: Date = new Date()): Promise<ScheduleDTO> {
    const settings = await settingsService.get();
    const events = (await this.listPublic()).filter((e) => e.status !== 'CANCELLED');
    const result = computeSchedule(events, now, { timeZone: settings.timezone, liveMode: settings.liveMode });
    return { ...result, serverTime: new Date().toISOString(), timezone: settings.timezone };
  },

  /** ICS for one event (slug) or the full itinerary (slug omitted). */
  async ics(slug?: string): Promise<{ filename: string; body: string }> {
    const settings = await settingsService.get();
    const events = (await this.listPublic()).filter((e) => e.status !== 'CANCELLED');
    const spans = effectiveSpans(events, settings.timezone);
    const pick = slug ? spans.filter((s) => s.event.slug === slug) : spans;
    if (slug && pick.length === 0) throw notFound('Celebration');
    const couple = `${settings.coupleName1} & ${settings.coupleName2}`;
    const base = env.PUBLIC_URL.replace(/\/$/, '');
    const items: CalendarEventInput[] = pick.map(({ event, start, end }) => ({
      uid: `${event.id}@${new URL(base).hostname}`,
      title: `${event.name} — ${couple}`,
      description: [event.description, event.dressCode ? `Dress code: ${event.dressCode}` : null]
        .filter(Boolean)
        .join('\n\n'),
      location: event.venue ? [event.venue.name, event.venue.address].filter(Boolean).join(', ') : null,
      url: `${base}/celebrations/${event.slug}`,
      start,
      end,
    }));
    return {
      filename: slug ? `${slug}.ics` : 'wedding-celebrations.ics',
      body: buildIcs(items, `${couple} — Celebrations`),
    };
  },
};
