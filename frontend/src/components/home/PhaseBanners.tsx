import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatLongDate, formatTime, type EventDTO, type SettingsDTO } from '@wedding/shared';
import { Countdown } from '../events/Countdown';
import { OrnamentDivider, Rosette } from '../ornaments/Ornaments';
import { LiveBadge } from '../ui/primitives';

/** Slim maroon ribbon shown across the site while the celebrations are live. */
export function LiveRibbon({ text }: { text: string }) {
  return (
    <Link
      to="/now"
      className="block bg-maroon text-ivory"
      aria-label={`Live: ${text}. Open what’s happening now`}
    >
      <div className="container-page flex min-h-[44px] items-center justify-center gap-3 py-2 text-center">
        <span className="live-dot bg-gold-light" aria-hidden="true" />
        <span className="font-label text-[0.68rem] uppercase tracking-label">Live</span>
        <span className="h-3 w-px bg-gold-light/60" aria-hidden="true" />
        <span className="font-label text-[0.68rem] uppercase tracking-label text-gold-pale">{text}</span>
      </div>
    </Link>
  );
}

/** Hero for the post-wedding archive. */
export function ArchiveHero({ settings }: { settings: SettingsDTO }) {
  return (
    <section className="relative overflow-hidden border-b border-gold/20 bg-ivory-100/50 py-20 text-center sm:py-28" aria-labelledby="archive-title">
      <Rosette aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-[120vw] max-w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-[0.08]" />
      <div className="container-page relative">
        <p className="label">The Wedding Archive</p>
        <motion.h1
          id="archive-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="heading-xl mx-auto mt-5 max-w-3xl italic"
        >
          {settings.archiveHeadline}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-5 font-display text-2xl italic text-gold-deep sm:text-3xl"
        >
          {settings.archiveSubheadline}
        </motion.p>
        <OrnamentDivider className="mx-auto mt-8" />
        <nav aria-label="Archive" className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/journal" className="btn-outline">The wedding journal</Link>
          <Link to="/gallery" className="btn-outline">The wedding album</Link>
          <Link to="/blessings" className="btn-outline">Blessings</Link>
          <Link to="/story" className="btn-outline">Our story</Link>
        </nav>
      </div>
    </section>
  );
}

/** "Next celebration" with a live countdown — consumes the shared schedule engine's `next`. */
export function NextCelebration({ event, now, timeZone, isLive }: { event: EventDTO; now: Date; timeZone: string; isLive: boolean }) {
  return (
    <section className="section border-y border-gold/20 bg-ivory-50/60" aria-labelledby="next-title">
      <div className="container-page text-center">
        <p className="label">{isLive ? 'Next, still to come' : 'Next celebration'}</p>
        <h2 id="next-title" className="mt-4 break-words font-display text-[2.35rem] font-medium uppercase leading-tight tracking-[0.04em] text-maroon sm:text-6xl sm:tracking-[0.06em]">
          {event.name}
        </h2>
        <p className="mt-4 font-label text-[0.8rem] uppercase tracking-label text-ink">
          {formatLongDate(event.startDateTime, timeZone)}
        </p>
        <p className="mt-1 font-display text-xl italic text-ink-soft">{formatTime(event.startDateTime, timeZone)}</p>
        <div className="mt-10">
          <Countdown target={event.startDateTime} now={now} />
        </div>
        <Link to={`/celebrations/${event.slug}`} className="btn-outline mt-10">
          View details
        </Link>
      </div>
    </section>
  );
}

export function LiveHeading() {
  return (
    <div className="mb-8 text-center">
      <LiveBadge />
      <p className="mt-3 font-display text-3xl text-maroon sm:text-4xl">The celebrations have begun</p>
    </div>
  );
}
