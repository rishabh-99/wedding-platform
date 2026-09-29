import { forwardRef, useImperativeHandle } from 'react';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeSchedule, DEFAULT_SECTIONS, type EventDTO } from '@wedding/shared';
import { ClockProvider } from '../App';
import { EventTimeline } from '../components/events/EventTimeline';
import { WhatsHappeningNow } from '../components/events/WhatsHappeningNow';
import { FAMILY_CREDITS } from '../components/family/FamilyBlessings';
import { sceneForSlug } from '../film/sceneRegistry';
import { SiteHeader } from '../layouts/Navigation';
import { FamilyPage } from '../pages/ContentPages';
import EventPage from '../pages/EventPage';
import { EVENTS, TZ, at } from './fixtures';

// Remotion cannot draw in jsdom: stand in for the player and record what the page asks of it.
const film = vi.hoisted(() => ({
  player: { play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  inView: true,
  reduce: false,
}));

vi.mock('@remotion/player', () => ({
  Player: forwardRef<unknown, { initialFrame?: number }>(function Player(props, ref) {
    useImperativeHandle(ref, () => film.player);
    return <div data-testid="film-player" data-initial-frame={props.initialFrame} />;
  }),
  Thumbnail: (props: { frameToDisplay: number }) => <div data-testid="film-thumbnail" data-frame={props.frameToDisplay} />,
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useInView: () => film.inView, useReducedMotion: () => film.reduce };
});

/** The live site's event slugs (rishabhandnandita.in/api/events). */
const LIVE_SLUGS = ['engagement', 'haldi-mehendi', 'sangeet', 'sehra-bandhi', 'baraat', 'jaimal', 'the-pheras'];

let sections = { ...DEFAULT_SECTIONS };

beforeEach(() => {
  film.inView = true;
  film.reduce = false;
  sections = { ...DEFAULT_SECTIONS };
  Object.values(film.player).forEach((fn) => fn.mockClear());
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.split('?')[0]!;
      const slug = path.match(/^\/api\/events\/([^/]+)$/)?.[1];
      const event = slug ? EVENTS.find((e) => e.slug === slug) : undefined;
      const body =
        path === '/api/events'
          ? EVENTS
          : event
            ? event
            : path === '/api/settings'
              ? { timezone: TZ, liveMode: 'AUTO', sections }
              : path === '/api/schedule'
                ? { serverTime: new Date().toISOString() }
                : undefined;
      return body === undefined
        ? new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), { status: 404, headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string, element: React.ReactNode, route = '*') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClockProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </MemoryRouter>
      </ClockProvider>
    </QueryClientProvider>,
  );
}

describe('scene registry', () => {
  it('has a film scene for every celebration on the live site', () => {
    for (const slug of LIVE_SLUGS) {
      const scene = sceneForSlug(slug);
      expect(scene, slug).not.toBeNull();
      expect(scene!.holdFrame).toBeLessThan(scene!.dur);
      expect(scene!.crop).toBeGreaterThan(1000);
      expect(scene!.crop).toBeLessThanOrEqual(1920);
    }
  });

  it('has no scene for an unknown celebration', () => {
    expect(sceneForSlug('welcome-drinks')).toBeNull();
  });
});

describe('event page artwork', () => {
  it('plays the celebration’s scene once it is in view', async () => {
    renderAt('/celebrations/sangeet', <EventPage />, '/celebrations/:slug');
    expect(await screen.findByRole('img', { name: 'Illustration: Sangeet' })).toBeInTheDocument();
    expect(await screen.findByTestId('film-player')).toHaveAttribute('data-initial-frame', '0');
    expect(film.player.play).toHaveBeenCalled();
  });

  it('shows the finished composition without playing when motion is reduced', async () => {
    film.reduce = true;
    renderAt('/celebrations/sangeet', <EventPage />, '/celebrations/:slug');
    const player = await screen.findByTestId('film-player');
    expect(player).toHaveAttribute('data-initial-frame', String(sceneForSlug('sangeet')!.holdFrame));
    expect(film.player.play).not.toHaveBeenCalled();
  });

  it('keeps the page as it was for a celebration without a scene', async () => {
    const extra: EventDTO = { ...EVENTS[0]!, id: 'welcome', slug: 'welcome-drinks', name: 'Welcome Drinks' };
    EVENTS.push(extra);
    try {
      renderAt('/celebrations/welcome-drinks', <EventPage />, '/celebrations/:slug');
      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome Drinks' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: /Illustration/ })).not.toBeInTheDocument();
    } finally {
      EVENTS.pop();
    }
  });

  it('adds a still of each scene to the celebrations list only when asked', async () => {
    const { unmount } = renderAt('/', <EventTimeline events={EVENTS} timeZone={TZ} art />);
    expect(await screen.findAllByTestId('film-thumbnail')).toHaveLength(EVENTS.length);
    unmount();
    renderAt('/', <EventTimeline events={EVENTS} timeZone={TZ} />);
    expect(screen.queryByTestId('film-thumbnail')).not.toBeInTheDocument();
  });
});

describe('what’s happening artwork', () => {
  const show = (local: string) => {
    const now = at(local);
    return renderAt('/', <WhatsHappeningNow schedule={computeSchedule(EVENTS, now, { timeZone: TZ })} now={now} timeZone={TZ} />);
  };

  it('plays the next celebration’s scene and shows stills of the later ones', async () => {
    show('2026-09-24T10:00');
    expect(await screen.findByRole('img', { name: 'Illustration: Engagement' })).toBeInTheDocument();
    expect(film.player.play).toHaveBeenCalled();
    const later = screen.getByTestId('whn-later');
    expect(await within(later).findAllByTestId('film-thumbnail')).toHaveLength(Math.min(4, EVENTS.length - 1));
  });

  it('plays the scene of the celebration that is live now', async () => {
    show('2026-12-03T21:30');
    const live = screen.getByTestId('whn-current');
    expect(await within(live).findByRole('img', { name: 'Illustration: Sangeet' })).toBeInTheDocument();
    expect(await within(screen.getByTestId('whn-upnext')).findByTestId('film-thumbnail')).toBeInTheDocument();
  });

  it('after the wedding, shows every celebration’s scene', async () => {
    show('2026-12-10T12:00');
    const archive = screen.getByTestId('whn-archive');
    expect(await within(archive).findAllByTestId('film-thumbnail')).toHaveLength(EVENTS.length);
    for (const e of EVENTS) expect(within(archive).getByRole('link', { name: e.name })).toHaveAttribute('href', `/celebrations/${e.slug}`);
  });
});

describe('family page', () => {
  it('lists every name from the film’s family credits, in English only', async () => {
    film.reduce = true;
    const { container } = renderAt('/family', <FamilyPage />);
    // The portraits are a lazily loaded chunk; allow for a slow first import when the whole suite runs.
    await screen.findByRole('button', { name: /Hardik Sarin’s entrance/ }, { timeout: 5000 });
    for (const group of FAMILY_CREDITS) {
      expect(screen.getAllByText(group.heading).length).toBeGreaterThan(0);
      for (const n of group.names) expect(screen.getAllByText(n.name).length).toBeGreaterThan(0);
    }
    expect(container.textContent).not.toMatch(/[ऀ-ॿ]/);
  });

  it('sets the bride and groom apart from the rest of the family', async () => {
    film.reduce = true;
    renderAt('/family', <FamilyPage />);
    const couple = await screen.findByTestId('couple-credit');
    expect(within(couple).getByText('Nandita Misra')).toBeInTheDocument();
    expect(within(couple).getByText('Rishabh Mehrotra')).toBeInTheDocument();
    expect(within(couple).getByText('Dulhan')).toBeInTheDocument();
    expect(within(couple).getByText('Dulha')).toBeInTheDocument();
  });

  it('is hidden, with its menu link, when the section is switched off', async () => {
    sections = { ...DEFAULT_SECTIONS, family: false };
    renderAt('/family', <><SiteHeader /><FamilyPage /></>);
    expect(await screen.findByText('This section is not available right now')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Family' })).not.toBeInTheDocument();
  });
});
