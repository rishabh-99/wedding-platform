import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { formatDayMonth, formatTime, formatWeekday, groupEventsByDay, type EventDTO } from '@wedding/shared';
import { LiveBadge } from '../ui/primitives';
import { FILM_WIDTH, sceneForSlug } from '../../film/sceneRegistry';

const EventArt = lazy(() => import('../../film/EventArt'));

interface Props {
  events: EventDTO[];
  timeZone: string;
  currentId?: string | null;
  pastIds?: string[];
  /** Show each celebration's illustration from the invitation film beside it. */
  art?: boolean;
}

/** "The Celebrations" — chronological, grouped by day, entirely driven by the event records. */
export function EventTimeline({ events, timeZone: tz, currentId, pastIds = [], art = false }: Props) {
  const reduce = useReducedMotion();
  const days = groupEventsByDay(events, tz);

  return (
    <ol className="relative mx-auto max-w-3xl" data-testid="event-timeline">
      {/* Mobile: a rail down the left edge. Desktop uses in-flow ornaments + connectors instead, so nothing crosses the text. */}
      <span aria-hidden="true" className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-gold/0 via-gold/60 to-gold/0 sm:hidden" />
      {days.map((day, dayIndex) => (
        <li key={day.dateKey} className="relative pb-12 last:pb-0 sm:pb-0">
          <motion.div
            className="relative mb-6 pl-8 sm:pl-0 sm:text-center"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.7, delay: dayIndex * 0.05 }}
          >
            <span
              aria-hidden="true"
              className="absolute left-0 top-2 h-[15px] w-[15px] rotate-45 border border-gold bg-ivory sm:relative sm:left-auto sm:top-auto sm:mx-auto sm:mb-4 sm:block"
            />
            <p className="label-sm">{formatWeekday(day.date, tz)}</p>
            <h3 className="font-display text-3xl font-medium uppercase tracking-[0.08em] text-maroon sm:text-4xl">
              {formatDayMonth(day.date, tz)}
            </h3>
          </motion.div>
          <ul className="space-y-3 pl-8 sm:pl-0">
            {day.events.map((event, i) => {
              const isLive = event.id === currentId;
              const isPast = pastIds.includes(event.id);
              const scene = art ? sceneForSlug(event.slug) : null;
              return (
                <motion.li
                  key={event.id}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-5% 0px' }}
                  transition={{ duration: 0.6, delay: 0.08 * i }}
                  className="sm:mx-auto sm:max-w-md"
                >
                  <Link
                    to={`/celebrations/${event.slug}`}
                    className={`group block border transition-colors ${
                      scene ? 'flex items-center gap-4 p-3 text-left sm:gap-5' : 'px-5 py-4 sm:text-center'
                    } ${
                      isLive
                        ? 'border-maroon/50 bg-maroon/[0.04]'
                        : 'border-gold/30 bg-ivory-50/70 hover:border-gold hover:bg-ivory-50'
                    } ${isPast ? 'opacity-70' : ''}`}
                    aria-label={`${event.name}, ${formatDayMonth(event.startDateTime, tz)} at ${formatTime(event.startDateTime, tz)}${isLive ? ', happening now' : ''}`}
                  >
                    {scene && (
                      <Suspense fallback={<div className="skeleton w-20 shrink-0 sm:w-24" style={{ aspectRatio: `${FILM_WIDTH} / ${scene.crop}` }} />}>
                        <EventArt event={event} scene={scene} timeZone={tz} className="w-20 shrink-0 sm:w-24" />
                      </Suspense>
                    )}
                    <div className="min-w-0">
                      {isLive && <LiveBadge label="Happening now" className="mb-1" />}
                      <p className="font-display text-2xl font-medium uppercase tracking-[0.06em] text-ink group-hover:text-maroon">
                        {event.name}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {formatTime(event.startDateTime, tz)} onwards
                        {event.venue && <span className="text-ink-muted"> · {event.venue.name}</span>}
                      </p>
                      {isPast && <p className="label-sm mt-1 text-ink-muted">Concluded</p>}
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
          {dayIndex < days.length - 1 && (
            <span aria-hidden="true" className="mx-auto my-8 hidden h-12 w-px bg-gradient-to-b from-gold/60 to-gold/0 sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}
