import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { computeSchedule } from '@wedding/shared';
import { Countdown } from '../components/events/Countdown';
import { EventTimeline } from '../components/events/EventTimeline';
import { WhatsHappeningNow } from '../components/events/WhatsHappeningNow';
import { LiveFeed } from '../components/live/LiveFeed';
import { EVENTS, TZ, at, livePost } from './fixtures';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Countdown', () => {
  it('shows days, hours, minutes and seconds to the target', () => {
    render(<Countdown target={at('2026-10-20T11:00')} now={at('2026-09-24T09:58')} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveAccessibleName('26 days, 1 hours and 2 minutes to go');
    expect(within(timer).getByText('26')).toBeInTheDocument();
    expect(within(timer).getByText('01')).toBeInTheDocument();
    expect(within(timer).getByText('02')).toBeInTheDocument();
    expect(within(timer).getByText('00')).toBeInTheDocument();
    expect(within(timer).getByText('Days')).toBeInTheDocument();
  });

  it('stops at zero once the event has started', () => {
    render(<Countdown target={at('2026-10-20T11:00')} now={at('2026-10-20T12:00')} />);
    expect(screen.getByRole('timer')).toHaveAccessibleName('0 days, 0 hours and 0 minutes to go');
  });
});

describe('EventTimeline', () => {
  it('groups celebrations by day with times, venues and detail links', () => {
    wrap(<EventTimeline events={EVENTS} timeZone={TZ} />);
    expect(screen.getByRole('heading', { name: '20 October' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 December' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4 December' })).toBeInTheDocument();
    const sangeet = screen.getByRole('link', { name: /Sangeet, 3 December at 9:00 PM/ });
    expect(sangeet).toHaveAttribute('href', '/celebrations/sangeet');
    expect(within(sangeet).getByText(/9:00 PM onwards/)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(6);
  });

  it('marks the live event and concluded events', () => {
    wrap(<EventTimeline events={EVENTS} timeZone={TZ} currentId="sangeet" pastIds={['engagement', 'haldi-mehendi']} />);
    expect(screen.getByRole('link', { name: /Sangeet.*happening now/ })).toBeInTheDocument();
    expect(screen.getAllByText('Concluded')).toHaveLength(2);
  });
});

describe('WhatsHappeningNow', () => {
  const show = (local: string) => {
    const now = at(local);
    const schedule = computeSchedule(EVENTS, now, { timeZone: TZ });
    return wrap(<WhatsHappeningNow schedule={schedule} now={now} timeZone={TZ} />);
  };

  it('before the wedding: UP NEXT is the engagement', () => {
    show('2026-09-24T10:00');
    const next = screen.getByTestId('whn-next');
    expect(within(next).getByText('Up next')).toBeInTheDocument();
    expect(within(next).getByRole('heading', { name: 'Engagement' })).toBeInTheDocument();
    expect(within(next).getByText(/20 October · 11:00 AM/)).toBeInTheDocument();
    expect(screen.getByTestId('whn-later')).toHaveTextContent('Haldi / Mehendi');
  });

  it('during an event: LIVE, the current event and the time now', () => {
    show('2026-12-03T21:18');
    const live = screen.getByTestId('whn-current');
    expect(within(live).getByText('Live')).toBeInTheDocument();
    expect(within(live).getByText('What’s happening now')).toBeInTheDocument();
    expect(within(live).getByRole('heading', { name: 'Sangeet' })).toBeInTheDocument();
    expect(within(live).getByText('9:18 PM')).toBeInTheDocument();
    expect(screen.getByTestId('whn-upnext')).toHaveTextContent('Sehra-Bandhi');
    expect(screen.getByTestId('whn-upnext')).toHaveTextContent('Tomorrow · 8:00 AM');
  });

  it('between events: JUST HAPPENED and UP NEXT today', () => {
    show('2026-12-03T16:00');
    expect(screen.getByTestId('whn-previous')).toHaveTextContent('Haldi / Mehendi');
    const next = screen.getByTestId('whn-next');
    expect(within(next).getByRole('heading', { name: 'Sangeet' })).toBeInTheDocument();
    expect(within(next).getByText('Today · 9:00 PM')).toBeInTheDocument();
  });

  it('after the wedding: archive message', () => {
    show('2026-12-06T10:00');
    expect(screen.getByTestId('whn-archive')).toBeInTheDocument();
  });
});

describe('LiveFeed', () => {
  it('renders journal entries with event, time and caption, newest first', () => {
    const posts = [
      livePost('p2', 'The dance floor is officially open!', '2026-12-03T21:18'),
      livePost('p1', 'Marigolds everywhere', '2026-12-03T09:35', 1),
    ];
    wrap(<LiveFeed updates={posts} timeZone={TZ} />);
    const entries = screen.getAllByTestId('live-entry');
    expect(entries).toHaveLength(2);
    expect(within(entries[0]!).getByText('Sangeet')).toBeInTheDocument();
    expect(within(entries[0]!).getByText('9:18 PM')).toBeInTheDocument();
    expect(within(entries[0]!).getByText('The dance floor is officially open!')).toBeInTheDocument();
    expect(within(entries[1]!).getByText('Haldi / Mehendi')).toBeInTheDocument();
  });

  it('respects a limit', () => {
    const posts = [livePost('a', 'one', '2026-12-03T21:00'), livePost('b', 'two', '2026-12-03T21:10'), livePost('c', 'three', '2026-12-03T21:20')];
    wrap(<LiveFeed updates={posts} timeZone={TZ} limit={2} />);
    expect(screen.getAllByTestId('live-entry')).toHaveLength(2);
  });
});
