import { Link } from 'react-router-dom';
import { formatDayMonth, formatTime, formatWeekday, groupEventsByDay } from '@wedding/shared';
import { AddToCalendar } from '../components/events/AddToCalendar';
import { Countdown } from '../components/events/Countdown';
import { DirectionsButton } from '../components/events/DirectionsButton';
import { EventTimeline } from '../components/events/EventTimeline';
import { WhatsHappeningNow } from '../components/events/WhatsHappeningNow';
import { BlessingCards, GuestbookForm } from '../components/guestbook/Guestbook';
import { LiveFeed } from '../components/live/LiveFeed';
import { RsvpForm } from '../components/rsvp/RsvpForm';
import { DressCodeSection, FaqSection, StorySection, TravelSection, VenuesSection } from '../components/sections/ContentSections';
import { EmptyState, ErrorState, LiveBadge, LoadingBlock, SectionHeading } from '../components/ui/primitives';
import { useClock } from '../hooks/useClock';
import { useSchedule } from '../hooks/useSchedule';
import { useLiveConnection } from '../layouts/LiveContext';
import { useFaq, useGuestbook, useLiveUpdates, useSettings, useStory, useTravel, useVenues } from '../services/queries';
import { icsUrl } from '../utils/events';

function Page({ children }: { children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="container-page">{children}</div>
    </section>
  );
}

function SectionDisabled() {
  return (
    <Page>
      <EmptyState title="This section is not available right now" message="Please check back soon." />
    </Page>
  );
}

/** Live companion page — always one tap away from the bottom navigation. */
export function NowPage() {
  const { now } = useClock();
  const schedule = useSchedule();
  const live = useLiveUpdates();
  const connection = useLiveConnection();
  const updates = live.data ?? [];
  return (
    <>
      <section className="section pb-8">
        <div className="container-page">
          <SectionHeading as="h1" eyebrow={schedule.isLiveMode ? 'Live' : 'At a glance'} title="What’s happening now" />
          {schedule.isLoading ? (
            <LoadingBlock lines={5} />
          ) : (
            <WhatsHappeningNow schedule={schedule} now={now} timeZone={schedule.timezone} latestUpdate={updates[0]} prominent={!!schedule.current} />
          )}
          {schedule.next && schedule.phase !== 'archive' && (
            <div className="mt-12 text-center">
              <p className="label">Countdown to {schedule.next.name}</p>
              <div className="mt-6">
                <Countdown target={schedule.next.startDateTime} now={now} />
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="section border-t border-gold/20 pt-12">
        <div className="container-page">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <h2 className="heading-md">From the celebrations</h2>
            {connection === 'open' ? (
              <LiveBadge label="Updating live" />
            ) : connection === 'polling' ? (
              <p className="text-xs text-ink-muted">Checking for updates every few seconds</p>
            ) : null}
          </div>
          {live.isLoading ? (
            <LoadingBlock lines={4} />
          ) : live.isError ? (
            <ErrorState title="Live updates could not be loaded" onRetry={() => live.refetch()} />
          ) : updates.length ? (
            <LiveFeed updates={updates} timeZone={schedule.timezone} />
          ) : (
            <EmptyState title="No updates yet" message="Posts from the celebrations will appear here the moment they are shared — no need to refresh." />
          )}
        </div>
      </section>
    </>
  );
}

export function CelebrationsPage() {
  const schedule = useSchedule();
  return (
    <Page>
      <SectionHeading as="h1" eyebrow="Save the dates" title="The celebrations" />
      {schedule.isLoading ? (
        <LoadingBlock lines={6} />
      ) : schedule.isError ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : (
        <EventTimeline events={schedule.events} timeZone={schedule.timezone} currentId={schedule.current?.id} pastIds={schedule.past.map((e) => e.id)} />
      )}
    </Page>
  );
}

/** Day-by-day itinerary with one-tap directions and calendar for every event. */
export function ItineraryPage() {
  const schedule = useSchedule();
  const tz = schedule.timezone;
  const days = groupEventsByDay(schedule.events, tz);
  return (
    <Page>
      <SectionHeading as="h1" eyebrow="The plan" title="Itinerary" />
      <div className="mb-10 text-center">
        <a href={icsUrl()} download="wedding-celebrations.ics" className="btn-outline">
          Add every celebration to my calendar
        </a>
      </div>
      {schedule.isLoading && <LoadingBlock lines={6} />}
      <div className="mx-auto max-w-3xl space-y-12">
        {days.map((day) => (
          <section key={day.dateKey} aria-labelledby={`day-${day.dateKey}`}>
            <h2 id={`day-${day.dateKey}`} className="border-b border-gold/40 pb-3 font-display text-3xl text-maroon">
              {formatWeekday(day.date, tz)}, <span className="uppercase tracking-[0.06em]">{formatDayMonth(day.date, tz)}</span>
            </h2>
            <ol className="divide-y divide-gold/20">
              {day.events.map((e) => (
                <li key={e.id} className="grid gap-4 py-6 sm:grid-cols-[7rem_1fr]">
                  <p className="font-display text-2xl italic text-gold-deep">{formatTime(e.startDateTime, tz)}</p>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link to={`/celebrations/${e.slug}`} className="font-display text-2xl uppercase tracking-[0.05em] text-ink hover:text-maroon">
                        {e.name}
                      </Link>
                      {schedule.current?.id === e.id && <LiveBadge label="Now" />}
                    </div>
                    {e.venue && <p className="text-sm text-ink-soft">{e.venue.name}</p>}
                    {e.dressCode && <p className="mt-1 text-sm text-ink-muted">Dress code: {e.dressCode}</p>}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <DirectionsButton venue={e.venue} variant="outline" />
                      <AddToCalendar event={e} allEvents={schedule.events} timeZone={tz} variant="ghost" />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Page>
  );
}

export function JournalPage() {
  const schedule = useSchedule();
  const live = useLiveUpdates(undefined, 200);
  return (
    <Page>
      <SectionHeading as="h1" eyebrow="As it happened" title="The wedding journal" />
      {live.isLoading ? (
        <LoadingBlock lines={5} />
      ) : live.isError ? (
        <ErrorState onRetry={() => live.refetch()} />
      ) : live.data?.length ? (
        <LiveFeed updates={live.data} timeZone={schedule.timezone} />
      ) : (
        <EmptyState title="The journal is waiting to be written" message="Updates will appear here during the celebrations." />
      )}
    </Page>
  );
}

export function RsvpPage() {
  const schedule = useSchedule();
  const { data: settings } = useSettings();
  if (settings && !settings.sections.rsvp) return <SectionDisabled />;
  return (
    <section className="section" id="rsvp">
      <div className="container-page">
        <SectionHeading as="h1" eyebrow="Kindly reply" title="RSVP" intro="We would love to know which celebrations you will be joining us for." />
        {schedule.isLoading ? <LoadingBlock lines={6} /> : <RsvpForm events={schedule.events} timeZone={schedule.timezone} />}
      </div>
    </section>
  );
}

export function BlessingsPage() {
  const guestbook = useGuestbook();
  const schedule = useSchedule();
  const { data: settings } = useSettings();
  if (settings && !settings.sections.guestbook) return <SectionDisabled />;
  return (
    <Page>
      <SectionHeading as="h1" eyebrow="With love" title="Leave your blessings" intro="Share a wish, a memory or a few words for the couple." />
      <GuestbookForm />
      <div className="mt-16">
        {guestbook.isLoading ? (
          <LoadingBlock lines={4} />
        ) : guestbook.data?.items.length ? (
          <BlessingCards items={guestbook.data.items} timeZone={schedule.timezone} />
        ) : (
          <EmptyState title="Be the first to leave a blessing" />
        )}
      </div>
    </Page>
  );
}

export function StoryPage() {
  const story = useStory();
  const { data: settings } = useSettings();
  if (settings && !settings.sections.story) return <SectionDisabled />;
  if (story.isLoading) return <Page><LoadingBlock lines={6} /></Page>;
  return <StorySection sections={story.data ?? []} as="h1" />;
}

export function VenuesPage() {
  const venues = useVenues();
  const schedule = useSchedule();
  if (venues.isLoading) return <Page><LoadingBlock lines={6} /></Page>;
  if (venues.isError) return <Page><ErrorState title="Venue details are unavailable right now" onRetry={() => venues.refetch()} /></Page>;
  return <VenuesSection venues={venues.data ?? []} events={schedule.events} as="h1" />;
}

export function TravelPage() {
  const travel = useTravel();
  const { data: settings } = useSettings();
  if (settings && !settings.sections.travel) return <SectionDisabled />;
  if (travel.isLoading) return <Page><LoadingBlock lines={6} /></Page>;
  return <TravelSection items={travel.data ?? []} as="h1" />;
}

export function DressCodePage() {
  const schedule = useSchedule();
  const { data: settings } = useSettings();
  if (settings && !settings.sections.dressCode) return <SectionDisabled />;
  if (schedule.isLoading) return <Page><LoadingBlock lines={6} /></Page>;
  return <DressCodeSection events={schedule.events} as="h1" />;
}

export function FaqPage() {
  const faq = useFaq();
  const { data: settings } = useSettings();
  if (settings && !settings.sections.faq) return <SectionDisabled />;
  if (faq.isLoading) return <Page><LoadingBlock lines={6} /></Page>;
  return <FaqSection items={faq.data ?? []} as="h1" />;
}

export function NotFoundPage() {
  return (
    <Page>
      <div className="py-10 text-center">
        <p className="label">Page not found</p>
        <h1 className="heading-lg mt-3">This door leads nowhere</h1>
        <p className="body-copy mt-4">The page you were looking for doesn’t exist.</p>
        <Link to="/" className="btn-primary mt-8">Return home</Link>
      </div>
    </Page>
  );
}
