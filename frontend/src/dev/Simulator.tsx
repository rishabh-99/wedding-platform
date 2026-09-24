import { useEffect, useMemo, useState } from 'react';
import { effectiveSpans, formatDateTime, localDateKey, parseLocalDateTime, toLocalDateTimeInput } from '@wedding/shared';
import { useClock } from '../hooks/useClock';
import { useSchedule } from '../hooks/useSchedule';

/**
 * DEVELOPMENT-ONLY simulator: jump the site's clock to any moment of the
 * wedding to preview the invitation, live mode and the post-wedding archive.
 * Presets are derived from the event schedule in the database (nothing hardcoded).
 * Only the browser's clock changes — data, other visitors and the server are untouched.
 * Excluded from production builds (import.meta.env.DEV gate in GuestLayout).
 */
interface Preset {
  id: string;
  group: 'Before' | 'Live' | 'Between' | 'After';
  label: string;
  at: Date;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export default function Simulator() {
  const { now, isTimeTravel, setSimulatedTime } = useClock();
  const schedule = useSchedule();
  const tz = schedule.timezone;
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const presets = useMemo<Preset[]>(() => {
    const spans = effectiveSpans(schedule.events, tz);
    if (!spans.length) return [];
    const list: Preset[] = [];
    const first = spans[0]!;
    list.push({ id: 'week-before', group: 'Before', label: `A week before the ${first.event.name.toLowerCase()}`, at: new Date(first.start - 7 * DAY) });
    list.push({ id: 'hour-before', group: 'Before', label: `1 hour before the ${first.event.name.toLowerCase()}`, at: new Date(first.start - HOUR) });
    for (const s of spans) {
      list.push({ id: `live-${s.event.id}`, group: 'Live', label: `During ${s.event.name}`, at: new Date(s.start + 20 * MIN) });
    }
    // Gaps on event days (e.g. afternoon between Haldi and Sangeet).
    for (let i = 0; i < spans.length - 1; i++) {
      const a = spans[i]!;
      const b = spans[i + 1]!;
      if (b.start - a.end >= HOUR && localDateKey(a.start, tz) === localDateKey(b.start, tz)) {
        list.push({ id: `gap-${a.event.id}`, group: 'Between', label: `Between ${a.event.name} and ${b.event.name}`, at: new Date(a.end + (b.start - a.end) / 2) });
      }
    }
    if (schedule.archiveAt) {
      const archiveAt = Date.parse(schedule.archiveAt);
      list.push({ id: 'archive', group: 'After', label: 'The morning after (wedding archive)', at: new Date(archiveAt + 10 * HOUR) });
      list.push({ id: 'archive-later', group: 'After', label: 'A year later', at: new Date(archiveAt + 365 * DAY) });
    }
    return list;
  }, [schedule.events, schedule.archiveAt, tz]);

  const phaseLabel = {
    pre: 'Invitation (before)',
    live: 'LIVE — event in progress',
    between: 'Live day — between events',
    archive: 'Wedding archive (after)',
  }[schedule.phase];

  // Make room for the banner: push the page and the sticky header down while simulating.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sim-offset', isTimeTravel ? '28px' : '0px');
    document.body.style.paddingTop = isTimeTravel ? '28px' : '';
    return () => {
      root.style.removeProperty('--sim-offset');
      document.body.style.paddingTop = '';
    };
  }, [isTimeTravel]);

  const jump = (d: Date | null) => {
    setSimulatedTime(d);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <>
      {isTimeTravel && (
        <div className="fixed inset-x-0 top-0 z-[60] flex h-7 items-center justify-center gap-3 bg-[repeating-linear-gradient(45deg,#2E2420,#2E2420_10px,#3a2e29_10px,#3a2e29_20px)] px-3 text-[0.7rem] font-semibold text-ivory">
          <span className="truncate">SIMULATOR · {formatDateTime(now, tz)} · {phaseLabel}</span>
          <button type="button" className="shrink-0 underline" onClick={() => jump(null)}>
            Back to real time
          </button>
        </div>
      )}

      <div className="fixed bottom-[5.25rem] left-3 z-[70] md:bottom-6 md:left-6">
        {open ? (
          <div
            role="dialog"
            aria-label="Wedding simulator"
            className="max-h-[70vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-md border border-ink/20 bg-[#1f1815] p-4 text-sm text-ivory shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">Simulator <span className="font-normal text-ivory/60">(dev only)</span></p>
              <button type="button" onClick={() => setOpen(false)} className="h-8 w-8 rounded hover:bg-white/10" aria-label="Close simulator">
                ✕
              </button>
            </div>
            <p className="mb-3 rounded bg-white/5 px-3 py-2 text-xs leading-relaxed text-ivory/80">
              <span className="block text-ivory">{formatDateTime(now, tz)}</span>
              {phaseLabel}
              {schedule.current && ` · ${schedule.current.name}`}
              {!schedule.current && schedule.next && ` · next: ${schedule.next.name}`}
            </p>

            <button
              type="button"
              onClick={() => jump(null)}
              className={`mb-3 w-full rounded px-3 py-2 text-left ${!isTimeTravel ? 'bg-gold text-ink' : 'bg-white/10 hover:bg-white/15'}`}
            >
              Real time (today)
            </button>

            {(['Before', 'Live', 'Between', 'After'] as const).map((group) => {
              const items = presets.filter((p) => p.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="mb-3">
                  <p className="mb-1 text-[0.65rem] uppercase tracking-wider text-ivory/50">
                    {group === 'Live' ? 'Live mode' : group === 'After' ? 'Post-wedding' : group}
                  </p>
                  <ul className="space-y-1">
                    {items.map((p) => {
                      const active = isTimeTravel && Math.abs(now.getTime() - p.at.getTime()) < 2 * MIN;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => jump(p.at)}
                            className={`w-full rounded px-3 py-1.5 text-left ${active ? 'bg-gold text-ink' : 'bg-white/5 hover:bg-white/15'}`}
                          >
                            {p.label}
                            <span className={`block text-[0.65rem] ${active ? 'text-ink/70' : 'text-ivory/50'}`}>{formatDateTime(p.at, tz)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom) jump(parseLocalDateTime(custom, tz));
              }}
            >
              <label className="sr-only" htmlFor="sim-custom">Custom date and time ({tz})</label>
              <input
                id="sim-custom"
                type="datetime-local"
                value={custom || toLocalDateTimeInput(now, tz)}
                onChange={(e) => setCustom(e.target.value)}
                className="min-w-0 flex-1 rounded bg-white px-2 py-1.5 text-ink"
              />
              <button type="submit" className="rounded bg-white/15 px-3 hover:bg-white/25">Go</button>
            </form>
            <p className="mt-3 text-[0.65rem] leading-relaxed text-ivory/50">
              Only your browser’s clock changes ({tz}). Posts dated after the simulated time are hidden. Admin actions still
              happen for real.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-[#1f1815] px-3.5 text-xs font-semibold text-ivory shadow-lg hover:bg-[#2c221e]"
            aria-label="Open wedding simulator (development only)"
          >
            <span aria-hidden="true">⏱</span>
            <span className="hidden sm:inline">Simulator</span>
            {isTimeTravel && <span className="h-2 w-2 rounded-full bg-gold-light" aria-hidden="true" />}
          </button>
        )}
      </div>
    </>
  );
}
