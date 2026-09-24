import { Router } from 'express';
import { publicController as c } from '../controllers/public.controller';
import { asyncHandler as h } from '../lib/errors';
import { guestbookLimiter, rsvpLimiter } from '../middleware/rateLimit';
import { guestUpload } from '../middleware/upload';
import { broker } from '../realtime/sseBroker';

export const publicRouter = Router();

publicRouter.get('/settings', h(c.settings));
publicRouter.get('/schedule', h(c.schedule));
publicRouter.get('/events', h(c.events));
publicRouter.get('/events/calendar.ics', h(c.eventIcs));
publicRouter.get('/events/:slug', h(c.event));
publicRouter.get('/events/:slug/calendar.ics', h(c.eventIcs));
publicRouter.get('/venues', h(c.venues));

publicRouter.get('/live/stream', broker.handle);
publicRouter.get('/live', h(c.live));
publicRouter.get('/live/:id', h(c.liveOne));

publicRouter.get('/albums', h(c.albums));
publicRouter.get('/gallery', h(c.gallery));

publicRouter.post('/rsvp', rsvpLimiter, h(c.submitRsvp));

publicRouter.get('/guestbook', h(c.guestbook));
publicRouter.post('/guestbook', guestbookLimiter, guestUpload.single('photo'), h(c.submitGuestbook));

publicRouter.get('/story', h(c.story));
publicRouter.get('/travel', h(c.travel));
publicRouter.get('/faq', h(c.faq));
publicRouter.get('/contacts', h(c.contacts));
