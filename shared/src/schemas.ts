import { z } from 'zod';

/** Validation schemas shared by the API (server-side enforcement) and forms (client-side UX). */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null))
    .pipe(z.string().max(max).nullable());

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date/time' });

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), { message: 'Must start with http:// or https://' });

const optionalUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null))
  .pipe(safeUrl.nullable());

export const attendanceStatusSchema = z.enum(['ATTENDING', 'MAYBE', 'DECLINED']);
export const guestSideSchema = z.enum(['BRIDE', 'GROOM'], {
  errorMap: () => ({ message: 'Please tell us whose side you are from' }),
});

export const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Please enter a valid phone number')
  .max(20, 'Please enter a valid phone number')
  .regex(/^\+?[\d\s()-]{7,20}$/, 'Please enter a valid phone number');

export const rsvpInputSchema = z
  .object({
    guestName: trimmed(120).min(2, 'Please tell us your name'),
    phone: phoneSchema,
    email: z
      .union([z.literal(''), z.string().trim().toLowerCase().email('Please enter a valid email').max(200)])
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    numberOfGuests: z.coerce
      .number({ invalid_type_error: 'Please enter a number' })
      .int()
      .min(1, 'At least one guest')
      .max(20, 'Please contact us for parties larger than 20'),
    // Required, but checked in superRefine so every missing field is reported together.
    side: guestSideSchema.nullish(),
    attendanceStatus: attendanceStatusSchema,
    eventIds: z.array(z.string().min(1).max(64)).max(50).default([]),
    message: optionalText(1000),
    idempotencyKey: z.string().max(64).optional(),
    /** Honeypot: must stay empty. */
    website: z.string().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.side) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['side'], message: 'Please tell us whose side you are from' });
    }
    if (val.attendanceStatus !== 'DECLINED' && val.eventIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventIds'],
        message: 'Please choose at least one celebration',
      });
    }
  });
export type RsvpInput = z.input<typeof rsvpInputSchema>;
export type RsvpParsed = z.output<typeof rsvpInputSchema>;

export const rsvpAdminUpdateSchema = z.object({
  guestName: trimmed(120).min(2),
  phone: phoneSchema,
  email: z
    .union([z.literal(''), z.string().trim().toLowerCase().email().max(200)])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  numberOfGuests: z.coerce.number().int().min(0).max(50),
  side: guestSideSchema.nullable().optional().transform((v) => v ?? null),
  attendanceStatus: attendanceStatusSchema,
  eventIds: z.array(z.string().min(1).max(64)).max(50),
  message: optionalText(1000),
});

export const guestbookInputSchema = z.object({
  guestName: trimmed(120).min(2, 'Please tell us your name'),
  message: trimmed(1500).min(2, 'Please write a few words'),
  mediaAssetId: z.string().max(64).optional().nullable(),
  website: z.string().max(500).optional(),
});

export const guestbookAdminUpdateSchema = z.object({
  guestName: trimmed(120).min(2).optional(),
  message: trimmed(1500).min(2).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12, 'Use at least 12 characters').max(200),
});

export const paletteSchema = z
  .array(
    z.object({
      name: trimmed(40).min(1),
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #6B1E2A'),
    }),
  )
  .max(12);

export const eventInputSchema = z.object({
  name: trimmed(120).min(2),
  slug: slugSchema,
  description: optionalText(5000),
  startDateTime: isoDate,
  endDateTime: isoDate.nullable().optional().transform((v) => v ?? null),
  venueId: z.string().max(64).nullable().optional().transform((v) => v || null),
  dressCode: optionalText(200),
  dressCodeDescription: optionalText(3000),
  dressPalette: paletteSchema.default([]),
  helpfulInfo: optionalText(3000),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  status: z.enum(['SCHEDULED', 'POSTPONED', 'CANCELLED']).default('SCHEDULED'),
  isPublished: z.boolean().default(true),
}).refine((v) => !v.endDateTime || Date.parse(v.endDateTime) >= Date.parse(v.startDateTime), {
  message: 'End time must be after the start time',
  path: ['endDateTime'],
});
export type EventInput = z.input<typeof eventInputSchema>;

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(500),
});

export const venueInputSchema = z.object({
  name: trimmed(160).min(2),
  address: optionalText(500),
  mapsUrl: optionalUrl,
  description: optionalText(3000),
  parkingInformation: optionalText(2000),
  nearbyLandmarks: optionalText(2000),
  transportInformation: optionalText(2000),
  contactInformation: optionalText(1000),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
});

export const liveUpdateInputSchema = z.object({
  eventId: z.string().max(64).nullable().optional().transform((v) => v || null),
  type: z.enum(['TEXT', 'PHOTO', 'VIDEO', 'ANNOUNCEMENT']).default('TEXT'),
  title: optionalText(200),
  content: trimmed(4000).min(1, 'Write a caption or message'),
  mediaAssetId: z.string().max(64).nullable().optional().transform((v) => v || null),
  /** 'publish' = publish now, 'schedule' = publish at scheduledFor, 'draft' = keep hidden. */
  action: z.enum(['publish', 'schedule', 'draft']).default('publish'),
  scheduledFor: isoDate.nullable().optional().transform((v) => v ?? null),
}).refine((v) => v.action !== 'schedule' || !!v.scheduledFor, {
  message: 'Choose when to publish',
  path: ['scheduledFor'],
});
export type LiveUpdateInput = z.input<typeof liveUpdateInputSchema>;

export const albumInputSchema = z.object({
  name: trimmed(120).min(2),
  slug: slugSchema,
  description: optionalText(1000),
  eventId: z.string().max(64).nullable().optional().transform((v) => v || null),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  isPublished: z.boolean().default(true),
});

export const mediaUpdateSchema = z.object({
  caption: optionalText(500).optional(),
  eventId: z.string().max(64).nullable().optional(),
  albumId: z.string().max(64).nullable().optional(),
  isPublished: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(100000).optional(),
});

export const storySectionInputSchema = z.object({
  key: slugSchema,
  eyebrow: optionalText(80),
  title: trimmed(200).min(1),
  body: trimmed(8000).min(1),
  mediaAssetId: z.string().max(64).nullable().optional().transform((v) => v || null),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  isPublished: z.boolean().default(true),
});

export const travelSectionInputSchema = z.object({
  category: trimmed(60).min(1),
  title: trimmed(200).min(1),
  body: trimmed(8000).min(1),
  links: z.array(z.object({ label: trimmed(80).min(1), url: safeUrl })).max(10).default([]),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  isPublished: z.boolean().default(true),
});

export const faqInputSchema = z.object({
  question: trimmed(300).min(3),
  answer: trimmed(5000).min(1),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  isPublished: z.boolean().default(true),
});

export const settingsInputSchema = z.object({
  coupleName1: trimmed(80).min(1),
  coupleName2: trimmed(80).min(1),
  familiesLine: trimmed(200).min(1),
  inviteLine: trimmed(200).min(1),
  welcomeMessage: trimmed(3000),
  weddingDatesLabel: trimmed(120).min(1),
  weddingHashtag: optionalText(80),
  timezone: trimmed(60).refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown timezone'),
  contactPhone: optionalText(40),
  contactWhatsapp: optionalText(40),
  contactEmail: z
    .union([z.literal(''), z.string().trim().email().max(200), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  whatsappGroupUrl: optionalUrl.optional().transform((v) => v ?? null),
  siteTitle: trimmed(160).min(1),
  siteDescription: trimmed(400).min(1),
  sections: z.object({
    story: z.boolean(),
    rsvp: z.boolean(),
    gallery: z.boolean(),
    guestbook: z.boolean(),
    travel: z.boolean(),
    faq: z.boolean(),
    dressCode: z.boolean(),
    concierge: z.boolean(),
  }),
  liveMode: z.enum(['AUTO', 'ON', 'OFF']),
  liveBannerText: trimmed(200).min(1),
  archiveHeadline: trimmed(200).min(1),
  archiveSubheadline: trimmed(200).min(1),
  logoAssetId: z.string().max(64).nullable().optional().transform((v) => v || null),
  ogImageAssetId: z.string().max(64).nullable().optional().transform((v) => v || null),
});
export type SettingsInput = z.input<typeof settingsInputSchema>;

export const accommodationInputSchema = z.object({
  name: trimmed(160).min(2),
  address: optionalText(500),
  mapsUrl: optionalUrl,
  contactName: optionalText(120),
  contactPhone: optionalText(40),
  notes: optionalText(2000),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
});

const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null))
  .pipe(isoDate.nullable());

export const roomAssignmentInputSchema = z
  .object({
    rsvpId: z.string().min(1).max(64),
    accommodationId: z.string().min(1, 'Choose where the room is').max(64),
    roomNumber: trimmed(40).min(1, 'Enter a room number'),
    checkIn: optionalDate,
    checkOut: optionalDate,
    notes: optionalText(500),
  })
  .refine((v) => !v.checkIn || !v.checkOut || Date.parse(v.checkOut) >= Date.parse(v.checkIn), {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });

export const contactInputSchema = z
  .object({
    name: trimmed(120).min(2),
    role: trimmed(120).min(2, 'e.g. Event Manager'),
    phone: optionalText(40),
    whatsapp: optionalText(40),
    email: z
      .union([z.literal(''), z.string().trim().email().max(200), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    notes: optionalText(1000),
    eventId: z.string().max(64).nullable().optional().transform((v) => v || null),
    isPublic: z.boolean().default(true),
    displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .refine((v) => v.phone || v.whatsapp || v.email, { message: 'Add at least a phone, WhatsApp or email', path: ['phone'] });

export const rsvpListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: attendanceStatusSchema.optional(),
  side: guestSideSchema.optional(),
  accommodationId: z.string().max(64).optional(),
  needsRoom: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
  eventId: z.string().max(64).optional(),
  sort: z.enum(['submittedAt', 'guestName', 'numberOfGuests', 'attendanceStatus']).default('submittedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const mediaListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
  eventId: z.string().max(64).optional(),
  albumId: z.string().max(64).optional(),
  purpose: z.enum(['GALLERY', 'LIVE', 'GUESTBOOK', 'BRANDING', 'DRESSCODE', 'STORY']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(60),
});
