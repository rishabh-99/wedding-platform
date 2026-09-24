import { Router } from 'express';
import {
  albumsAdminController as albums,
  authController as auth,
  backupAdminController as backups,
  contactsAdminController as contacts,
  roomsAdminController as rooms,
  dashboardController as dashboard,
  eventsAdminController as events,
  faqAdminController as faq,
  guestbookAdminController as guestbook,
  liveAdminController as live,
  mediaAdminController as media,
  rsvpAdminController as rsvps,
  settingsAdminController as settings,
  storyAdminController as story,
  travelAdminController as travel,
  venuesAdminController as venues,
} from '../controllers/admin.controller';
import { staffController as staff, teamController as team } from '../controllers/staff.controller';
import { asyncHandler as h } from '../lib/errors';
import { requireAuth, requireCsrf, requirePermission as allow } from '../middleware/auth';
import { loginLimiter, uploadLimiter } from '../middleware/rateLimit';
import { adminUpload, portraitUpload } from '../middleware/upload';

/**
 * Staff API. Every route below login requires a session; each is further
 * limited by capability (ROLE_PERMISSIONS in @wedding/shared):
 *   ADMIN everything · EDITOR content · COORDINATOR check-in ·
 *   HOSPITALITY guests/rooms/arrivals · PHOTOGRAPHER portraits/gallery.
 */
export const adminRouter = Router();

// Staff API responses are private and must never be cached.
adminRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

adminRouter.post('/auth/login', loginLimiter, h(auth.login));

// Everything below requires a valid session + CSRF token on mutations.
adminRouter.use(requireAuth, requireCsrf);

adminRouter.get('/auth/me', h(auth.me));
adminRouter.post('/auth/logout', h(auth.logout));
adminRouter.post('/auth/password', h(auth.changePassword));

adminRouter.get('/dashboard', h(dashboard.get));

// Read-only lookups every staff member needs (event pickers, venue names).
adminRouter.get('/events', h(events.list));
adminRouter.get('/venues', h(venues.list));
adminRouter.get('/settings', h(settings.get));

// Schedule & venues — admins
adminRouter.post('/events', allow('events'), h(events.create));
adminRouter.post('/events/reorder', allow('events'), h(events.reorder));
adminRouter.put('/events/:id', allow('events'), h(events.update));
adminRouter.patch('/events/:id/publish', allow('events'), h(events.publish));
adminRouter.delete('/events/:id', allow('events'), h(events.remove));
adminRouter.post('/venues', allow('events'), h(venues.create));
adminRouter.put('/venues/:id', allow('events'), h(venues.update));
adminRouter.delete('/venues/:id', allow('events'), h(venues.remove));

// Live updates — editors, coordinators, photographers
adminRouter.get('/live', allow('live'), h(live.list));
adminRouter.post('/live', allow('live'), h(live.create));
adminRouter.put('/live/:id', allow('live'), h(live.update));
adminRouter.patch('/live/:id/publish', allow('live'), h(live.publish));
adminRouter.delete('/live/:id', allow('live'), h(live.remove));

// Media & gallery — editors and photographers (live posters can upload their photo)
adminRouter.get('/media', allow('gallery'), h(media.list));
adminRouter.post('/media', allow('gallery', 'live', 'content'), uploadLimiter, adminUpload.array('files', 20), h(media.upload));
adminRouter.post('/media/reorder', allow('gallery'), h(media.reorder));
adminRouter.patch('/media/:id', allow('gallery'), h(media.update));
adminRouter.delete('/media/:id', allow('gallery', 'content'), h(media.remove));

adminRouter.get('/albums', allow('gallery'), h(albums.list));
adminRouter.post('/albums', allow('gallery'), h(albums.create));
adminRouter.post('/albums/reorder', allow('gallery'), h(albums.reorder));
adminRouter.put('/albums/:id', allow('gallery'), h(albums.update));
adminRouter.delete('/albums/:id', allow('events'), h(albums.remove));

// Guests (RSVPs) — read for hospitality & coordinators, edit/delete for admins
adminRouter.get('/rsvps', allow('guests'), h(rsvps.list));
adminRouter.get('/rsvps/export.xlsx', allow('guests'), h(rsvps.exportXlsx));
adminRouter.put('/rsvps/:id', allow('guestsEdit'), h(rsvps.update));
adminRouter.delete('/rsvps/:id', allow('guestsEdit'), h(rsvps.remove));

// Rooms — hospitality
adminRouter.get('/accommodations', allow('rooms'), h(rooms.accommodations));
adminRouter.post('/accommodations', allow('rooms'), h(rooms.createAccommodation));
adminRouter.put('/accommodations/:id', allow('rooms'), h(rooms.updateAccommodation));
adminRouter.delete('/accommodations/:id', allow('events'), h(rooms.removeAccommodation));
adminRouter.get('/rooms', allow('rooms'), h(rooms.board));
adminRouter.post('/rooms', allow('rooms'), h(rooms.assign));
adminRouter.put('/rooms/:id', allow('rooms'), h(rooms.updateRoom));
adminRouter.delete('/rooms/:id', allow('rooms'), h(rooms.removeRoom));

// Arrivals & pickups — hospitality
adminRouter.get('/arrivals', allow('arrivals'), h(staff.arrivals));
adminRouter.put('/arrivals/:id', allow('arrivals'), h(staff.updateTravel));

// Guest pass lookup (QR) — anyone working the event
adminRouter.get('/pass/:token', allow('checkin', 'portraits', 'rooms'), h(staff.lookup));
adminRouter.get('/guests/:id', allow('checkin', 'portraits', 'rooms'), h(staff.guest));

// Check-in & follow-up calls — coordinators & hospitality
adminRouter.get('/checkin', allow('checkin'), h(staff.checkInBoard));
adminRouter.post('/checkin', allow('checkin'), h(staff.checkIn));
adminRouter.delete('/checkin/:rsvpId/:eventId', allow('checkin'), h(staff.undoCheckIn));
adminRouter.put('/followup', allow('checkin'), h(staff.followUp));

// Photo of the day — photographers
adminRouter.get('/portraits', allow('portraits'), h(staff.portraitBoard));
adminRouter.post('/portraits', allow('portraits'), uploadLimiter, portraitUpload.single('photo'), h(staff.savePortrait));
adminRouter.delete('/portraits/:rsvpId/:day', allow('portraits'), h(staff.removePortrait));

// Contacts — editors & hospitality
adminRouter.get('/contacts', allow('contacts'), h(contacts.list));
adminRouter.post('/contacts', allow('contacts'), h(contacts.create));
adminRouter.put('/contacts/:id', allow('contacts'), h(contacts.update));
adminRouter.delete('/contacts/:id', allow('contacts'), h(contacts.remove));

// Guestbook & editorial content — editors
adminRouter.get('/guestbook', allow('guestbook'), h(guestbook.list));
adminRouter.patch('/guestbook/:id', allow('guestbook'), h(guestbook.update));
adminRouter.delete('/guestbook/:id', allow('guestbook'), h(guestbook.remove));

for (const [path, ctl] of [
  ['story', story],
  ['travel', travel],
  ['faq', faq],
] as const) {
  adminRouter.get(`/${path}`, allow('content'), h(ctl.list));
  adminRouter.post(`/${path}`, allow('content'), h(ctl.create));
  adminRouter.put(`/${path}/:id`, allow('content'), h(ctl.update));
  adminRouter.delete(`/${path}/:id`, allow('content'), h(ctl.remove));
}

// Admin only
adminRouter.put('/settings', allow('settings'), h(settings.update));
adminRouter.get('/team', allow('team'), h(team.list));
adminRouter.post('/team', allow('team'), h(team.create));
adminRouter.put('/team/:id', allow('team'), h(team.update));
adminRouter.delete('/team/:id', allow('team'), h(team.remove));
adminRouter.get('/backups', allow('backups'), h(backups.list));
adminRouter.post('/backups', allow('backups'), h(backups.create));
adminRouter.get('/backups/:filename', allow('backups'), h(backups.download));
