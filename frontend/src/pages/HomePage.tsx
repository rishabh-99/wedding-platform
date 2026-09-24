import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RoyalDoors, hasSeenIntro } from '../components/intro/RoyalDoors';
import { Hero } from '../components/home/Hero';
import { ArchiveHero, LiveHeading, LiveRibbon, NextCelebration } from '../components/home/PhaseBanners';
import { EventTimeline } from '../components/events/EventTimeline';
import { WhatsHappeningNow } from '../components/events/WhatsHappeningNow';
import { LiveFeed } from '../components/live/LiveFeed';
import { Masonry } from '../components/gallery/Masonry';
import { BlessingCards, GuestbookForm } from '../components/guestbook/Guestbook';
import { RsvpForm } from '../components/rsvp/RsvpForm';
import { DressCodeSection, FaqSection, StorySection, TravelSection, VenuesSection } from '../components/sections/ContentSections';
import { WhatsAppGroupCard } from '../components/sections/WhatsAppGroup';
import { ErrorState, LoadingBlock, SectionHeading } from '../components/ui/primitives';
import { useClock } from '../hooks/useClock';
import { useSchedule } from '../hooks/useSchedule';
import { useFaq, useGallery, useGuestbook, useLiveUpdates, useSettings, useStory, useTravel, useVenues } from '../services/queries';

/**
 * The home page re-composes itself by phase:
 *  pre-wedding → invitation journey; event days → live companion; afterwards → archive.
 * Every section is data-driven and can be switched off in Settings.
 */
export default function HomePage() {
  const [showIntro, setShowIntro] = useState(() => !hasSeenIntro());
  const { now } = useClock();
  const settingsQ = useSettings();
  const schedule = useSchedule();
  const live = useLiveUpdates();
  const story = useStory();
  const venues = useVenues();
  const travel = useTravel();
  const faq = useFaq();
  const guestbook = useGuestbook();
  const gallery = useGallery(undefined, 12);

  const settings = settingsQ.data;
  if (settingsQ.isError) {
    return (
      <div className="container-page py-24">
        <ErrorState title="The celebrations are loading slowly" message="We could not reach the server. Please try again in a moment." onRetry={() => settingsQ.refetch()} />
      </div>
    );
  }

  const sections = settings?.sections;
  const tz = schedule.timezone;
  const archive = schedule.phase === 'archive';
  const liveMode = schedule.isLiveMode && !archive;
  const updates = live.data ?? [];
  const photos = gallery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      {showIntro && (
        <RoyalDoors coupleName1={settings?.coupleName1} coupleName2={settings?.coupleName2} onComplete={() => setShowIntro(false)} />
      )}

      {liveMode && settings && <LiveRibbon text={settings.liveBannerText} />}

      {!settings ? (
        <div className="container-page py-24">
          <LoadingBlock lines={5} label="Loading the invitation" />
        </div>
      ) : archive ? (
        <ArchiveHero settings={settings} />
      ) : (
        <Hero settings={settings} />
      )}

      {/* LIVE: what's happening now leads the page */}
      {liveMode && (
        <section className="section pt-4" aria-labelledby="now-title" id="now">
          <div className="container-page">
            <h2 id="now-title" className="sr-only">What’s happening now</h2>
            <LiveHeading />
            <WhatsHappeningNow schedule={schedule} now={now} timeZone={tz} latestUpdate={updates[0]} prominent />
          </div>
        </section>
      )}

      {/* BEFORE: "What's happening" sits straight under the invitation, highlighted */}
      {!liveMode && !archive && (
        <section
          className="relative scroll-mt-20 border-y border-gold/40 bg-gradient-to-b from-maroon/[0.05] to-ivory-100/40 py-12 sm:py-16"
          aria-labelledby="whn-title"
          id="now"
        >
          <div className="container-page">
            <div className="mb-8 text-center sm:mb-10">
              <p className="label inline-flex items-center gap-2">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="10" cy="10" r="7.5" />
                  <path d="M10 6v4l2.5 1.5" />
                </svg>
                At a glance
              </p>
              <h2 id="whn-title" className="heading-lg mt-2">What’s happening</h2>
            </div>
            <WhatsHappeningNow schedule={schedule} now={now} timeZone={tz} latestUpdate={updates[0]} />
          </div>
        </section>
      )}

      {/* Countdown to the next celebration (before and during the wedding) */}
      {!archive && schedule.next && (
        <NextCelebration event={schedule.next} now={now} timeZone={tz} isLive={liveMode} />
      )}

      {/* LIVE: latest photos + feed */}
      {liveMode && (
        <>
          {photos.length > 0 && sections?.gallery !== false && (
            <section className="section" aria-labelledby="latest-photos">
              <div className="container-page">
                <SectionHeading id="latest-photos" eyebrow="Just in" title="Latest photographs" />
                <Masonry items={photos.slice(0, 8)} />
                <div className="mt-8 text-center">
                  <Link to="/gallery" className="btn-outline">See the full gallery</Link>
                </div>
              </div>
            </section>
          )}
          <FeedSection updates={updates} timeZone={tz} loading={live.isLoading} />
        </>
      )}

      {/* ARCHIVE: journal and album first */}
      {archive && (
        <>
          <FeedSection updates={updates} timeZone={tz} loading={live.isLoading} title="The wedding journal" eyebrow="As it happened" />
          {sections?.gallery !== false && photos.length > 0 && (
            <section className="section" aria-labelledby="album-title">
              <div className="container-page">
                <SectionHeading id="album-title" eyebrow="The album" title="The wedding album" />
                <Masonry items={photos.slice(0, 12)} />
                <div className="mt-8 text-center">
                  <Link to="/gallery" className="btn-primary">Open the wedding album</Link>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {sections?.story !== false && story.data && <StorySection sections={story.data} />}

      <section className="section bg-ivory-100/40" aria-labelledby="celebrations-title" id="celebrations">
        <div className="container-page">
          <SectionHeading id="celebrations-title" eyebrow="Save the dates" title="The celebrations" />
          {schedule.isLoading ? (
            <LoadingBlock lines={6} />
          ) : (
            <EventTimeline events={schedule.events} timeZone={tz} currentId={schedule.current?.id} pastIds={schedule.past.map((e) => e.id)} />
          )}
          <div className="mt-10 text-center">
            <Link to="/itinerary" className="btn-outline">Full itinerary</Link>
          </div>
        </div>
      </section>

      {venues.data && <VenuesSection venues={venues.data} events={schedule.events} />}
      {sections?.travel !== false && travel.data && !archive && <TravelSection items={travel.data} />}
      {sections?.dressCode !== false && !archive && <DressCodeSection events={schedule.events} />}

      {!liveMode && !archive && sections?.gallery !== false && photos.length > 0 && (
        <section className="section" aria-labelledby="gallery-title">
          <div className="container-page">
            <SectionHeading id="gallery-title" eyebrow="Moments" title="The gallery" />
            <Masonry items={photos.slice(0, 8)} />
            <div className="mt-8 text-center">
              <Link to="/gallery" className="btn-outline">View all photographs</Link>
            </div>
          </div>
        </section>
      )}

      {!liveMode && !archive && updates.length > 0 && <FeedSection updates={updates} timeZone={tz} limit={3} loading={false} />}

      {sections?.rsvp !== false && !archive && (
        <section className="section bg-ivory-100/40" aria-labelledby="rsvp-title" id="rsvp">
          <div className="container-page">
            <SectionHeading id="rsvp-title" eyebrow="Kindly reply" title="RSVP" intro="Let us know which celebrations you will join us for." />
            {schedule.events.length ? <RsvpForm events={schedule.events} timeZone={tz} /> : <LoadingBlock lines={6} />}
          </div>
        </section>
      )}

      {settings?.whatsappGroupUrl && !archive && (
        <section className="py-12 sm:py-16" aria-label="Wedding WhatsApp group" id="whatsapp">
          <div className="container-page">
            <WhatsAppGroupCard url={settings.whatsappGroupUrl} />
          </div>
        </section>
      )}

      {sections?.guestbook !== false && (
        <section className="section" aria-labelledby="blessings-title" id="blessings">
          <div className="container-page">
            <SectionHeading
              id="blessings-title"
              eyebrow="With love"
              title="Leave your blessings"
              intro="A wish, a memory or a few words for the couple — with a photograph if you like."
            />
            <GuestbookForm />
            {(guestbook.data?.items.length ?? 0) > 0 && (
              <div className="mt-14">
                <BlessingCards items={guestbook.data!.items.slice(0, 6)} timeZone={tz} />
                <div className="mt-8 text-center">
                  <Link to="/blessings" className="btn-outline">Read all blessings</Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {sections?.faq !== false && faq.data && !archive && <FaqSection items={faq.data} />}
    </>
  );
}

function FeedSection({
  updates,
  timeZone,
  loading,
  limit = 6,
  title = 'From the celebrations',
  eyebrow = 'Live journal',
}: {
  updates: import('@wedding/shared').LiveUpdateDTO[];
  timeZone: string;
  loading: boolean;
  limit?: number;
  title?: string;
  eyebrow?: string;
}) {
  return (
    <section className="section" aria-labelledby="feed-title">
      <div className="container-page">
        <SectionHeading id="feed-title" eyebrow={eyebrow} title={title} />
        {loading ? (
          <LoadingBlock lines={5} />
        ) : updates.length ? (
          <>
            <LiveFeed updates={updates} timeZone={timeZone} limit={limit} />
            {updates.length > limit && (
              <div className="mt-8 text-center">
                <Link to="/journal" className="btn-outline">Read the full journal</Link>
              </div>
            )}
          </>
        ) : (
          <p className="body-copy text-center">Updates from the celebrations will appear here as they happen.</p>
        )}
      </div>
    </section>
  );
}
