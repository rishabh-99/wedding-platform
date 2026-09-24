import { endOfLocalDay, localDateKey, toDate, type DateInput } from './time';

/**
 * The schedule engine: the single source of truth for "what is happening now".
 * Used by the backend (/api/schedule, dashboard) and by the frontend (live ticking),
 * so countdown / live-mode / archive logic is never duplicated.
 */

export type SchedulePhase = 'pre' | 'live' | 'between' | 'archive';
export type LiveModeSetting = 'AUTO' | 'ON' | 'OFF';

export interface SchedulableEvent {
  id: string;
  startDateTime: DateInput;
  endDateTime?: DateInput | null;
}

export interface ScheduleOptions {
  timeZone: string;
  liveMode?: LiveModeSetting;
  /** Duration assumed for events with no end time (ms). */
  defaultDurationMs?: number;
}

export interface ScheduleResult<E extends SchedulableEvent> {
  phase: SchedulePhase;
  /** Event currently in progress (latest-started if several overlap). */
  current: E | null;
  /** Most recent event that has finished (or started before the current one). */
  previous: E | null;
  /** First event that has not started yet. */
  next: E | null;
  /** Events after `next`. */
  later: E[];
  /** All events that have already finished. */
  past: E[];
  /** True if any event falls on today's local date. */
  isEventDay: boolean;
  /** Whether the site should render in live-companion mode. */
  isLiveMode: boolean;
  /** Instant the site becomes a permanent archive (end of the last event's local day). */
  archiveAt: string | null;
  now: string;
}

export const DEFAULT_EVENT_DURATION_MS = 4 * 60 * 60 * 1000;

interface Span<E> {
  event: E;
  start: number;
  end: number;
}

/**
 * Effective end time: explicit end if given; otherwise the default duration,
 * clipped so it never runs past the start of the next event on the same day.
 */
export function effectiveSpans<E extends SchedulableEvent>(
  events: readonly E[],
  timeZone: string,
  defaultDurationMs = DEFAULT_EVENT_DURATION_MS,
): Span<E>[] {
  const sorted = [...events].sort(
    (a, b) => toDate(a.startDateTime).getTime() - toDate(b.startDateTime).getTime(),
  );
  return sorted.map((event, i) => {
    const start = toDate(event.startDateTime).getTime();
    if (event.endDateTime) {
      const end = toDate(event.endDateTime).getTime();
      return { event, start, end: Math.max(end, start) };
    }
    let end = start + defaultDurationMs;
    const following = sorted[i + 1];
    if (following) {
      const nextStart = toDate(following.startDateTime).getTime();
      if (
        nextStart > start &&
        nextStart < end &&
        localDateKey(nextStart, timeZone) === localDateKey(start, timeZone)
      ) {
        end = nextStart;
      }
    }
    return { event, start, end };
  });
}

export function computeSchedule<E extends SchedulableEvent>(
  events: readonly E[],
  nowInput: DateInput,
  options: ScheduleOptions,
): ScheduleResult<E> {
  const { timeZone, liveMode = 'AUTO', defaultDurationMs } = options;
  const now = toDate(nowInput).getTime();
  const spans = effectiveSpans(events, timeZone, defaultDurationMs);
  const todayKey = localDateKey(now, timeZone);

  const inProgress = spans.filter((s) => s.start <= now && now < s.end);
  const currentSpan = inProgress.length ? inProgress[inProgress.length - 1]! : null;
  const pastSpans = spans.filter((s) => s.end <= now && s !== currentSpan);
  const upcoming = spans.filter((s) => s.start > now);

  const previousSpan = currentSpan
    ? [...spans].reverse().find((s) => s.start < currentSpan.start && s !== currentSpan) ?? null
    : pastSpans.length
      ? pastSpans.reduce((a, b) => (b.end >= a.end ? b : a))
      : null;

  const isEventDay = spans.some(
    (s) => localDateKey(s.start, timeZone) === todayKey || localDateKey(s.end - 1, timeZone) === todayKey,
  );

  const lastSpan = spans.reduce<Span<E> | null>((a, b) => (!a || b.end > a.end ? b : a), null);
  const archiveAt = lastSpan ? endOfLocalDay(lastSpan.end - 1, timeZone).getTime() : null;

  let phase: SchedulePhase;
  if (archiveAt !== null && now > archiveAt) phase = 'archive';
  else if (currentSpan) phase = 'live';
  else if (isEventDay) phase = 'between';
  else phase = 'pre';

  const isLiveMode =
    liveMode === 'ON' ? true : liveMode === 'OFF' ? false : phase === 'live' || phase === 'between';

  return {
    phase,
    current: currentSpan?.event ?? null,
    previous: previousSpan?.event ?? null,
    next: upcoming[0]?.event ?? null,
    later: upcoming.slice(1).map((s) => s.event),
    past: pastSpans.map((s) => s.event),
    isEventDay,
    isLiveMode,
    archiveAt: archiveAt !== null ? new Date(archiveAt).toISOString() : null,
    now: new Date(now).toISOString(),
  };
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  done: boolean;
}

export function countdownParts(target: DateInput, nowInput: DateInput): CountdownParts {
  const totalMs = Math.max(0, toDate(target).getTime() - toDate(nowInput).getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    done: totalMs === 0,
  };
}

/** "TODAY", "TOMORROW" or null — relative label for an event's day. */
export function relativeDayLabel(
  input: DateInput,
  nowInput: DateInput,
  timeZone: string,
): 'Today' | 'Tomorrow' | null {
  const key = localDateKey(input, timeZone);
  const now = toDate(nowInput).getTime();
  if (key === localDateKey(now, timeZone)) return 'Today';
  if (key === localDateKey(now + 86400000, timeZone)) return 'Tomorrow';
  return null;
}

/** Groups events by local date for the timeline, preserving chronological order. */
export function groupEventsByDay<E extends SchedulableEvent>(
  events: readonly E[],
  timeZone: string,
): { dateKey: string; date: Date; events: E[] }[] {
  const groups = new Map<string, { dateKey: string; date: Date; events: E[] }>();
  const sorted = [...events].sort(
    (a, b) => toDate(a.startDateTime).getTime() - toDate(b.startDateTime).getTime(),
  );
  for (const e of sorted) {
    const key = localDateKey(e.startDateTime, timeZone);
    const group = groups.get(key) ?? { dateKey: key, date: toDate(e.startDateTime), events: [] };
    group.events.push(e);
    groups.set(key, group);
  }
  return [...groups.values()];
}
