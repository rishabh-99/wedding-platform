import { parseLocalDateTime, type EventDTO, type LiveUpdateDTO, type VenueDTO } from '@wedding/shared';

export const TZ = 'Asia/Kolkata';
export const at = (local: string) => parseLocalDateTime(local, TZ);

const venue = (id: string, name: string, mapsUrl: string): VenueDTO => ({
  id,
  name,
  mapsUrl,
  address: null,
  description: null,
  parkingInformation: null,
  nearbyLandmarks: null,
  transportInformation: null,
  contactInformation: null,
  displayOrder: 0,
});

export const moonMars = venue('v1', 'Moon & Mars', 'https://maps.app.goo.gl/C1vZtGZmPn8UDBMo9');
export const statusClub = venue('v2', 'Status Club Kanpur', 'https://share.google/WNdAo3dcJVuN6znho');

const ev = (id: string, name: string, local: string, v: VenueDTO, order: number): EventDTO => ({
  id,
  name,
  slug: id,
  description: null,
  startDateTime: at(local).toISOString(),
  endDateTime: null,
  venueId: v.id,
  venue: v,
  dressCode: null,
  dressCodeDescription: null,
  dressPalette: [],
  helpfulInfo: null,
  displayOrder: order,
  status: 'SCHEDULED',
  isPublished: true,
});

export const EVENTS: EventDTO[] = [
  ev('engagement', 'Engagement', '2026-10-20T11:00', moonMars, 1),
  ev('haldi-mehendi', 'Haldi / Mehendi', '2026-12-03T09:00', statusClub, 2),
  ev('sangeet', 'Sangeet', '2026-12-03T21:00', statusClub, 3),
  ev('sehra-bandhi', 'Sehra-Bandhi', '2026-12-04T08:00', statusClub, 4),
  ev('baraat', 'Baraat', '2026-12-04T09:00', statusClub, 5),
  ev('jaimal-phere', 'Jaimal & Phere', '2026-12-04T11:00', statusClub, 6),
];

export function livePost(id: string, content: string, local: string, eventIndex = 2): LiveUpdateDTO {
  const e = EVENTS[eventIndex]!;
  return {
    id,
    eventId: e.id,
    event: { id: e.id, name: e.name, slug: e.slug },
    type: 'TEXT',
    title: null,
    content,
    media: null,
    published: true,
    publishedAt: at(local).toISOString(),
    scheduledFor: null,
    status: 'PUBLISHED',
    createdAt: at(local).toISOString(),
    updatedAt: at(local).toISOString(),
  };
}
