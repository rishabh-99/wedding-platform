import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { SectionToggles } from '@wedding/shared';
import { countdownParts, formatTime, relativeDayLabel } from '@wedding/shared';
import { useClock } from '../hooks/useClock';
import { useSchedule } from '../hooks/useSchedule';
import { useSettings } from '../services/queries';
import { useGuestSignedIn } from '../services/guest';
import { Monogram } from '../components/ornaments/Ornaments';

interface NavItem {
  to: string;
  label: string;
  section?: keyof SectionToggles;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/story', label: 'Our Story', section: 'story' },
  { to: '/celebrations', label: 'Celebrations' },
  { to: '/itinerary', label: 'Itinerary' },
  { to: '/gallery', label: 'Gallery', section: 'gallery' },
  { to: '/venues', label: 'Venues' },
  { to: '/blessings', label: 'Blessings', section: 'guestbook' },
  { to: '/rsvp', label: 'RSVP', section: 'rsvp' },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/pass', label: 'My guest pass' },
  { to: '/now', label: 'What’s Happening Now' },
  { to: '/journal', label: 'Wedding Journal' },
  { to: '/dress-code', label: 'What to Wear', section: 'dressCode' },
  { to: '/travel', label: 'Travel & Stay', section: 'travel' },
  { to: '/faq', label: 'FAQ', section: 'faq' },
];

/**
 * Plain-language status for the header pill, e.g. "Next: Engagement · in 25 days",
 * "Live now · Sangeet", "Up next · Baraat 9:00 AM" or "Wedding journal".
 */
export function useNowStatus(): { to: string; label: string; compact: string; short: string; live: boolean } {
  const schedule = useSchedule();
  const { now } = useClock();
  const tz = schedule.timezone;
  if (schedule.phase === 'archive') return { to: '/journal', label: 'Wedding journal', compact: 'Journal', short: 'Journal', live: false };
  if (schedule.current) return { to: '/now', label: `Live now · ${schedule.current.name}`, compact: `Live · ${schedule.current.name}`, short: 'Live', live: true };
  const next = schedule.next;
  if (!next) return { to: '/now', label: 'What’s happening', compact: 'Now', short: 'Now', live: false };
  const rel = relativeDayLabel(next.startDateTime, now, tz);
  if (rel) return { to: '/now', label: `${rel === 'Today' ? 'Up next' : 'Tomorrow'} · ${next.name} ${formatTime(next.startDateTime, tz)}`, compact: `${next.name} · ${formatTime(next.startDateTime, tz)}`, short: 'Up next', live: schedule.isLiveMode };
  const days = Math.max(1, Math.ceil(countdownParts(next.startDateTime, now).totalMs / 86_400_000));
  return { to: '/now', label: `Next: ${next.name} · in ${days} days`, compact: `${next.name} · ${days}d`, short: 'Next', live: false };
}

function useVisible(items: NavItem[]) {
  const { data: settings } = useSettings();
  const signedIn = useGuestSignedIn();
  return items
    .filter((i) => !i.section || settings?.sections[i.section] !== false)
    // Once a family has RSVP'd and signed in, the RSVP slot becomes their pass.
    .map((i) => (signedIn && i.to === '/rsvp' ? { to: '/pass', label: 'My pass' } : i))
    .filter((i, idx, arr) => arr.findIndex((x) => x.to === i.to) === idx);
}

export function SiteHeader() {
  const { data: settings } = useSettings();
  const status = useNowStatus();
  const primary = useVisible(PRIMARY_NAV);
  const secondary = useVisible(SECONDARY_NAV);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-[var(--sim-offset,0px)] z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled || menuOpen ? 'border-b border-gold/25 bg-ivory/95 shadow-[0_8px_24px_-20px_rgba(46,36,32,.5)] backdrop-blur' : 'border-b border-transparent bg-ivory/70 backdrop-blur-sm'
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-ivory focus:px-4 focus:py-2">
        Skip to content
      </a>
      <div className="container-page flex h-16 max-w-7xl items-center justify-between gap-3 lg:h-[4.5rem]">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="Home">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-10 w-10 object-contain" />
          ) : (
            <Monogram a={settings?.coupleName1 ?? ''} b={settings?.coupleName2 ?? ''} className="h-10 w-10 [&_span]:text-base" />
          )}
          <span className="hidden whitespace-nowrap font-display text-xl italic text-maroon sm:inline xl:hidden 2xl:inline">
            {settings ? `${settings.coupleName1} & ${settings.coupleName2}` : ''}
          </span>
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {primary.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `relative inline-flex min-h-[44px] items-center whitespace-nowrap px-2.5 font-label text-[0.68rem] uppercase tracking-wide2 transition-colors ${
                      isActive ? 'text-maroon after:absolute after:inset-x-3 after:bottom-2 after:h-px after:bg-maroon' : 'text-ink-soft hover:text-maroon'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            to={status.to}
            aria-label={status.label}
            title={status.label}
            className={`inline-flex min-h-[40px] min-w-0 max-w-[11.5rem] items-center gap-2 border px-2.5 font-label text-[0.6rem] uppercase tracking-wide2 sm:max-w-[14rem] sm:px-3 sm:text-[0.62rem] ${
              status.live ? 'border-maroon bg-maroon text-ivory' : 'border-gold/50 text-maroon hover:bg-gold/10'
            }`}
          >
            {status.live ? (
              <span className="live-dot shrink-0 bg-ivory" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 6v4l2.5 1.5" />
              </svg>
            )}
            <span className="truncate sm:hidden">{status.compact}</span>
            <span className="hidden truncate sm:inline">{status.label}</span>
          </Link>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-maroon xl:hidden"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              {menuOpen ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
            </svg>
          </button>
          <button
            type="button"
            className="hidden h-11 items-center px-2 font-label text-[0.62rem] uppercase tracking-wide2 text-ink-soft hover:text-maroon xl:flex"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            More
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="site-menu"
            aria-label="Site"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-gold/20 bg-ivory"
          >
            <div className="container-page grid gap-x-8 py-5 sm:grid-cols-2 lg:grid-cols-3">
              {[...primary, ...secondary.filter((x) => !primary.some((p) => p.to === x.to))].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-[48px] items-center border-b border-gold/15 font-display text-xl ${isActive ? 'text-maroon' : 'text-ink hover:text-maroon'} ${
                      primary.some((p) => p.to === item.to) ? 'xl:hidden' : ''
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Compact bottom navigation for phones — "Now" is always one tap away. */
export function MobileNav() {
  const status = useNowStatus();
  const { data: settings } = useSettings();
  const signedIn = useGuestSignedIn();
  const items = [
    { to: '/', label: 'Home', icon: 'M4 10.5L12 4l8 6.5V20h-5v-6H9v6H4z' },
    { to: status.to, label: status.short, icon: 'M12 6v6l4 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z', live: status.live },
    { to: '/celebrations', label: 'Events', icon: 'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4' },
    { to: '/venues', label: 'Venues', icon: 'M12 21s7-6 7-11.5a7 7 0 1 0-14 0C5 15 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z' },
    signedIn
      ? { to: '/pass', label: 'My pass', icon: 'M4 5h16v14H4zM8 9h3v3H8zM14 9h2M14 12h2M8 15h8' }
      : settings?.sections.rsvp !== false
      ? { to: '/rsvp', label: 'RSVP', icon: 'M4 6h16v12H4zM4 7l8 6 8-6' }
      : { to: '/gallery', label: 'Gallery', icon: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4' },
  ];
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-50 border-t border-gold/30 bg-ivory/95 pb-safe backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[0.62rem] font-semibold uppercase tracking-wider ${
                  isActive ? 'text-maroon' : 'text-ink-muted'
                }`
              }
            >
              <span className="relative">
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {'live' in item && item.live && <span className="live-dot absolute -right-1 -top-0.5" aria-hidden="true" />}
              </span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const { data: settings } = useSettings();
  return (
    <footer className="mt-16 border-t border-gold/25 bg-ivory-100/60 pb-28 pt-12 md:pb-12">
      <div className="container-page text-center">
        <Monogram a={settings?.coupleName1 ?? ''} b={settings?.coupleName2 ?? ''} className="mx-auto" />
        <p className="mt-4 font-display text-2xl italic text-maroon">
          {settings ? `${settings.coupleName1} & ${settings.coupleName2}` : ''}
        </p>
        <p className="label-sm mt-2">{settings?.weddingDatesLabel}</p>
        {settings?.weddingHashtag && <p className="mt-3 font-display text-lg text-gold-deep">{settings.weddingHashtag}</p>}
        <nav aria-label="Footer" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-soft">
          <Link to="/itinerary" className="hover:text-maroon">Itinerary</Link>
          <Link to="/venues" className="hover:text-maroon">Venues</Link>
          <Link to="/travel" className="hover:text-maroon">Travel</Link>
          <Link to="/faq" className="hover:text-maroon">FAQ</Link>
          <Link to="/blessings" className="hover:text-maroon">Blessings</Link>
        </nav>
      </div>
    </footer>
  );
}
