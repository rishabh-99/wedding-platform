import type {
  Accommodation,
  Album,
  Contact,
  Event,
  RoomAssignment,
  GuestbookMessage,
  LiveUpdate,
  MediaAsset,
  Rsvp,
  RsvpEvent,
  StorySection,
  TravelSection,
  FaqItem,
  Venue,
} from '@prisma/client';
import type {
  AccommodationDTO,
  AlbumDTO,
  ContactDTO,
  EventDTO,
  RoomAssignmentDTO,
  FaqDTO,
  GuestbookDTO,
  LinkItem,
  LiveUpdateDTO,
  LiveUpdateStatus,
  MediaDTO,
  PaletteColour,
  RsvpDTO,
  StorySectionDTO,
  TravelSectionDTO,
  VenueDTO,
} from '@wedding/shared';
import { storage } from '../storage';

/** Converts Prisma rows to API DTOs. Media URLs are resolved through the storage provider. */

export interface VariantInfo {
  key: string;
  width: number;
  height: number;
  mime: string;
}
export type Variants = Partial<Record<'thumb' | 'medium' | 'poster', VariantInfo>>;

export async function toMediaDTO(
  asset: MediaAsset & { event?: Pick<Event, 'id' | 'name' | 'slug'> | null },
  opts: { admin?: boolean } = {},
): Promise<MediaDTO> {
  const s = storage();
  const variants = (asset.variants ?? {}) as Variants;
  const original = await s.getUrl(asset.storageKey);
  const medium = variants.medium ? await s.getUrl(variants.medium.key) : original;
  const thumbKey = variants.thumb?.key ?? variants.poster?.key;
  const thumb = thumbKey ? await s.getUrl(thumbKey) : medium;
  const dto: MediaDTO = {
    id: asset.id,
    type: asset.type,
    purpose: asset.purpose,
    mimeType: asset.mimeType,
    originalFilename: asset.originalFilename,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
    caption: asset.caption,
    eventId: asset.eventId,
    albumId: asset.albumId,
    displayOrder: asset.displayOrder,
    isPublished: asset.isPublished,
    createdAt: asset.createdAt.toISOString(),
    urls: { thumb, medium, original },
    placeholder: asset.placeholder,
  };
  if (asset.event !== undefined) dto.event = asset.event ? { id: asset.event.id, name: asset.event.name, slug: asset.event.slug } : null;
  if (opts.admin) {
    dto.storageKey = asset.storageKey;
    dto.storageDriver = s.describe(asset.storageKey);
  }
  return dto;
}

export const toMediaDTOs = (assets: MediaAsset[], opts: { admin?: boolean } = {}) =>
  Promise.all(assets.map((a) => toMediaDTO(a, opts)));

export function toVenueDTO(v: Venue): VenueDTO {
  return {
    id: v.id,
    name: v.name,
    address: v.address,
    mapsUrl: v.mapsUrl,
    description: v.description,
    parkingInformation: v.parkingInformation,
    nearbyLandmarks: v.nearbyLandmarks,
    transportInformation: v.transportInformation,
    contactInformation: v.contactInformation,
    displayOrder: v.displayOrder,
  };
}

export function toEventDTO(e: Event & { venue?: Venue | null }): EventDTO {
  return {
    id: e.id,
    name: e.name,
    slug: e.slug,
    description: e.description,
    startDateTime: e.startDateTime.toISOString(),
    endDateTime: e.endDateTime?.toISOString() ?? null,
    venueId: e.venueId,
    venue: e.venue ? toVenueDTO(e.venue) : null,
    dressCode: e.dressCode,
    dressCodeDescription: e.dressCodeDescription,
    dressPalette: Array.isArray(e.dressPalette) ? (e.dressPalette as unknown as PaletteColour[]) : [],
    helpfulInfo: e.helpfulInfo,
    displayOrder: e.displayOrder,
    status: e.status,
    isPublished: e.isPublished,
  };
}

export function liveUpdateStatus(u: Pick<LiveUpdate, 'published' | 'scheduledFor'>): LiveUpdateStatus {
  if (u.published) return 'PUBLISHED';
  if (u.scheduledFor) return 'SCHEDULED';
  return 'DRAFT';
}

export async function toLiveUpdateDTO(
  u: LiveUpdate & { event?: Pick<Event, 'id' | 'name' | 'slug'> | null; mediaAsset?: MediaAsset | null },
): Promise<LiveUpdateDTO> {
  return {
    id: u.id,
    eventId: u.eventId,
    event: u.event ? { id: u.event.id, name: u.event.name, slug: u.event.slug } : null,
    type: u.type,
    title: u.title,
    content: u.content,
    media: u.mediaAsset ? await toMediaDTO(u.mediaAsset) : null,
    published: u.published,
    publishedAt: u.publishedAt?.toISOString() ?? null,
    scheduledFor: u.scheduledFor?.toISOString() ?? null,
    status: liveUpdateStatus(u),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export async function toAlbumDTO(
  a: Album & { _count?: { media: number }; media?: MediaAsset[] },
): Promise<AlbumDTO> {
  const cover = a.media?.[0];
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    description: a.description,
    eventId: a.eventId,
    displayOrder: a.displayOrder,
    isPublished: a.isPublished,
    count: a._count?.media ?? 0,
    cover: cover ? await toMediaDTO(cover) : null,
  };
}

type RoomWithAccommodation = RoomAssignment & { accommodation: Pick<Accommodation, 'name'> };

export function toRoomDTO(room: RoomWithAccommodation): RoomAssignmentDTO {
  return {
    id: room.id,
    rsvpId: room.rsvpId,
    accommodationId: room.accommodationId,
    accommodationName: room.accommodation.name,
    roomNumber: room.roomNumber,
    checkIn: room.checkIn?.toISOString() ?? null,
    checkOut: room.checkOut?.toISOString() ?? null,
    notes: room.notes,
  };
}

export function toAccommodationDTO(a: Accommodation & { _count?: { rooms: number } }): AccommodationDTO {
  return {
    id: a.id,
    name: a.name,
    address: a.address,
    mapsUrl: a.mapsUrl,
    contactName: a.contactName,
    contactPhone: a.contactPhone,
    notes: a.notes,
    displayOrder: a.displayOrder,
    roomsAssigned: a._count?.rooms ?? 0,
  };
}

export function toContactDTO(c: Contact & { event?: Pick<Event, 'id' | 'name' | 'slug'> | null }): ContactDTO {
  return {
    id: c.id,
    name: c.name,
    role: c.role,
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    notes: c.notes,
    eventId: c.eventId,
    event: c.event ? { id: c.event.id, name: c.event.name, slug: c.event.slug } : null,
    isPublic: c.isPublic,
    displayOrder: c.displayOrder,
  };
}

export function toRsvpDTO(
  r: Rsvp & { events: (RsvpEvent & { event: Pick<Event, 'id' | 'name' | 'slug'> })[]; rooms?: RoomWithAccommodation[] },
): RsvpDTO {
  return {
    id: r.id,
    guestName: r.guestName,
    phone: r.phone,
    email: r.email,
    numberOfGuests: r.numberOfGuests,
    side: r.side,
    rooms: (r.rooms ?? []).map(toRoomDTO),
    attendanceStatus: r.attendanceStatus,
    message: r.message,
    events: r.events.map((e) => ({ id: e.event.id, name: e.event.name, slug: e.event.slug })),
    submittedAt: r.submittedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function toGuestbookDTO(g: GuestbookMessage & { mediaAsset?: MediaAsset | null }): Promise<GuestbookDTO> {
  return {
    id: g.id,
    guestName: g.guestName,
    message: g.message,
    media: g.mediaAsset ? await toMediaDTO(g.mediaAsset) : null,
    status: g.status,
    createdAt: g.createdAt.toISOString(),
  };
}

export async function toStoryDTO(s: StorySection & { mediaAsset?: MediaAsset | null }): Promise<StorySectionDTO> {
  return {
    id: s.id,
    key: s.key,
    eyebrow: s.eyebrow,
    title: s.title,
    body: s.body,
    media: s.mediaAsset ? await toMediaDTO(s.mediaAsset) : null,
    mediaAssetId: s.mediaAssetId,
    displayOrder: s.displayOrder,
    isPublished: s.isPublished,
  };
}

export function toTravelDTO(t: TravelSection): TravelSectionDTO {
  return {
    id: t.id,
    category: t.category,
    title: t.title,
    body: t.body,
    links: Array.isArray(t.links) ? (t.links as unknown as LinkItem[]) : [],
    displayOrder: t.displayOrder,
    isPublished: t.isPublished,
  };
}

export function toFaqDTO(f: FaqItem): FaqDTO {
  return {
    id: f.id,
    question: f.question,
    answer: f.answer,
    displayOrder: f.displayOrder,
    isPublished: f.isPublished,
  };
}
