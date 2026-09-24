import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { EventDTO, FaqDTO, StorySectionDTO, TravelSectionDTO, VenueDTO } from '@wedding/shared';
import { Reveal } from '../../animations/Reveal';
import { DirectionsButton, PinIcon } from '../events/DirectionsButton';
import { MediaImage } from '../gallery/MediaImage';
import { ArchOutline, FramedCorners } from '../ornaments/Ornaments';
import { SectionHeading } from '../ui/primitives';

type HeadingLevel = 'h1' | 'h2';

/** A LITTLE BIT OF US — alternating editorial chapters. */
export function StorySection({ sections, as = 'h2' }: { sections: StorySectionDTO[]; as?: HeadingLevel }) {
  if (!sections.length) return null;
  return (
    <section className="section" aria-labelledby="story-title">
      <div className="container-page">
        <SectionHeading id="story-title" as={as} eyebrow="Our story" title="A little bit of us" />
        <div className="mx-auto max-w-4xl space-y-14 sm:space-y-20">
          {sections.map((s, i) => (
            <Reveal key={s.id} as="article" className={`grid items-center gap-8 ${s.media ? 'sm:grid-cols-2' : ''}`}>
              {s.media && (
                <div className={`relative ${i % 2 ? 'sm:order-2' : ''}`}>
                  <MediaImage media={s.media} sizes="(min-width: 640px) 45vw, 100vw" className="border border-gold/30" />
                </div>
              )}
              <div className={s.media ? '' : 'mx-auto max-w-prose2 text-center'}>
                {s.eyebrow && <p className="label-sm">{s.eyebrow}</p>}
                <h3 className="mt-2 font-display text-3xl text-maroon sm:text-4xl">{s.title}</h3>
                <p className="body-copy mt-4 whitespace-pre-line text-[1.05rem]">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** FIND YOUR WAY — venue cards with a prominent one-tap directions button. */
export function VenuesSection({ venues, events, as = 'h2' }: { venues: VenueDTO[]; events: EventDTO[]; as?: HeadingLevel }) {
  return (
    <section className="section" aria-labelledby="venues-title" id="venues">
      <div className="container-page">
        <SectionHeading id="venues-title" as={as} eyebrow="Venues" title="Find your way" />
        <div className="grid gap-6 md:grid-cols-2">
          {venues.map((v) => {
            const at = events.filter((e) => e.venueId === v.id);
            const label = at.length === 1 ? at[0]!.name : at.length > 1 ? 'Wedding' : '';
            return (
              <Reveal key={v.id} as="article" className="card-paper relative flex flex-col px-6 py-9 text-center sm:px-10">
                <FramedCorners size="h-8 w-8" />
                <p className="label">{label || 'Venue'}</p>
                <h3 className="mt-3 font-display text-4xl text-maroon">{v.name}</h3>
                {at.length > 1 && <p className="mt-2 text-sm text-ink-muted">{at.map((e) => e.name).join(' · ')}</p>}
                {v.address && <p className="body-copy mt-3">{v.address}</p>}
                <DirectionsButton venue={v} className="mx-auto mt-6 w-full max-w-xs py-4 text-[0.78rem]" />
                <dl className="mt-7 grid gap-4 text-left text-sm sm:grid-cols-2">
                  {[
                    ['Parking', v.parkingInformation],
                    ['Nearby landmarks', v.nearbyLandmarks],
                    ['Transport', v.transportInformation],
                    ['Contact', v.contactInformation],
                  ]
                    .filter(([, val]) => val)
                    .map(([k, val]) => (
                      <div key={k}>
                        <dt className="label-sm">{k}</dt>
                        <dd className="mt-1 leading-relaxed text-ink-soft">{val}</dd>
                      </div>
                    ))}
                </dl>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** TRAVEL & STAY */
export function TravelSection({ items, as = 'h2' }: { items: TravelSectionDTO[]; as?: HeadingLevel }) {
  if (!items.length) return null;
  return (
    <section className="section bg-ivory-100/40" aria-labelledby="travel-title">
      <div className="container-page">
        <SectionHeading id="travel-title" as={as} eyebrow="Plan your trip" title="Travel & stay" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <Reveal key={t.id} as="article" className="border border-gold/25 bg-ivory-50/80 px-6 py-7">
              <h3 className="font-display text-2xl text-maroon">{t.title}</h3>
              <p className="mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-soft">{t.body}</p>
              {t.links.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {t.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-2 text-sm text-maroon underline decoration-gold/60 underline-offset-4">
                        <PinIcon className="h-3.5 w-3.5" /> {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** WHAT TO WEAR — per-event dress code, description and colour palette. */
export function DressCodeSection({ events, as = 'h2' }: { events: EventDTO[]; as?: HeadingLevel }) {
  const withCodes = events.filter((e) => e.dressCode || e.dressCodeDescription);
  if (!withCodes.length) return null;
  return (
    <section className="section" aria-labelledby="wear-title">
      <div className="container-page">
        <SectionHeading id="wear-title" as={as} eyebrow="Dress code" title="What to wear" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {withCodes.map((e) => (
            <Reveal key={e.id} as="article" className="relative flex flex-col items-center px-6 pb-8 pt-12 text-center">
              <ArchOutline className="pointer-events-none absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="none" />
              <p className="label-sm relative">{e.name}</p>
              <h3 className="relative mt-2 font-display text-2xl text-maroon">{e.dressCode}</h3>
              {e.dressPalette.length > 0 && (
                <ul className="relative mt-4 flex flex-wrap justify-center gap-2" aria-label="Colour palette">
                  {e.dressPalette.map((c) => (
                    <li key={c.hex} className="flex flex-col items-center gap-1">
                      <span className="h-8 w-8 rounded-full border border-ink/10 shadow-inner" style={{ background: c.hex }} aria-hidden="true" />
                      <span className="text-[0.65rem] text-ink-muted">{c.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              {e.dressCodeDescription && <p className="relative mt-4 text-sm leading-relaxed text-ink-soft">{e.dressCodeDescription}</p>}
              <Link to={`/celebrations/${e.slug}`} className="relative mt-4 text-xs uppercase tracking-wider text-maroon underline decoration-gold/60 underline-offset-4">
                Event details
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Expandable FAQ (accessible disclosure buttons). */
export function FaqSection({ items, as = 'h2' }: { items: FaqDTO[]; as?: HeadingLevel }) {
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();
  if (!items.length) return null;
  return (
    <section className="section" aria-labelledby="faq-title">
      <div className="container-page">
        <SectionHeading id="faq-title" as={as} eyebrow="Good to know" title="Questions & answers" />
        <ul className="mx-auto max-w-3xl divide-y divide-gold/25 border-y border-gold/25">
          {items.map((f) => {
            const isOpen = open === f.id;
            const panelId = `${baseId}-${f.id}`;
            return (
              <li key={f.id}>
                <h3>
                  <button
                    type="button"
                    className="flex min-h-[60px] w-full items-center justify-between gap-6 py-4 text-left"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : f.id)}
                  >
                    <span className="font-display text-xl text-ink sm:text-2xl">{f.question}</span>
                    <span aria-hidden="true" className={`text-2xl text-gold transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
                      +
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="body-copy whitespace-pre-line pb-6 pr-8">{f.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
