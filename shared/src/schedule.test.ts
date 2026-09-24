import { describe, expect, it } from 'vitest';
import { computeSchedule, countdownParts, groupEventsByDay, relativeDayLabel } from './schedule';
import { parseLocalDateTime, formatTime, formatLongDate } from './time';
import { buildIcs, googleCalendarUrl, outlookCalendarUrl } from './calendar';

const TZ = 'Asia/Kolkata';
const at = (local: string) => parseLocalDateTime(local, TZ);

const events = [
  { id: 'engagement', name: 'Engagement', startDateTime: at('2026-10-20T11:00'), endDateTime: null },
  { id: 'haldi', name: 'Haldi / Mehendi', startDateTime: at('2026-12-03T09:00'), endDateTime: null },
  { id: 'sangeet', name: 'Sangeet', startDateTime: at('2026-12-03T21:00'), endDateTime: null },
  { id: 'sehra', name: 'Sehra-Bandhi', startDateTime: at('2026-12-04T08:00'), endDateTime: null },
  { id: 'baraat', name: 'Baraat', startDateTime: at('2026-12-04T09:00'), endDateTime: null },
  { id: 'phere', name: 'Jaimal & Phere', startDateTime: at('2026-12-04T11:00'), endDateTime: null },
];

const schedule = (local: string, liveMode: 'AUTO' | 'ON' | 'OFF' = 'AUTO') =>
  computeSchedule(events, at(local), { timeZone: TZ, liveMode });

describe('time helpers', () => {
  it('converts IST wall-clock to UTC', () => {
    expect(at('2026-10-20T11:00').toISOString()).toBe('2026-10-20T05:30:00.000Z');
  });
  it('formats in the wedding timezone', () => {
    expect(formatTime(at('2026-12-03T21:00'), TZ)).toBe('9:00 PM');
    expect(formatLongDate(at('2026-10-20T11:00'), TZ)).toBe('20 October 2026');
  });
});

describe('computeSchedule', () => {
  it('before everything: next is the engagement, pre phase', () => {
    const s = schedule('2026-09-24T10:00');
    expect(s.phase).toBe('pre');
    expect(s.next?.id).toBe('engagement');
    expect(s.later.map((e) => e.id)).toEqual(['haldi', 'sangeet', 'sehra', 'baraat', 'phere']);
    expect(s.current).toBeNull();
    expect(s.previous).toBeNull();
    expect(s.isLiveMode).toBe(false);
  });

  it('during the engagement: live', () => {
    const s = schedule('2026-10-20T12:15');
    expect(s.phase).toBe('live');
    expect(s.current?.id).toBe('engagement');
    expect(s.next?.id).toBe('haldi');
    expect(s.isLiveMode).toBe(true);
  });

  it('between engagement and December: pre, previous = engagement, next = haldi', () => {
    const s = schedule('2026-11-10T10:00');
    expect(s.phase).toBe('pre');
    expect(s.previous?.id).toBe('engagement');
    expect(s.next?.id).toBe('haldi');
  });

  it('on 3 Dec afternoon: between events, still live mode', () => {
    const s = schedule('2026-12-03T16:00');
    expect(s.phase).toBe('between');
    expect(s.current).toBeNull();
    expect(s.previous?.id).toBe('haldi');
    expect(s.next?.id).toBe('sangeet');
    expect(s.isEventDay).toBe(true);
    expect(s.isLiveMode).toBe(true);
  });

  it('during sangeet, past midnight, still live', () => {
    const s = schedule('2026-12-04T00:30');
    expect(s.phase).toBe('live');
    expect(s.current?.id).toBe('sangeet');
  });

  it('clips default durations at the next same-day event', () => {
    const s = schedule('2026-12-04T09:30');
    expect(s.current?.id).toBe('baraat');
    expect(s.previous?.id).toBe('sehra');
    expect(s.next?.id).toBe('phere');
  });

  it('after the wedding day: archive', () => {
    const s = schedule('2026-12-05T09:00');
    expect(s.phase).toBe('archive');
    expect(s.next).toBeNull();
    expect(s.previous?.id).toBe('phere');
    expect(s.isLiveMode).toBe(false);
  });

  it('evening of 4 Dec is still the wedding day, not archive yet', () => {
    const s = schedule('2026-12-04T22:00');
    expect(s.phase).toBe('between');
  });

  it('liveMode override', () => {
    expect(schedule('2026-09-24T10:00', 'ON').isLiveMode).toBe(true);
    expect(schedule('2026-12-03T10:00', 'OFF').isLiveMode).toBe(false);
  });

  it('handles no events', () => {
    const s = computeSchedule([], new Date(), { timeZone: TZ });
    expect(s.phase).toBe('pre');
    expect(s.next).toBeNull();
    expect(s.archiveAt).toBeNull();
  });
});

describe('countdownParts', () => {
  it('splits a duration', () => {
    const c = countdownParts(at('2026-10-20T11:00'), at('2026-10-18T09:58'));
    expect(c).toMatchObject({ days: 2, hours: 1, minutes: 2, seconds: 0, done: false });
  });
  it('never goes negative', () => {
    expect(countdownParts(0, 1000).done).toBe(true);
  });
});

describe('helpers', () => {
  it('relative day labels', () => {
    expect(relativeDayLabel(at('2026-12-03T21:00'), at('2026-12-03T08:00'), TZ)).toBe('Today');
    expect(relativeDayLabel(at('2026-12-04T08:00'), at('2026-12-03T23:00'), TZ)).toBe('Tomorrow');
    expect(relativeDayLabel(at('2026-12-04T08:00'), at('2026-12-01T23:00'), TZ)).toBeNull();
  });
  it('groups by local day', () => {
    const groups = groupEventsByDay(events, TZ);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-10-20', '2026-12-03', '2026-12-04']);
    expect(groups[2]!.events).toHaveLength(3);
  });
});

describe('calendar', () => {
  const input = {
    uid: 'sangeet@wedding',
    title: 'Sangeet — Rishabh & Nandita',
    description: 'Music, dance; celebration, and joy',
    location: 'Status Club, Kanpur',
    start: at('2026-12-03T21:00'),
    end: at('2026-12-04T01:00'),
  };
  it('builds a valid ICS', () => {
    const ics = buildIcs([input]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261203T153000Z');
    expect(ics).toContain('DTEND:20261203T193000Z');
    expect(ics).toContain('Music\\, dance\\; celebration\\, and joy');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
  it('builds Google/Outlook links', () => {
    expect(googleCalendarUrl(input)).toContain('dates=20261203T153000Z%2F20261203T193000Z');
    expect(outlookCalendarUrl(input)).toContain('startdt=2026-12-03T15%3A30%3A00.000Z');
  });
});
