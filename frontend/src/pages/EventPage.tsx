import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatLongDate, formatTime, formatWeekday, type MediaDTO, type Paginated } from '@wedding/shared';
import { AddToCalendar } from '../components/events/AddToCalendar';
import { Countdown } from '../components/events/Countdown';
import { DirectionsButton } from '../components/events/DirectionsButton';
import { Masonry } from '../components/gallery/Masonry';
import { LiveFeed } from '../components/live/LiveFeed';
import { FramedCorners, OrnamentDivider } from '../components/ornaments/Ornaments';
import { EmptyState, ErrorState, LiveBadge, LoadingBlock } from '../components/ui/primitives';
import { MediaImage } from '../components/gallery/MediaImage';
import { useClock } from '../hooks/useClock';
import { useSchedule } from '../hooks/useSchedule';
import { ApiError, api, qs } from '../services/api';
import { useContacts, useEvent, useLiveUpdates } from '../services/queries';
import { ContactCards } from '../components/sections/ContactCards';

/** Event detail: everything a guest needs for one celebration. */
export default function EventPage() {
  const { slug = '' } = useParams();
  const { now } = useClock();
  const schedule = useSchedule();
  const eventQ = useEvent(slug);
  const event = eventQ.data;
  const updates = useLiveUpdates(event?.id);
  const gallery = useQuery({
    queryKey: ['gallery', 'event', event?.id],
    enabled: !!event,
    queryFn: () => api.get<Paginated<MediaDTO>>(`/api/gallery${qs({ eventId: event!.id, pageSize: 24 })}`),
  });
  const tz = schedule.timezone;
  const { data: contacts } = useContacts();
  // This celebration's managers; fall back to the general contacts if none are assigned.
  const specific = (contacts ?? []).filter((c) => event && c.eventId === event.id);
  const eventContacts = specific.length ? specific : (contacts ?? []).filter((c) => !c.eventId).slice(0, 2);

  if (eventQ.isLoading) {
    return (
      <div className="container-page py-24">
        <LoadingBlock lines={6} label="Loading celebration" />
      </div>
    );
  }
  if (eventQ.isError || !event) {
    const missing = eventQ.error instanceof ApiError && eventQ.error.status === 404;
    return (
      <div className="container-page py-24">
        <ErrorState
          title={missing ? 'We couldn’t find that celebration' : 'This celebration could not be loaded'}
          message={missing ? 'It may have been renamed. See the full list of celebrations.' : 'Please check your connection and try again.'}
          onRetry={missing ? undefined : () => eventQ.refetch()}
        />
        <div className="mt-6 text-center">
          <Link to="/celebrations" className="btn-outline">All celebrations</Link>
        </div>
      </div>
    );
  }

  const isLive = schedule.current?.id === event.id;
  const isPast = schedule.past.some((e) => e.id === event.id);
  const upcoming = !isLive && !isPast && Date.parse(event.startDateTime) > now.getTime();
  const photos = gallery.data?.items ?? [];

  return (
    <article>
      <header className="relative border-b border-gold/20 bg-ivory-100/50 py-16 text-center sm:py-24">
        <div className="container-page relative">
          <nav aria-label="Breadcrumb" className="mb-6">
            <Link to="/celebrations" className="label-sm hover:text-maroon">← The celebrations</Link>
          </nav>
          {isLive && <LiveBadge label="Happening now" className="mb-4" />}
          {isPast && <p className="label-sm mb-4 text-ink-muted">This celebration has concluded</p>}
          <h1 className="heading-xl uppercase tracking-[0.05em]">{event.name}</h1>
          <OrnamentDivider className="mx-auto mt-6" />
          <p className="mt-6 font-label text-[0.8rem] uppercase tracking-label text-ink">
            {formatWeekday(event.startDateTime, tz)}, {formatLongDate(event.startDateTime, tz)}
          </p>
          <p className="mt-1 font-display text-2xl italic text-ink-soft">{formatTime(event.startDateTime, tz)} onwards</p>
          {event.venue && <p className="mt-2 text-ink-soft">{event.venue.name}</p>}
          {event.status !== 'SCHEDULED' && (
            <p className="mx-auto mt-4 inline-block border border-maroon/40 px-3 py-1 text-sm text-maroon">
              {event.status === 'POSTPONED' ? 'Postponed — new details to follow' : 'Cancelled'}
            </p>
          )}
          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <DirectionsButton venue={event.venue} className="sm:flex-1" />
            <AddToCalendar event={event} allEvents={schedule.events} timeZone={tz} className="sm:flex-1" />
          </div>
          {upcoming && (
            <div className="mt-10">
              <Countdown target={event.startDateTime} now={now} />
            </div>
          )}
        </div>
      </header>

      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.4fr_1fr] lg:py-20">
        <div className="space-y-10">
          {event.description && (
            <section aria-labelledby="about-title">
              <h2 id="about-title" className="label mb-3">About</h2>
              <p className="whitespace-pre-line font-display text-2xl leading-snug text-ink">{event.description}</p>
            </section>
          )}
          {event.helpfulInfo && (
            <section aria-labelledby="info-title">
              <h2 id="info-title" className="label mb-3">Helpful information</h2>
              <p className="body-copy whitespace-pre-line">{event.helpfulInfo}</p>
            </section>
          )}
          <section aria-labelledby="updates-title">
            <h2 id="updates-title" className="label mb-3">Live updates</h2>
            {updates.data?.length ? (
              <LiveFeed updates={updates.data} timeZone={tz} showEvent={false} />
            ) : (
              <p className="body-copy">{isPast ? 'No updates were posted for this celebration.' : 'Updates will appear here during the celebration.'}</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {(event.dressCode || event.dressCodeDescription) && (
            <section className="card-paper relative px-6 py-8" aria-labelledby="dress-title">
              <FramedCorners size="h-7 w-7" />
              <h2 id="dress-title" className="label">What to wear</h2>
              {event.dressCode && <p className="mt-2 font-display text-2xl text-maroon">{event.dressCode}</p>}
              {event.dressPalette.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-3" aria-label="Colour palette">
                  {event.dressPalette.map((c) => (
                    <li key={c.hex} className="flex items-center gap-2 text-xs text-ink-soft">
                      <span className="h-6 w-6 rounded-full border border-ink/10" style={{ background: c.hex }} aria-hidden="true" />
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
              {event.dressCodeDescription && <p className="body-copy mt-4">{event.dressCodeDescription}</p>}
              {event.dressReferenceImages && event.dressReferenceImages.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {event.dressReferenceImages.map((m) => (
                    <MediaImage key={m.id} media={m} sizes="120px" className="aspect-[3/4]" />
                  ))}
                </div>
              )}
            </section>
          )}
          {eventContacts.length > 0 && (
            <section aria-labelledby="contacts-title">
              <h2 id="contacts-title" className="label mb-3">Need help at this celebration?</h2>
              <ContactCards contacts={eventContacts} compact />
            </section>
          )}
          {event.venue && (
            <section className="border border-gold/30 px-6 py-7" aria-labelledby="venue-title">
              <h2 id="venue-title" className="label">Venue</h2>
              <p className="mt-2 font-display text-2xl text-maroon">{event.venue.name}</p>
              {event.venue.address && <p className="mt-2 text-sm text-ink-soft">{event.venue.address}</p>}
              <DirectionsButton venue={event.venue} className="mt-4 w-full" />
              {event.venue.parkingInformation && (
                <div className="mt-5">
                  <h3 className="label-sm">Parking</h3>
                  <p className="mt-1 text-sm text-ink-soft">{event.venue.parkingInformation}</p>
                </div>
              )}
              {event.venue.transportInformation && (
                <div className="mt-4">
                  <h3 className="label-sm">Getting there</h3>
                  <p className="mt-1 text-sm text-ink-soft">{event.venue.transportInformation}</p>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      <section className="border-t border-gold/20 py-14" aria-labelledby="event-gallery-title">
        <div className="container-page">
          <h2 id="event-gallery-title" className="heading-md mb-8 text-center">Moments from the {event.name.toLowerCase()}</h2>
          {gallery.isLoading ? (
            <LoadingBlock lines={3} />
          ) : photos.length ? (
            <Masonry items={photos} />
          ) : (
            <EmptyState title="Photographs coming soon" message="The album for this celebration will be shared here." />
          )}
        </div>
      </section>
    </article>
  );
}
