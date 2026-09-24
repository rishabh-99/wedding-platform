import { toDate, type DateInput } from './time';

/** Data-driven calendar links (Google, Outlook) and RFC 5545 ICS generation. */

export interface CalendarEventInput {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  start: DateInput;
  end: DateInput;
}

/** 20261020T053000Z */
export function toIcsUtc(input: DateInput): string {
  return toDate(input).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function googleCalendarUrl(e: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${toIcsUtc(e.start)}/${toIcsUtc(e.end)}`,
    details: [e.description, e.url].filter(Boolean).join('\n\n'),
    location: e.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(e: CalendarEventInput): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: toDate(e.start).toISOString(),
    enddt: toDate(e.end).toISOString(),
    body: [e.description, e.url].filter(Boolean).join('\n\n'),
    location: e.location ?? '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1. */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (bytes + len > 75) {
      out.push(current);
      current = ' ' + ch;
      bytes = 1 + len;
    } else {
      current += ch;
      bytes += len;
    }
  }
  out.push(current);
  return out.join('\r\n');
}

export function buildIcs(events: CalendarEventInput[], calendarName = 'Wedding Celebrations'): string {
  const stamp = toIcsUtc(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Platform//Celebrations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(e.start)}`,
      `DTEND:${toIcsUtc(e.end)}`,
      `SUMMARY:${escapeIcsText(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(e.title)}`,
      'TRIGGER:-PT2H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
