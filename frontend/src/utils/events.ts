import { effectiveSpans, type EventDTO } from '@wedding/shared';

/** Start/end (end defaults per the shared engine) for calendar links. */
export function eventTimes(event: EventDTO, all: EventDTO[], timeZone: string): { start: Date; end: Date } {
  const span = effectiveSpans(all.length ? all : [event], timeZone).find((s) => s.event.id === event.id);
  const start = new Date(event.startDateTime);
  return { start, end: new Date(span?.end ?? start.getTime() + 3 * 3600_000) };
}

export function venueLabel(event: EventDTO): string | null {
  if (!event.venue) return null;
  return [event.venue.name, event.venue.address].filter(Boolean).join(', ');
}

export const icsUrl = (slug?: string) => (slug ? `/api/events/${encodeURIComponent(slug)}/calendar.ics` : '/api/events/calendar.ics');
