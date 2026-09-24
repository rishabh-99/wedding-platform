/**
 * Timezone helpers built on Intl only (no external tz database needed).
 * All instants are handled as UTC; the wedding timezone is used purely for
 * presentation and for "which local calendar day is it" questions.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export type DateInput = Date | string | number;

export function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(input: DateInput, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(toDate(input));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** YYYY-MM-DD of the instant as seen in the given timezone. */
export function localDateKey(input: DateInput, timeZone: string): string {
  const p = zonedParts(input, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Offset (ms) of the timezone from UTC at the given instant. */
export function tzOffsetMs(input: DateInput, timeZone: string): number {
  const d = toDate(input);
  const p = zonedParts(d, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
  second = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = tzOffsetMs(guess, timeZone);
  const candidate = guess - offset1;
  const offset2 = tzOffsetMs(candidate, timeZone);
  return new Date(offset1 === offset2 ? candidate : guess - offset2);
}

/** Parse "YYYY-MM-DDTHH:mm" as wall-clock time in the timezone. */
export function parseLocalDateTime(value: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!m) throw new Error(`Invalid local datetime: ${value}`);
  return zonedTimeToUtc(+m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!, timeZone);
}

/** Format a UTC instant as "YYYY-MM-DDTHH:mm" wall-clock time in the timezone (for form inputs). */
export function toLocalDateTimeInput(input: DateInput, timeZone: string): string {
  const p = zonedParts(input, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** The last millisecond of the local calendar day containing `input`. */
export function endOfLocalDay(input: DateInput, timeZone: string): Date {
  const p = zonedParts(input, timeZone);
  const startNext = zonedTimeToUtc(p.year, p.month, p.day + 1, 0, 0, timeZone);
  return new Date(startNext.getTime() - 1);
}

export function formatInTz(
  input: DateInput,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-GB',
): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(toDate(input));
}

/** "20 October 2026" */
export function formatLongDate(input: DateInput, timeZone: string): string {
  return formatInTz(input, timeZone, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "20 October" */
export function formatDayMonth(input: DateInput, timeZone: string): string {
  return formatInTz(input, timeZone, { day: 'numeric', month: 'long' });
}

/** "Tuesday" */
export function formatWeekday(input: DateInput, timeZone: string): string {
  return formatInTz(input, timeZone, { weekday: 'long' });
}

/** "11:00 AM" */
export function formatTime(input: DateInput, timeZone: string): string {
  return formatInTz(input, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true }, 'en-US');
}

/** "20 Oct 2026, 11:00 AM" — used in admin tables and exports. */
export function formatDateTime(input: DateInput, timeZone: string): string {
  return `${formatInTz(input, timeZone, { day: 'numeric', month: 'short', year: 'numeric' })}, ${formatTime(input, timeZone)}`;
}
