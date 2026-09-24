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
import { asyncHandler as h } from '../lib/errors';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth';
import { loginLimiter, uploadLimiter } from '../middleware/rateLimit';
import { adminUpload } from '../middleware/upload';

export const adminRouter = Router();

// Admin API responses are private and must never be cached.
adminRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

adminRouter.post('/auth/login', loginLimiter, h(auth.login));

// Everything below requires a valid session + CSRF token on mutations.
adminRouter.use(requireAuth, requireCsrf);

const adminOnly = requireRole('ADMIN');

adminRouter.get('/auth/me', h(auth.me));
adminRouter.post('/auth/logout', h(auth.logout));
adminRouter.post('/auth/password', h(auth.changePassword));

adminRouter.get('/dashboard', h(dashboard.get));

adminRouter.get('/events', h(events.list));
adminRouter.post('/events', adminOnly, h(events.create));
adminRouter.post('/events/reorder', adminOnly, h(events.reorder));
adminRouter.put('/events/:id', adminOnly, h(events.update));
adminRouter.patch('/events/:id/publish', adminOnly, h(events.publish));
adminRouter.delete('/events/:id', adminOnly, h(events.remove));

adminRouter.get('/venues', h(venues.list));
adminRouter.post('/venues', adminOnly, h(venues.create));
adminRouter.put('/venues/:id', adminOnly, h(venues.update));
adminRouter.delete('/venues/:id', adminOnly, h(venues.remove));

adminRouter.get('/live', h(live.list));
adminRouter.post('/live', h(live.create));
adminRouter.put('/live/:id', h(live.update));
adminRouter.patch('/live/:id/publish', h(live.publish));
adminRouter.delete('/live/:id', h(live.remove));

adminRouter.get('/media', h(media.list));
adminRouter.post('/media', uploadLimiter, adminUpload.array('files', 20), h(media.upload));
adminRouter.post('/media/reorder', h(media.reorder));
adminRouter.patch('/media/:id', h(media.update));
adminRouter.delete('/media/:id', h(media.remove));

adminRouter.get('/albums', h(albums.list));
adminRouter.post('/albums', h(albums.create));
adminRouter.post('/albums/reorder', h(albums.reorder));
adminRouter.put('/albums/:id', h(albums.update));
adminRouter.delete('/albums/:id', adminOnly, h(albums.remove));

adminRouter.get('/rsvps', adminOnly, h(rsvps.list));
adminRouter.get('/rsvps/export.xlsx', adminOnly, h(rsvps.exportXlsx));
adminRouter.put('/rsvps/:id', adminOnly, h(rsvps.update));
adminRouter.delete('/rsvps/:id', adminOnly, h(rsvps.remove));

// Guest accommodation & room allotment (hospitality team: admins and editors)
adminRouter.get('/accommodations', h(rooms.accommodations));
adminRouter.post('/accommodations', h(rooms.createAccommodation));
adminRouter.put('/accommodations/:id', h(rooms.updateAccommodation));
adminRouter.delete('/accommodations/:id', adminOnly, h(rooms.removeAccommodation));
adminRouter.get('/rooms', h(rooms.board));
adminRouter.post('/rooms', h(rooms.assign));
adminRouter.put('/rooms/:id', h(rooms.updateRoom));
adminRouter.delete('/rooms/:id', h(rooms.removeRoom));

adminRouter.get('/contacts', h(contacts.list));
adminRouter.post('/contacts', h(contacts.create));
adminRouter.put('/contacts/:id', h(contacts.update));
adminRouter.delete('/contacts/:id', h(contacts.remove));

adminRouter.get('/guestbook', h(guestbook.list));
adminRouter.patch('/guestbook/:id', h(guestbook.update));
adminRouter.delete('/guestbook/:id', h(guestbook.remove));

for (const [path, ctl] of [
  ['story', story],
  ['travel', travel],
  ['faq', faq],
] as const) {
  adminRouter.get(`/${path}`, h(ctl.list));
  adminRouter.post(`/${path}`, h(ctl.create));
  adminRouter.put(`/${path}/:id`, h(ctl.update));
  adminRouter.delete(`/${path}/:id`, h(ctl.remove));
}

adminRouter.get('/settings', h(settings.get));
adminRouter.put('/settings', adminOnly, h(settings.update));

adminRouter.get('/backups', adminOnly, h(backups.list));
adminRouter.post('/backups', adminOnly, h(backups.create));
adminRouter.get('/backups/:filename', adminOnly, h(backups.download));
