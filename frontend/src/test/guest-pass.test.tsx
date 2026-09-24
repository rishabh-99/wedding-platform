import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuestPortalDTO } from '@wedding/shared';
import { ClockProvider } from '../App';
import { tokenFromScan } from '../admin/staffApi';
import { NotificationToggle } from '../components/push/PushPrompt';
import PassPage from '../pages/PassPage';
import { EVENTS } from './fixtures';

const portal = (over: Partial<GuestPortalDTO> = {}): GuestPortalDTO => ({
  rsvpId: 'r1',
  guestName: 'Kabir Singh',
  phone: '+91 98100 11002',
  numberOfGuests: 3,
  side: 'GROOM',
  attendanceStatus: 'ATTENDING',
  qrUrl: 'https://wedding.example.com/q/abc-123',
  events: [
    { id: 'sangeet', name: 'Sangeet', slug: 'sangeet', startDateTime: '2026-12-03T13:30:00.000Z', checkedIn: 3 },
    { id: 'jaimal-phere', name: 'Jaimal & Phere', slug: 'jaimal-phere', startDateTime: '2026-12-04T14:30:00.000Z', checkedIn: null },
  ],
  rooms: [{ id: 'a1', rsvpId: 'r1', accommodationId: 'h1', accommodationName: 'Hotel One', roomNumber: '204', checkIn: null, checkOut: null, notes: null }],
  travel: {
    arrivalMode: null,
    arrivalAt: null,
    arrivalDetails: null,
    pickupNeeded: false,
    pickupStatus: 'NOT_NEEDED',
    departureMode: null,
    departureAt: null,
    departureDetails: null,
    dropNeeded: false,
    dropStatus: 'NOT_NEEDED',
  },
  hospitalityContacts: [
    { id: 'c1', name: 'Meera', role: 'Hospitality desk', phone: '+91 90000 00001', whatsapp: null, email: null, notes: null, eventId: null, event: null, displayOrder: 0, isPublished: true } as never,
  ],
  portraits: [],
  portraitsAvailable: false,
  uploads: [],
  ...over,
});

type Handler = (init: RequestInit | undefined) => { status: number; body?: unknown };
let routes: Record<string, Handler>;
const calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  calls.length = 0;
  routes = {
    'GET /api/events': () => ({ status: 200, body: EVENTS }),
    'GET /api/settings': () => ({ status: 200, body: { timezone: 'Asia/Kolkata', liveMode: 'AUTO', sections: {} } }),
    'GET /api/schedule': () => ({ status: 200, body: { serverTime: new Date().toISOString() } }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      const path = url.split('?')[0]!;
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const handler = routes[`${method} ${path}`];
      const res = handler ? handler(init) : { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found' } } };
      return new Response(res.body === undefined ? null : JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderPass() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClockProvider>
        <MemoryRouter>
          <PassPage />
        </MemoryRouter>
      </ClockProvider>
    </QueryClientProvider>,
  );
}

describe('Guest pass', () => {
  it('asks for the RSVP phone number, then shows the family pass', async () => {
    let signedIn = false;
    routes['GET /api/guest/me'] = () => (signedIn ? { status: 200, body: portal() } : { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Sign in' } } });
    routes['POST /api/guest/login'] = () => {
      signedIn = true;
      return { status: 200, body: portal() };
    };
    renderPass();
    await userEvent.type(await screen.findByLabelText('Mobile number'), '98100 11002');
    await userEvent.click(screen.getByRole('button', { name: 'Open my pass' }));

    expect(await screen.findByText('Namaste, Kabir')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ phone: '98100 11002' });
    expect(screen.getByText('Room 204')).toBeInTheDocument();
    expect(screen.getByText('✓ Arrived · 3')).toBeInTheDocument();
    expect(screen.getByText('Meera')).toBeInTheDocument();
    // One QR for the whole family, generated in the browser.
    expect(await screen.findByAltText('Entry pass QR code for Kabir Singh', {}, { timeout: 10_000 })).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/));
  }, 15_000);

  it('explains when a number has no RSVP', async () => {
    routes['GET /api/guest/me'] = () => ({ status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Sign in' } } });
    routes['POST /api/guest/login'] = () => ({ status: 404, body: { error: { code: 'NO_RSVP', message: 'No RSVP' } } });
    renderPass();
    await userEvent.type(await screen.findByLabelText('Mobile number'), '99999 99999');
    await userEvent.click(screen.getByRole('button', { name: 'Open my pass' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t find an RSVP');
    expect(within(screen.getByRole('alert')).getByRole('link', { name: 'RSVP here' })).toHaveAttribute('href', '/rsvp');
  });

  it('shows an unallotted room and lets the family share their journey (times in IST)', async () => {
    routes['GET /api/guest/me'] = () => ({ status: 200, body: portal({ rooms: [] }) });
    routes['PUT /api/guest/travel'] = () => ({ status: 200, body: portal({ rooms: [] }) });
    renderPass();
    expect(await screen.findByText('Room not allotted yet')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Travelling by', { selector: '#arrival-mode' }), 'TRAIN');
    await userEvent.type(screen.getByLabelText('Date & time (IST)', { selector: '#arrival-at' }), '2026-12-02T18:30');
    await userEvent.type(screen.getByLabelText(/Train \/ flight number/, { selector: '#arrival-details' }), '12004 Shatabdi');
    await userEvent.click(screen.getByLabelText('Please arrange a pickup for us'));
    await userEvent.click(screen.getByRole('button', { name: 'Save journey' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({
      arrivalMode: 'TRAIN',
      arrivalAt: '2026-12-02T13:00:00.000Z',
      arrivalDetails: '12004 Shatabdi',
      pickupNeeded: true,
      departureMode: null,
    });
  });

  it('shows the photographer’s photos only after the wedding', async () => {
    routes['GET /api/guest/me'] = () => ({ status: 200, body: portal() });
    renderPass();
    expect(await screen.findByText(/After the wedding, those photos will be waiting for you/)).toBeInTheDocument();
  });
});

describe('Notifications & scanning helpers', () => {
  it('explains when the browser cannot do push notifications', async () => {
    render(<NotificationToggle />);
    expect(await screen.findByText(/can’t show notifications|add this site to your Home Screen/)).toBeInTheDocument();
  });

  it('reads a pass token from a scanned URL or a bare token', () => {
    expect(tokenFromScan('https://wedding.example.com/q/abc-123')).toBe('abc-123');
    expect(tokenFromScan('  abc-123 ')).toBe('abc-123');
    expect(tokenFromScan('https://wedding.example.com/q/abc-123?x=1')).toBe('abc-123');
  });
});
