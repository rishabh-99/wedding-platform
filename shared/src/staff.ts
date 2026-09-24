import { z } from 'zod';
import type { AttendanceStatus, EventSummary, GuestSide, MediaDTO, RoomAssignmentDTO, Role, ContactDTO } from './types';

/**
 * Staff roles, guest portal, check-in, photographer coverage, arrivals/pickups and push.
 * Shared by backend (enforcement) and frontend (navigation + forms).
 */

// ── Roles & permissions ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  EDITOR: 'Content editor',
  COORDINATOR: 'Event coordinator',
  HOSPITALITY: 'Hospitality',
  PHOTOGRAPHER: 'Photographer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Everything, including settings, team and backups.',
  EDITOR: 'Website content: live updates, gallery, story, travel, FAQ, guestbook, contacts.',
  COORDINATOR: 'Event check-in, “needs a call” follow-ups and live updates.',
  HOSPITALITY: 'Guest list, rooms, arrivals & pickups, check-in and contacts.',
  PHOTOGRAPHER: 'Photo of the day coverage, gallery uploads and live photo posts.',
};

export type Permission =
  | 'dashboard'
  | 'content'
  | 'events'
  | 'live'
  | 'gallery'
  | 'guestbook'
  | 'contacts'
  | 'guests'
  | 'guestsEdit'
  | 'rooms'
  | 'arrivals'
  | 'checkin'
  | 'portraits'
  | 'settings'
  | 'team'
  | 'backups';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: ['dashboard', 'content', 'events', 'live', 'gallery', 'guestbook', 'contacts', 'guests', 'guestsEdit', 'rooms', 'arrivals', 'checkin', 'portraits', 'settings', 'team', 'backups'],
  EDITOR: ['dashboard', 'content', 'live', 'gallery', 'guestbook', 'contacts'],
  COORDINATOR: ['dashboard', 'live', 'checkin', 'guests'],
  HOSPITALITY: ['dashboard', 'guests', 'rooms', 'arrivals', 'checkin', 'contacts'],
  PHOTOGRAPHER: ['dashboard', 'portraits', 'gallery', 'live'],
};

export const can = (role: Role | undefined | null, permission: Permission): boolean =>
  !!role && ROLE_PERMISSIONS[role].includes(permission);

export interface TeamUserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const roleSchema = z.enum(['ADMIN', 'EDITOR', 'COORDINATOR', 'HOSPITALITY', 'PHOTOGRAPHER']);
const optionalPhone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : null))
  .pipe(z.string().max(30).nullable());

export const teamUserCreateSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(200),
  role: roleSchema,
  phone: optionalPhone,
  password: z.string().min(10, 'Use at least 10 characters').max(200),
});

export const teamUserUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: roleSchema,
  phone: optionalPhone,
  isActive: z.boolean(),
  /** Optional password reset. */
  password: z
    .union([z.literal(''), z.string().min(10, 'Use at least 10 characters').max(200)])
    .optional()
    .transform((v) => v || undefined),
});

// ── Travel, arrivals & pickups ──────────────────────────────────────────────

export type TravelMode = 'TRAIN' | 'FLIGHT' | 'CAR' | 'BUS' | 'LOCAL' | 'OTHER';
export type TransportStatus = 'NOT_NEEDED' | 'PENDING' | 'ASSIGNED' | 'DONE';
export type FollowUpStatus = 'NEEDS_CALL' | 'CALLED' | 'ON_THE_WAY' | 'NOT_REACHABLE' | 'NOT_COMING';

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  TRAIN: 'Train',
  FLIGHT: 'Flight',
  CAR: 'Own car',
  BUS: 'Bus',
  LOCAL: 'Already in Kanpur',
  OTHER: 'Other',
};

export const TRANSPORT_STATUS_LABELS: Record<TransportStatus, string> = {
  NOT_NEEDED: 'Not needed',
  PENDING: 'To arrange',
  ASSIGNED: 'Driver assigned',
  DONE: 'Done',
};

export const FOLLOW_UP_LABELS: Record<FollowUpStatus, string> = {
  NEEDS_CALL: 'Needs a call',
  CALLED: 'Called',
  ON_THE_WAY: 'On the way',
  NOT_REACHABLE: 'Not reachable',
  NOT_COMING: 'Not coming',
};

const travelModeSchema = z.enum(['TRAIN', 'FLIGHT', 'CAR', 'BUS', 'LOCAL', 'OTHER']);
const transportStatusSchema = z.enum(['NOT_NEEDED', 'PENDING', 'ASSIGNED', 'DONE']);
const optionalDateTime = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : null))
  .pipe(z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date/time').nullable());
const optionalShortText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : null))
    .pipe(z.string().max(max).nullable());

/** What guests fill in about their journey. */
export const guestTravelSchema = z.object({
  arrivalMode: travelModeSchema.nullable().optional().transform((v) => v ?? null),
  arrivalAt: optionalDateTime,
  arrivalDetails: optionalShortText(300),
  pickupNeeded: z.boolean().default(false),
  departureMode: travelModeSchema.nullable().optional().transform((v) => v ?? null),
  departureAt: optionalDateTime,
  departureDetails: optionalShortText(300),
  dropNeeded: z.boolean().default(false),
});
export type GuestTravelInput = z.input<typeof guestTravelSchema>;

/** Hospitality can also set statuses and internal notes (driver, vehicle…). */
export const staffTravelSchema = guestTravelSchema.extend({
  pickupStatus: transportStatusSchema,
  dropStatus: transportStatusSchema,
  transportNotes: optionalShortText(1000),
});
export type StaffTravelInput = z.input<typeof staffTravelSchema>;

export interface TravelDTO {
  arrivalMode: TravelMode | null;
  arrivalAt: string | null;
  arrivalDetails: string | null;
  pickupNeeded: boolean;
  pickupStatus: TransportStatus;
  departureMode: TravelMode | null;
  departureAt: string | null;
  departureDetails: string | null;
  dropNeeded: boolean;
  dropStatus: TransportStatus;
  transportNotes?: string | null;
}

export interface ArrivalRowDTO extends TravelDTO {
  rsvpId: string;
  guestName: string;
  phone: string;
  numberOfGuests: number;
  side: GuestSide | null;
  rooms: RoomAssignmentDTO[];
}

// ── Guest portal ────────────────────────────────────────────────────────────

export const guestLoginSchema = z.object({
  phone: z.string().trim().min(7, 'Enter the phone number you used to RSVP').max(20),
});

export interface GuestPortalDTO {
  rsvpId: string;
  guestName: string;
  phone: string;
  numberOfGuests: number;
  side: GuestSide | null;
  attendanceStatus: AttendanceStatus;
  /** Full URL encoded in the family's QR code. */
  qrUrl: string;
  events: (EventSummary & { startDateTime: string; checkedIn: number | null })[];
  rooms: RoomAssignmentDTO[];
  travel: TravelDTO;
  hospitalityContacts: ContactDTO[];
  /** Photographer's photos of the day — only after the wedding. */
  portraits: { day: string; media: MediaDTO }[];
  portraitsAvailable: boolean;
  uploads: (MediaDTO & { status: 'PENDING' | 'APPROVED' })[];
}

// ── Staff: guest card, check-in, follow-ups, portraits ─────────────────────

export interface StaffGuestCardDTO {
  rsvpId: string;
  qrToken: string;
  guestName: string;
  phone: string;
  numberOfGuests: number;
  side: GuestSide | null;
  attendanceStatus: AttendanceStatus;
  events: (EventSummary & { startDateTime: string; checkedIn: number | null })[];
  rooms: RoomAssignmentDTO[];
  travel: TravelDTO;
  portraitDays: string[];
}

export const checkInSchema = z
  .object({
    rsvpId: z.string().max(64).optional(),
    token: z.string().max(128).optional(),
    eventId: z.string().min(1).max(64),
    count: z.coerce.number().int().min(1).max(50),
    method: z.enum(['QR', 'MANUAL']).default('MANUAL'),
  })
  .refine((v) => v.rsvpId || v.token, { message: 'Choose a guest', path: ['rsvpId'] });

export const followUpSchema = z.object({
  rsvpId: z.string().min(1).max(64),
  eventId: z.string().min(1).max(64),
  status: z.enum(['NEEDS_CALL', 'CALLED', 'ON_THE_WAY', 'NOT_REACHABLE', 'NOT_COMING']),
  note: optionalShortText(500),
});

export interface CheckInRowDTO {
  rsvpId: string;
  guestName: string;
  phone: string;
  numberOfGuests: number;
  side: GuestSide | null;
  attendanceStatus: AttendanceStatus;
  rooms: RoomAssignmentDTO[];
  checkIn: { count: number; checkedInAt: string; method: string; by: string | null } | null;
  followUp: { status: FollowUpStatus; note: string | null; updatedAt: string; by: string | null } | null;
}

export interface CheckInBoardDTO {
  event: EventSummary & { startDateTime: string };
  expectedParties: number;
  expectedGuests: number;
  arrivedParties: number;
  arrivedGuests: number;
  rows: CheckInRowDTO[];
}

export interface PortraitRowDTO {
  rsvpId: string;
  guestName: string;
  phone: string;
  numberOfGuests: number;
  side: GuestSide | null;
  portrait: { media: MediaDTO | null; method: string; by: string | null; at: string } | null;
}

export interface PortraitBoardDTO {
  day: string;
  days: { day: string; label: string }[];
  covered: number;
  total: number;
  rows: PortraitRowDTO[];
}

// ── Web Push ────────────────────────────────────────────────────────────────

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(4).max(200) }),
});
