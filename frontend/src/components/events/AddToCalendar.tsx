import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { googleCalendarUrl, outlookCalendarUrl, type EventDTO } from '@wedding/shared';
import { useSettings } from '../../services/queries';
import { eventTimes, icsUrl, venueLabel } from '../../utils/events';

interface Props {
  event: EventDTO;
  allEvents: EventDTO[];
  timeZone: string;
  variant?: 'outline' | 'ghost';
  className?: string;
}

/** Data-driven "Add to calendar" menu: Google, Apple (ICS), Outlook and plain ICS download. */
export function AddToCalendar({ event, allEvents, timeZone, variant = 'outline', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const { data: settings } = useSettings();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const { start, end } = eventTimes(event, allEvents, timeZone);
  const couple = settings ? `${settings.coupleName1} & ${settings.coupleName2}` : '';
  const input = {
    uid: event.id,
    title: couple ? `${event.name} — ${couple}` : event.name,
    description: [event.description, event.dressCode ? `Dress code: ${event.dressCode}` : null].filter(Boolean).join('\n\n'),
    location: venueLabel(event),
    url: `${window.location.origin}/celebrations/${event.slug}`,
    start,
    end,
  };

  const items = [
    { label: 'Google Calendar', href: googleCalendarUrl(input), external: true },
    { label: 'Apple Calendar', href: icsUrl(event.slug), external: false },
    { label: 'Outlook', href: outlookCalendarUrl(input), external: true },
    { label: 'Download .ics', href: icsUrl(event.slug), external: false, download: true },
  ];

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        className={variant === 'outline' ? 'btn-outline w-full' : 'btn-ghost'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarIcon />
        Add to calendar
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 z-30 mt-2 w-56 border border-gold/40 bg-ivory-50 py-1 shadow-paper"
          >
            {items.map((item) => (
              <li key={item.label} role="none">
                <a
                  role="menuitem"
                  href={item.href}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  {...(item.download ? { download: `${event.slug}.ics` } : {})}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center px-4 text-sm text-ink hover:bg-gold/10 hover:text-maroon"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12" rx="1" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
    </svg>
  );
}
