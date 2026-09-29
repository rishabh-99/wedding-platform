import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  formatDayMonth,
  formatTime,
  formatWeekday,
  relativeDayLabel,
  type EventDTO,
  type LiveUpdateDTO,
  type ScheduleResult,
} from '@wedding/shared';
import { FramedCorners } from '../ornaments/Ornaments';
import { LiveBadge } from '../ui/primitives';
import { Countdown } from './Countdown';
import { DirectionsButton } from './DirectionsButton';
import { FILM_WIDTH, sceneForSlug } from '../../film/sceneRegistry';

const EventScene = lazy(() => import('../../film/EventScene'));
const EventArt = lazy(() => import('../../film/EventArt'));

/** The celebration's scene from the invitation film: playing when `play`, otherwise a still. Nothing if it has none. */
function Art({ event, timeZone, play = false, className }: { event: EventDTO; timeZone: string; play?: boolean; className: string }) {
  const scene = sceneForSlug(event.slug);
  if (!scene) return null;
  const fallback = <div className={`skeleton ${className}`} style={{ aspectRatio: `${FILM_WIDTH} / ${scene.crop}` }} />;
  return (
    <Suspense fallback={fallback}>
      {play ? (
        <EventScene event={event} scene={scene} timeZone={timeZone} className={className} />
      ) : (
        <EventArt event={event} scene={scene} timeZone={timeZone} className={className} />
      )}
    </Suspense>
  );
}

interface Props {
  schedule: ScheduleResult<EventDTO>;
  now: Date;
  timeZone: string;
  latestUpdate?: LiveUpdateDTO | null;
  prominent?: boolean;
}

/** How long after it started an event keeps showing as "Just happened". */
const JUST_HAPPENED_WINDOW_MS = 18 * 3600_000;

function whenLabel(event: EventDTO, now: Date, tz: string): string {
  const rel = relativeDayLabel(event.startDateTime, now, tz);
  const day = rel ?? `${formatWeekday(event.startDateTime, tz)}, ${formatDayMonth(event.startDateTime, tz)}`;
  return `${day} · ${formatTime(event.startDateTime, tz)}`;
}

/**
 * The signature "What's Happening Now" panel. Entirely derived from the shared
 * schedule engine: LIVE (current), JUST HAPPENED (previous), UP NEXT and LATER.
 */
export function WhatsHappeningNow({ schedule, now, timeZone: tz, latestUpdate, prominent = false }: Props) {
  const { current, previous, next, later, phase } = schedule;
  const showJustHappened =
    !!previous && !current && now.getTime() - new Date(previous.startDateTime).getTime() < JUST_HAPPENED_WINDOW_MS;

  if (phase === 'archive') {
    return (
      <div className="card-paper px-6 py-10 text-center" data-testid="whn-archive">
        <p className="label">The celebrations</p>
        <p className="mt-3 font-display text-2xl text-maroon">Every celebration has now taken place.</p>
        <p className="body-copy mt-2">Thank you for being part of our story. The memories live on below.</p>
        {schedule.past.length > 0 && (
          <ul className="mt-8 flex flex-wrap justify-center gap-3 sm:gap-4" aria-label="The celebrations">
            {schedule.past.map((e) => (
              <li key={e.id}>
                <Link to={`/celebrations/${e.slug}`} className="group flex w-16 flex-col items-center gap-2 sm:w-20" aria-label={e.name}>
                  <Art event={e} timeZone={tz} className="w-full transition-transform group-hover:-translate-y-0.5" />
                  <span className="text-center font-label text-[0.6rem] uppercase leading-tight tracking-wide2 text-ink-soft group-hover:text-maroon">{e.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${current ? 'lg:grid-cols-[1.35fr_1fr]' : 'lg:grid-cols-2'}`} data-testid="whats-happening-now">
      <AnimatePresence mode="wait">
        {current ? (
          <motion.article
            key={`live-${current.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`relative overflow-hidden border border-maroon/30 bg-maroon text-ivory shadow-paper ${prominent ? 'px-8 pb-10 pt-12 sm:px-12 sm:py-14' : 'px-8 pb-8 pt-10'}`}
            data-testid="whn-current"
            aria-live="polite"
          >
            <FramedCorners size="h-6 w-6 sm:h-9 sm:w-9" className="opacity-70 [&_svg]:text-gold-light" />
            <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <LiveBadge className="text-gold-pale [&_.live-dot]:bg-gold-light" />
                <p className="mt-5 font-label text-[0.7rem] uppercase tracking-label text-gold-pale">What’s happening now</p>
                <h3 className={`mt-2 font-display font-medium leading-tight text-ivory ${prominent ? 'text-5xl sm:text-6xl' : 'text-4xl'}`}>
                  {current.name}
                </h3>
                <p className="mt-3 font-display text-2xl italic text-gold-pale" aria-label={`The time is now ${formatTime(now, tz)}`}>
                  {formatTime(now, tz)}
                </p>
                {current.venue && <p className="mt-2 text-sm text-ivory/80">at {current.venue.name}</p>}
                {latestUpdate && latestUpdate.eventId === current.id && (
                  <p className="mt-5 max-w-md border-l border-gold-light/60 pl-4 text-[0.95rem] leading-relaxed text-ivory/90">
                    “{latestUpdate.content}”
                    <span className="mt-1 block font-label text-[0.6rem] uppercase tracking-label text-gold-pale">
                      {latestUpdate.publishedAt && formatTime(latestUpdate.publishedAt, tz)}
                    </span>
                  </p>
                )}
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link to={`/celebrations/${current.slug}`} className="btn bg-ivory text-maroon hover:bg-ivory-100">
                    Event details
                  </Link>
                  {current.venue?.mapsUrl && (
                    <a href={current.venue.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn border border-gold-light/70 text-ivory hover:bg-white/10">
                      Directions
                    </a>
                  )}
                </div>
              </div>
              <Art event={current} timeZone={tz} play className={`mx-auto w-full shrink-0 sm:mx-0 ${prominent ? 'max-w-[15rem] sm:w-52 lg:w-60' : 'max-w-[13rem] sm:w-44'}`} />
            </div>
          </motion.article>
        ) : next ? (
          <motion.article
            key={`next-${next.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card-paper relative px-6 py-8 sm:px-8"
            data-testid="whn-next"
          >
            <FramedCorners />
            <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="label">Up next</p>
                <h3 className="mt-3 font-display text-4xl font-medium text-maroon">{next.name}</h3>
                <p className="mt-2 font-label text-[0.72rem] uppercase tracking-wide2 text-ink-soft">{whenLabel(next, now, tz)}</p>
                {next.venue && <p className="mt-1 text-sm text-ink-muted">{next.venue.name}</p>}
                <div className="mt-6">
                  <Countdown target={next.startDateTime} now={now} compact />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to={`/celebrations/${next.slug}`} className="btn-outline">
                    Details
                  </Link>
                  <DirectionsButton venue={next.venue} variant="outline" />
                </div>
              </div>
              <Art event={next} timeZone={tz} play className="mx-auto w-full max-w-[13rem] shrink-0 sm:mx-0 sm:w-40" />
            </div>
          </motion.article>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-col gap-4">
        {showJustHappened && previous && (
          <article className="flex items-center gap-4 border border-gold/25 bg-ivory-100/60 px-4 py-4 sm:px-6" data-testid="whn-previous">
            <Art event={previous} timeZone={tz} className="w-14 shrink-0" />
            <div className="min-w-0">
              <p className="label-sm">Just happened</p>
              <p className="mt-1 font-display text-2xl text-maroon">{previous.name}</p>
              <Link to={`/celebrations/${previous.slug}`} className="mt-1 inline-block text-sm text-ink-soft underline decoration-gold/60 underline-offset-4 hover:text-maroon">
                See moments from the {previous.name.toLowerCase()}
              </Link>
            </div>
          </article>
        )}
        {current && next && (
          <article className="flex items-center gap-4 border border-gold/30 bg-ivory-50 px-4 py-4 sm:px-6" data-testid="whn-upnext">
            <Art event={next} timeZone={tz} className="w-14 shrink-0" />
            <div className="min-w-0">
              <p className="label-sm">Up next</p>
              <p className="mt-1 font-display text-2xl text-maroon">{next.name}</p>
              <p className="text-sm text-ink-soft">{whenLabel(next, now, tz)}</p>
            </div>
          </article>
        )}
        {later.length > 0 && (
          <article className="border border-gold/20 px-6 py-5" data-testid="whn-later">
            <p className="label-sm">Later</p>
            <ul className="mt-2 divide-y divide-gold/15">
              {later.slice(0, 4).map((e) => (
                <li key={e.id}>
                  <Link to={`/celebrations/${e.slug}`} className="flex min-h-[44px] items-center justify-between gap-4 py-2 hover:text-maroon">
                    <span className="flex min-w-0 items-center gap-3">
                      <Art event={e} timeZone={tz} className="w-8 shrink-0" />
                      <span className="min-w-0 font-display text-lg text-ink">{e.name}</span>
                    </span>
                    <span className="max-w-[55%] text-right text-xs text-ink-muted">{whenLabel(e, now, tz)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        )}
        {!current && !next && !showJustHappened && later.length === 0 && (
          <p className="body-copy">The schedule will appear here soon.</p>
        )}
      </div>
    </div>
  );
}
