import { formatTime, localDateKey, type EventDTO } from '@wedding/shared';
import { defaultInvitation } from './vendor/data/defaults';
import type { Invitation } from './vendor/data/schema';
import type { InvitationSlot } from './sceneRegistry';

/**
 * The film's scenes take one `Invitation` object. On the site the scenes are shown without their
 * titles, but the event's own details still go in, so the artwork never carries stale data from
 * the film should its titles ever be shown.
 */
export function toInvitation(event: EventDTO, slot: InvitationSlot, timeZone: string): Invitation {
  const date = localDateKey(event.startDateTime, timeZone);
  const time = formatTime(event.startDateTime, timeZone);
  const venue = event.venue?.name ?? '';
  const inv: Invitation = structuredClone(defaultInvitation);

  if (slot.kind === 'event') {
    inv.events[slot.key] = { id: slot.key, title: event.name, date, time, venue };
    // Haldi and Mehendi share one scene (and one event on the site).
    if (slot.key === 'haldi') inv.events.mehendi = { id: 'mehendi', title: event.name, date, time, venue };
  } else {
    inv.events.weddingDay = {
      date,
      venue,
      items: inv.events.weddingDay.items.map((item) => (item.id === slot.id ? { ...item, title: event.name, time } : item)),
    };
  }
  return inv;
}
