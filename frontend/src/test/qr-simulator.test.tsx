import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computeSchedule } from '@wedding/shared';
import { WhatsAppGroupCard } from '../components/sections/WhatsAppGroup';
import { ClockContext, useClock, useClockState } from '../hooks/useClock';
import { EVENTS, TZ, at } from './fixtures';

describe('WhatsApp group QR', () => {
  it('renders a QR code image and a join link for the configured URL', async () => {
    render(<WhatsAppGroupCard url="https://chat.whatsapp.com/AbC123" />);
    // First load of the (lazy) qrcode library can be slow in the test environment.
    const img = await screen.findByAltText('QR code to join the wedding WhatsApp group', {}, { timeout: 10_000 });
    await waitFor(() => expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/));
    expect(screen.getByRole('link', { name: /Join the group/ })).toHaveAttribute('href', 'https://chat.whatsapp.com/AbC123');
  });

  it('renders nothing when no link is configured', () => {
    const { container } = render(<WhatsAppGroupCard url={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('regenerates the QR when the link changes', async () => {
    const { rerender } = render(<WhatsAppGroupCard url="https://chat.whatsapp.com/First" />);
    const first = await screen.findByAltText(/QR code/);
    await waitFor(() => expect(first.getAttribute('src')).toMatch(/^data:image/));
    const firstSrc = first.getAttribute('src');
    rerender(<WhatsAppGroupCard url="https://chat.whatsapp.com/Second" />);
    await waitFor(() => expect(screen.getByAltText(/QR code/).getAttribute('src')).not.toBe(firstSrc));
  });
});

describe('time simulator clock', () => {
  function Probe() {
    const { now, isTimeTravel, setSimulatedTime } = useClock();
    const phase = computeSchedule(EVENTS, now, { timeZone: TZ }).phase;
    return (
      <div>
        <p data-testid="phase">{phase}</p>
        <p data-testid="tt">{String(isTimeTravel)}</p>
        <button onClick={() => setSimulatedTime(at('2026-12-03T21:20'))}>sangeet</button>
        <button onClick={() => setSimulatedTime(at('2026-12-06T10:00'))}>archive</button>
        <button onClick={() => setSimulatedTime(null)}>real</button>
      </div>
    );
  }
  function Provider() {
    const clock = useClockState();
    return (
      <ClockContext.Provider value={clock}>
        <Probe />
      </ClockContext.Provider>
    );
  }

  it('jumps into live mode and the archive, and back to real time', () => {
    sessionStorage.clear();
    render(<Provider />);
    expect(screen.getByTestId('tt')).toHaveTextContent('false');
    act(() => screen.getByText('sangeet').click());
    expect(screen.getByTestId('phase')).toHaveTextContent('live');
    expect(screen.getByTestId('tt')).toHaveTextContent('true');
    act(() => screen.getByText('archive').click());
    expect(screen.getByTestId('phase')).toHaveTextContent('archive');
    act(() => screen.getByText('real').click());
    expect(screen.getByTestId('tt')).toHaveTextContent('false');
    expect(sessionStorage.getItem('wedding.timeTravel')).toBeNull();
  });
});
