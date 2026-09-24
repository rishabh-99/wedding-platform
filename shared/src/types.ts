/** API contract types shared by backend and frontend. */
import type { ScheduleResult, LiveModeSetting } from './schedule';

export type Role = 'ADMIN' | 'EDITOR';
export type EventStatus = 'SCHEDULED' | 'POSTPONED' | 'CANCELLED';
export type MediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type MediaPurpose = 'GALLERY' | 'LIVE' | 'GUESTBOOK' | 'BRANDING' | 'DRESSCODE' | 'STORY';
export type LiveUpdateType = 'TEXT' | 'PHOTO' | 'VIDEO' | 'ANNOUNCEMENT';
export type LiveUpdateStatus = 'PUBLISHED' | 'SCHEDULED' | 'DRAFT';
export type AttendanceStatus = 'ATTENDING' | 'MAYBE' | 'DECLINED';
export type GuestbookStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type GuestSide = 'BRIDE' | 'GROOM';

export const SIDE_LABELS: Record<GuestSide, string> = {
  BRIDE: 'Bride’s side',
  GROOM: 'Groom’s side',
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  ATTENDING: 'Attending',
  MAYBE: 'Maybe',
  DECLINED: 'Unable to attend',
};

export interface SectionToggles {
  story: boolean;
  rsvp: boolean;
  gallery: boolean;
  guestbook: boolean;
  travel: boolean;
  faq: boolean;
  dressCode: boolean;
  concierge: boolean;
}

export const DEFAULT_SECTIONS: SectionToggles = {
  story: true,
  rsvp: true,
  gallery: true,
  guestbook: true,
  travel: true,
  faq: true,
  dressCode: true,
  concierge: true,
};

export interface MediaUrls {
  thumb: string;
  medium: string;
  original: string;
}

export interface MediaDTO {
  id: string;
  type: MediaType;
  purpose: MediaPurpose;
  mimeType: string;
  originalFilename: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  caption: string | null;
  eventId: string | null;
  albumId: string | null;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  urls: MediaUrls;
  /** Tiny base64 placeholder for progressive loading. */
  placeholder: string | null;
  /** Admin-only: where the object lives. */
  storageKey?: string;
  storageDriver?: string;
  event?: { id: string; name: string; slug: string } | null;
}

export interface VenueDTO {
  id: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  description: string | null;
  parkingInformation: string | null;
  nearbyLandmarks: string | null;
  transportInformation: string | null;
  contactInformation: string | null;
  displayOrder: number;
}

export interface PaletteColour {
  name: string;
  hex: string;
}

export interface EventDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startDateTime: string;
  endDateTime: string | null;
  venueId: string | null;
  venue: VenueDTO | null;
  dressCode: string | null;
  dressCodeDescription: string | null;
  dressPalette: PaletteColour[];
  helpfulInfo: string | null;
  displayOrder: number;
  status: EventStatus;
  isPublished: boolean;
  dressReferenceImages?: MediaDTO[];
}

export type EventSummary = Pick<EventDTO, 'id' | 'name' | 'slug'>;

export interface LiveUpdateDTO {
  id: string;
  eventId: string | null;
  event: EventSummary | null;
  type: LiveUpdateType;
  title: string | null;
  content: string;
  media: MediaDTO | null;
  published: boolean;
  publishedAt: string | null;
  scheduledFor: string | null;
  status: LiveUpdateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  eventId: string | null;
  displayOrder: number;
  isPublished: boolean;
  count: number;
  cover: MediaDTO | null;
}

export interface SettingsDTO {
  coupleName1: string;
  coupleName2: string;
  familiesLine: string;
  inviteLine: string;
  welcomeMessage: string;
  weddingDatesLabel: string;
  weddingHashtag: string | null;
  timezone: string;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
  whatsappGroupUrl: string | null;
  siteTitle: string;
  siteDescription: string;
  sections: SectionToggles;
  liveMode: LiveModeSetting;
  liveBannerText: string;
  archiveHeadline: string;
  archiveSubheadline: string;
  logoUrl: string | null;
  ogImageUrl: string | null;
  logoAssetId: string | null;
  ogImageAssetId: string | null;
}

export type ScheduleDTO = ScheduleResult<EventDTO> & { serverTime: string; timezone: string };

export interface RsvpDTO {
  id: string;
  guestName: string;
  phone: string;
  email: string | null;
  numberOfGuests: number;
  side: GuestSide | null;
  attendanceStatus: AttendanceStatus;
  message: string | null;
  events: EventSummary[];
  rooms: RoomAssignmentDTO[];
  submittedAt: string;
  updatedAt: string;
}

export interface AccommodationDTO {
  id: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  displayOrder: number;
  roomsAssigned: number;
}

export interface RoomAssignmentDTO {
  id: string;
  rsvpId: string;
  accommodationId: string;
  accommodationName: string;
  roomNumber: string;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
  /** Other parties already in the same room (shared rooms are allowed, but flagged). */
  sharedWith?: string[];
}

export interface RoomBoardDTO {
  accommodations: (AccommodationDTO & { rooms: (RoomAssignmentDTO & { guestName: string; numberOfGuests: number; side: GuestSide | null })[] })[];
  unassigned: { id: string; guestName: string; numberOfGuests: number; side: GuestSide | null; attendanceStatus: AttendanceStatus }[];
}

export interface ContactDTO {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  eventId: string | null;
  event: EventSummary | null;
  isPublic: boolean;
  displayOrder: number;
}

export interface RsvpSubmitResult {
  id: string;
  updated: boolean;
  guestName: string;
  attendanceStatus: AttendanceStatus;
}

export interface GuestbookDTO {
  id: string;
  guestName: string;
  message: string;
  media: MediaDTO | null;
  status: GuestbookStatus;
  createdAt: string;
}

export interface StorySectionDTO {
  id: string;
  key: string;
  eyebrow: string | null;
  title: string;
  body: string;
  media: MediaDTO | null;
  mediaAssetId: string | null;
  displayOrder: number;
  isPublished: boolean;
}

export interface LinkItem {
  label: string;
  url: string;
}

export interface TravelSectionDTO {
  id: string;
  category: string;
  title: string;
  body: string;
  links: LinkItem[];
  displayOrder: number;
  isPublished: boolean;
}

export interface FaqDTO {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isPublished: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface DashboardDTO {
  liveNow: EventSummary | null;
  nextEvent: EventSummary & { startDateTime: string } | null;
  phase: string;
  counts: {
    events: number;
    rsvps: number;
    confirmedGuests: number;
    maybeGuests: number;
    declined: number;
    confirmedResponses: number;
    maybeResponses: number;
    totalGuests: number;
    photos: number;
    videos: number;
    livePosts: number;
    guestbookTotal: number;
    pendingGuestbook: number;
  };
  attendancePerEvent: { eventId: string; name: string; responses: number; guests: number }[];
  sides: { side: GuestSide | null; responses: number; guests: number }[];
  rooms: { assigned: number; partiesNeedingRooms: number };
  recentRsvps: RsvpDTO[];
}

export interface BackupDTO {
  key: string;
  filename: string;
  size: number;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type RealtimeEventType =
  | 'LIVE_UPDATE_CREATED'
  | 'LIVE_UPDATE_UPDATED'
  | 'LIVE_UPDATE_DELETED'
  | 'SCHEDULE_CHANGED'
  | 'MEDIA_PUBLISHED'
  | 'SETTINGS_CHANGED';

export interface RealtimeMessage {
  id: number;
  type: RealtimeEventType;
  eventId: string | null;
  postId: string | null;
  timestamp: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
