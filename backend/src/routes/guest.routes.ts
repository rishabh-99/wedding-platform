import { Router } from 'express';
import { guestController as g, pushController as p } from '../controllers/guest.controller';
import { asyncHandler as h } from '../lib/errors';
import { guestLoginLimiter, guestbookLimiter, uploadLimiter } from '../middleware/rateLimit';
import { guestAlbumUpload } from '../middleware/upload';

/** Guest portal (/api/guest) — signed in with the RSVP phone number. */
export const guestRouter = Router();
guestRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
guestRouter.post('/login', guestLoginLimiter, h(g.login));
guestRouter.post('/logout', h(g.logout));
guestRouter.get('/session', h(g.session));
guestRouter.get('/me', h(g.me));
guestRouter.put('/travel', guestbookLimiter, h(g.updateTravel));
guestRouter.post('/photos', uploadLimiter, guestAlbumUpload.array('files', 10), h(g.uploadPhotos));

/** Web Push subscriptions (/api/push) — open to every visitor. */
export const pushRouter = Router();
pushRouter.get('/public-key', h(p.publicKey));
pushRouter.post('/subscribe', guestLoginLimiter, h(p.subscribe));
pushRouter.post('/unsubscribe', h(p.unsubscribe));
