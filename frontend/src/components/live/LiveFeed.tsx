import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatDayMonth, formatTime, type LiveUpdateDTO } from '@wedding/shared';
import { MediaImage } from '../gallery/MediaImage';

interface Props {
  updates: LiveUpdateDTO[];
  timeZone: string;
  limit?: number;
  showEvent?: boolean;
}

/**
 * "From the celebrations" — an editorial, journal-style chronological feed
 * (newest first). New entries fade in when they arrive over SSE.
 */
export function LiveFeed({ updates, timeZone: tz, limit, showEvent = true }: Props) {
  const reduce = useReducedMotion();
  const list = limit ? updates.slice(0, limit) : updates;

  return (
    <ol className="mx-auto max-w-3xl" data-testid="live-feed" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {list.map((u) => (
          <motion.li
            key={u.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, backgroundColor: 'rgba(194,165,107,0.18)' }}
            animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(194,165,107,0)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], backgroundColor: { duration: 2.4 } }}
            className="grid gap-x-8 gap-y-3 border-t border-gold/25 py-8 first:border-t-0 sm:grid-cols-[9rem_1fr]"
            data-testid="live-entry"
          >
            <div className="sm:pt-1 sm:text-right">
              {showEvent && u.event && (
                <Link to={`/celebrations/${u.event.slug}`} className="font-label text-[0.68rem] uppercase tracking-label text-maroon hover:underline">
                  {u.event.name}
                </Link>
              )}
              {u.publishedAt && (
                <p className="mt-0.5 font-display text-lg italic text-gold-deep">
                  <time dateTime={u.publishedAt}>{formatTime(u.publishedAt, tz)}</time>
                  <span className="ml-2 font-sans text-xs not-italic text-ink-muted sm:ml-0 sm:block">
                    {formatDayMonth(u.publishedAt, tz)}
                  </span>
                </p>
              )}
            </div>
            <article>
              {u.type === 'ANNOUNCEMENT' && <p className="label-sm mb-2 text-maroon">Announcement</p>}
              {u.title && <h3 className="mb-2 font-display text-2xl font-medium text-maroon">{u.title}</h3>}
              {u.media && (
                <figure className="mb-4 overflow-hidden border border-gold/25 bg-ivory-100">
                  {u.media.type === 'VIDEO' ? (
                    <video
                      src={u.media.urls.original}
                      poster={u.media.urls.thumb !== u.media.urls.original ? u.media.urls.medium : undefined}
                      controls
                      playsInline
                      preload="none"
                      className="max-h-[70vh] w-full bg-ink"
                    />
                  ) : (
                    <MediaImage media={u.media} sizes="(min-width: 640px) 560px, 100vw" className="w-full" />
                  )}
                </figure>
              )}
              <p className={`whitespace-pre-line leading-relaxed text-ink ${u.type === 'TEXT' && !u.media ? 'font-display text-[1.45rem] leading-snug' : 'text-[1.02rem]'}`}>
                {u.content}
              </p>
            </article>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
