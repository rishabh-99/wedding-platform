import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatDayMonth, formatTime } from '@wedding/shared';
import { useSchedule } from '../../hooks/useSchedule';
import { useContacts, useFaq, useSettings, useTravel, useVenues } from '../../services/queries';
import { ContactCards } from '../sections/ContactCards';
import { WhatsAppGroupCard } from '../sections/WhatsAppGroup';
import { DirectionsButton } from '../events/DirectionsButton';
import { LiveBadge } from '../ui/primitives';

type Topic = 'venue' | 'now' | 'itinerary' | 'stay' | 'transport' | 'wear' | 'help' | 'faq';

const TOPICS: { id: Topic; title: string; hint: string }[] = [
  { id: 'venue', title: 'Find my venue', hint: 'Directions' },
  { id: 'now', title: 'What’s happening?', hint: 'Current event' },
  { id: 'itinerary', title: 'Wedding itinerary', hint: 'Complete schedule' },
  { id: 'stay', title: 'Where should I stay?', hint: 'Accommodation' },
  { id: 'transport', title: 'Getting around', hint: 'Transport' },
  { id: 'wear', title: 'What should I wear?', hint: 'Dress code' },
  { id: 'help', title: 'Need help?', hint: 'Important contacts' },
  { id: 'faq', title: 'FAQ', hint: 'Common questions' },
];

const digits = (s: string) => s.replace(/[^\d]/g, '');

/** Persistent "Need a hand?" concierge — a floating button that opens a helpful bottom sheet. */
export function Concierge() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const active = TOPICS.find((t) => t.id === topic);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setTopic(null);
          setOpen(true);
        }}
        className="fixed bottom-[5.25rem] right-3 z-40 flex h-12 min-w-[48px] items-center justify-center gap-2 rounded-full border border-gold/60 bg-maroon px-3.5 text-ivory shadow-paper transition-transform hover:-translate-y-0.5 sm:px-5 md:bottom-6 md:right-6"
        aria-haspopup="dialog"
        aria-label="Need a hand? Open the wedding concierge"
        title="Need a hand?"
        aria-expanded={open}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M10 2.5l1.8 3.9 4.2.5-3.1 2.9.8 4.2L10 12l-3.7 2 .8-4.2L4 6.9l4.2-.5L10 2.5Z" />
        </svg>
        <span className="sr-only font-label text-[0.68rem] uppercase tracking-wide2 sm:not-sr-only">Need a hand?</span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button type="button" aria-label="Close concierge" className="absolute inset-0 h-full w-full bg-ink/40" onClick={() => setOpen(false)} />
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="concierge-title"
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto border-t border-gold/50 bg-ivory pb-safe shadow-paper outline-none md:bottom-6 md:left-auto md:right-6 md:w-[26rem] md:border"
                initial={reduce ? { opacity: 0 } : { y: '100%' }}
                animate={reduce ? { opacity: 1 } : { y: 0 }}
                exit={reduce ? { opacity: 0 } : { y: '100%' }}
                transition={{ type: 'tween', duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/25 bg-ivory px-5 py-4">
                  {active ? (
                    <button type="button" onClick={() => setTopic(null)} className="flex min-h-[44px] items-center gap-2 text-sm text-maroon">
                      <span aria-hidden="true">←</span> All topics
                    </button>
                  ) : (
                    <div>
                      <p className="label-sm">At your service</p>
                      <h2 id="concierge-title" className="font-display text-2xl text-maroon">Wedding Concierge</h2>
                    </div>
                  )}
                  <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-gold/10" aria-label="Close">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" stroke="currentColor" strokeWidth="1.6" fill="none" aria-hidden="true">
                      <path d="M4 4l12 12M16 4L4 16" />
                    </svg>
                  </button>
                </div>
                <div className="px-5 py-5">
                  {active ? (
                    <>
                      {active && <h2 id="concierge-title" className="mb-4 font-display text-2xl text-maroon">{active.title}</h2>}
                      <TopicPanel topic={active.id} />
                    </>
                  ) : (
                    <ul className="grid grid-cols-2 gap-2">
                      {TOPICS.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => setTopic(t.id)}
                            className="flex min-h-[76px] w-full flex-col items-start justify-center border border-gold/30 bg-ivory-50 px-4 py-3 text-left transition-colors hover:border-gold hover:bg-ivory-100"
                          >
                            <span className="font-display text-lg leading-tight text-ink">{t.title}</span>
                            <span className="mt-0.5 text-xs text-ink-muted">{t.hint}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function TopicPanel({ topic }: { topic: Topic }) {
  const schedule = useSchedule();
  const { data: venues } = useVenues();
  const { data: travel } = useTravel();
  const { data: faq } = useFaq();
  const { data: settings } = useSettings();
  const { data: contacts } = useContacts();
  const tz = schedule.timezone;

  switch (topic) {
    case 'venue':
      return (
        <div className="space-y-4">
          {(venues ?? []).map((v) => (
            <div key={v.id} className="border border-gold/25 p-4">
              <p className="font-display text-xl text-maroon">{v.name}</p>
              <p className="label-sm mt-1">
                {schedule.events.filter((e) => e.venueId === v.id).map((e) => e.name).join(' · ')}
              </p>
              {v.address && <p className="mt-2 text-sm text-ink-soft">{v.address}</p>}
              <DirectionsButton venue={v} className="mt-3 w-full" />
            </div>
          ))}
        </div>
      );
    case 'now': {
      const e = schedule.current ?? schedule.next;
      if (!e) return <p className="body-copy">All the celebrations have taken place — thank you for being with us.</p>;
      return (
        <div>
          {schedule.current ? <LiveBadge label="Happening now" /> : <p className="label-sm">Up next</p>}
          <p className="mt-2 font-display text-3xl text-maroon">{e.name}</p>
          <p className="text-sm text-ink-soft">
            {formatDayMonth(e.startDateTime, tz)} · {formatTime(e.startDateTime, tz)} {e.venue && `· ${e.venue.name}`}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link to="/now" className="btn-primary">Open live updates</Link>
            <DirectionsButton venue={e.venue} variant="outline" />
          </div>
        </div>
      );
    }
    case 'itinerary':
      return (
        <div>
          <ul className="divide-y divide-gold/20">
            {schedule.events.map((e) => (
              <li key={e.id}>
                <Link to={`/celebrations/${e.slug}`} className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                  <span className="font-display text-lg text-ink">{e.name}</span>
                  <span className="text-right text-xs text-ink-muted">
                    {formatDayMonth(e.startDateTime, tz)}
                    <br />
                    {formatTime(e.startDateTime, tz)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/itinerary" className="btn-outline mt-4 w-full">Full itinerary</Link>
        </div>
      );
    case 'stay':
    case 'transport': {
      const cats = topic === 'stay' ? ['stay', 'hotels', 'parking'] : ['getting-there', 'airport', 'railway', 'local-transport'];
      const items = (travel ?? []).filter((t) => cats.includes(t.category));
      return (
        <div className="space-y-4">
          {items.map((t) => (
            <Section key={t.id} title={t.title}>
              {t.body}
            </Section>
          ))}
          <Link to="/travel" className="btn-outline w-full">Travel &amp; stay</Link>
        </div>
      );
    }
    case 'wear':
      return (
        <div className="space-y-4">
          {schedule.events.filter((e) => e.dressCode).map((e) => (
            <div key={e.id} className="border-b border-gold/20 pb-3">
              <p className="label-sm">{e.name}</p>
              <p className="font-display text-xl text-maroon">{e.dressCode}</p>
              {e.dressPalette.length > 0 && (
                <div className="mt-2 flex gap-1.5" aria-label={`Colours: ${e.dressPalette.map((c) => c.name).join(', ')}`}>
                  {e.dressPalette.map((c) => (
                    <span key={c.hex} className="h-5 w-5 rounded-full border border-ink/10" style={{ background: c.hex }} title={c.name} />
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link to="/dress-code" className="btn-outline w-full">What to wear</Link>
        </div>
      );
    case 'help':
      return (
        <div className="space-y-3">
          <p className="body-copy">The family’s hospitality team is happy to help with anything at all.</p>
          {settings?.whatsappGroupUrl && <WhatsAppGroupCard url={settings.whatsappGroupUrl} compact />}
          {settings?.contactPhone && (
            <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="btn-primary w-full">Call {settings.contactPhone}</a>
          )}
          {settings?.contactWhatsapp && (
            <a href={`https://wa.me/${digits(settings.contactWhatsapp)}`} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
              WhatsApp us
            </a>
          )}
          {settings?.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`} className="btn-ghost w-full">{settings.contactEmail}</a>
          )}
          <ContactCards contacts={(contacts ?? []).filter((c) => !c.eventId || c.eventId === (schedule.current ?? schedule.next)?.id)} compact />
          {(travel ?? []).filter((t) => t.category === 'contacts').map((t) => (
            <Section key={t.id} title={t.title}>{t.body}</Section>
          ))}
        </div>
      );
    case 'faq':
      return (
        <div>
          <ul className="space-y-4">
            {(faq ?? []).slice(0, 5).map((f) => (
              <li key={f.id}>
                <Section title={f.question}>{f.answer}</Section>
              </li>
            ))}
          </ul>
          <Link to="/faq" className="btn-outline mt-4 w-full">All questions</Link>
        </div>
      );
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-display text-lg text-maroon">{title}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
