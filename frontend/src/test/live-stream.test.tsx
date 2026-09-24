import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveUpdateDTO, RealtimeMessage } from '@wedding/shared';
import { LiveFeed } from '../components/live/LiveFeed';
import { useLiveStream, type LiveStreamOptions } from '../hooks/useLiveStream';
import { useLiveUpdates } from '../services/queries';
import { TZ, livePost } from './fixtures';

/** Minimal controllable EventSource. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readyState = 0;
  url: string;
  private listeners = new Map<string, ((e: MessageEvent | Event) => void)[]>();
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent | Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener() {}
  close() {
    this.readyState = 2;
  }
  emit(type: string, data?: unknown) {
    const event = data === undefined ? new Event(type) : new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.forEach((fn) => fn(event));
  }
  open() {
    this.readyState = 1;
    this.emit('open');
  }
}

function LiveHarness(props: { options: LiveStreamOptions }) {
  const state = useLiveStream(props.options);
  const { data } = useLiveUpdates();
  return (
    <div>
      <p data-testid="state">{state}</p>
      <LiveFeed updates={data ?? []} timeZone={TZ} />
    </div>
  );
}

const existing = livePost('p1', 'Marigolds everywhere', '2026-12-03T09:35', 1);
const incoming = livePost('p2', 'The dance floor is officially open!', '2026-12-03T21:18');

function renderHarness(options: LiveStreamOptions) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LiveHarness options={options} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('useLiveStream → live feed', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakeEventSource.instances = [];
    fetchMock = vi.fn(async (url: string) => {
      const body: LiveUpdateDTO | LiveUpdateDTO[] = url.startsWith('/api/live/p2') ? incoming : [existing];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders a new post the moment an SSE event arrives — no refresh', async () => {
    renderHarness({ EventSourceImpl: FakeEventSource as unknown as typeof EventSource });
    expect(await screen.findByText('Marigolds everywhere')).toBeInTheDocument();
    const es = FakeEventSource.instances[0]!;
    expect(es.url).toBe('/api/live/stream');
    act(() => es.open());
    expect(screen.getByTestId('state')).toHaveTextContent('open');

    const msg: RealtimeMessage = { id: 101, type: 'LIVE_UPDATE_CREATED', eventId: 'sangeet', postId: 'p2', timestamp: new Date().toISOString() };
    act(() => es.emit('message', msg));

    expect(await screen.findByText('The dance floor is officially open!')).toBeInTheDocument();
    const entries = screen.getAllByTestId('live-entry');
    expect(entries[0]).toHaveTextContent('The dance floor is officially open!'); // newest first
    expect(fetchMock).toHaveBeenCalledWith('/api/live/p2', expect.anything());

    // Duplicate delivery (e.g. replay after reconnect) is ignored.
    const callsBefore = fetchMock.mock.calls.length;
    act(() => es.emit('message', msg));
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(screen.getAllByTestId('live-entry')).toHaveLength(2);
  });

  it('removes a post when it is unpublished', async () => {
    renderHarness({ EventSourceImpl: FakeEventSource as unknown as typeof EventSource });
    expect(await screen.findByText('Marigolds everywhere')).toBeInTheDocument();
    const es = FakeEventSource.instances[0]!;
    act(() => es.emit('message', { id: 5, type: 'LIVE_UPDATE_DELETED', eventId: null, postId: 'p1', timestamp: '' }));
    await waitFor(() => expect(screen.queryByText('Marigolds everywhere')).not.toBeInTheDocument());
  });

  it('falls back to polling when EventSource is unavailable', async () => {
    renderHarness({ EventSourceImpl: undefined, pollIntervalMs: 50 });
    expect(screen.getByTestId('state')).toHaveTextContent('polling');
    expect(await screen.findByText('Marigolds everywhere')).toBeInTheDocument();
    const initialCalls = fetchMock.mock.calls.length;
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls), { timeout: 2000 });
  });

  it('falls back to polling after repeated connection failures', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderHarness({ EventSourceImpl: FakeEventSource as unknown as typeof EventSource, maxFailures: 2 });
      const first = FakeEventSource.instances[0]!;
      act(() => {
        first.readyState = 2;
        first.emit('error');
      });
      expect(screen.getByTestId('state')).toHaveTextContent('reconnecting');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      const second = FakeEventSource.instances[1]!;
      expect(second).toBeDefined();
      act(() => {
        second.readyState = 2;
        second.emit('error');
      });
      expect(screen.getByTestId('state')).toHaveTextContent('polling');
    } finally {
      vi.useRealTimers();
    }
  });
});
