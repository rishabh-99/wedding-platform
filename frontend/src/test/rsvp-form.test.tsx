import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RsvpInput, RsvpSubmitResult } from '@wedding/shared';
import { RsvpForm } from '../components/rsvp/RsvpForm';
import { ApiError } from '../services/api';
import { EVENTS, TZ } from './fixtures';

describe('RsvpForm', () => {
  it('shows validation messages and does not submit invalid input', async () => {
    const submit = vi.fn();
    render(<RsvpForm events={EVENTS} timeZone={TZ} submit={submit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    expect(await screen.findByText('Please tell us your name')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
    expect(screen.getByText('Please choose at least one celebration')).toBeInTheDocument();
    expect(screen.getByText('Please tell us whose side you are from')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('lists every celebration from the data (none hardcoded)', () => {
    render(<RsvpForm events={EVENTS} timeZone={TZ} />);
    for (const e of EVENTS) expect(screen.getByRole('checkbox', { name: new RegExp(e.name.replace(/[/&]/g, '.')) })).toBeInTheDocument();
  });

  it('submits a complete RSVP with an idempotency key and shows a confirmation', async () => {
    const submit = vi.fn(async (input: RsvpInput): Promise<RsvpSubmitResult> => ({ id: 'r1', updated: false, guestName: String(input.guestName), attendanceStatus: 'ATTENDING' }));
    render(<RsvpForm events={EVENTS} timeZone={TZ} submit={submit} />);
    await userEvent.click(screen.getByText('Groom’s side'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Ananya Sharma');
    await userEvent.type(screen.getByLabelText(/Phone/), '+91 98100 11002');
    await userEvent.clear(screen.getByLabelText(/Number of guests/));
    await userEvent.type(screen.getByLabelText(/Number of guests/), '2');
    await userEvent.click(screen.getByRole('checkbox', { name: /Sangeet/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Jaimal/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const payload = submit.mock.calls[0]![0];
    expect(payload).toMatchObject({
      guestName: 'Ananya Sharma',
      phone: '+91 98100 11002',
      side: 'GROOM',
      attendanceStatus: 'ATTENDING',
      eventIds: ['sangeet', 'jaimal-phere'],
    });
    expect(Number(payload.numberOfGuests)).toBe(2);
    expect(payload.idempotencyKey).toEqual(expect.any(String));
    expect(await screen.findByTestId('rsvp-confirmation')).toHaveTextContent('Thank you, Ananya');
  });

  it('allows declining without choosing celebrations', async () => {
    const submit = vi.fn(async (_input: RsvpInput): Promise<RsvpSubmitResult> => ({ id: 'r2', updated: false, guestName: 'Arjun', attendanceStatus: 'DECLINED' }));
    render(<RsvpForm events={EVENTS} timeZone={TZ} submit={submit} />);
    await userEvent.click(screen.getByText('Unable to attend'));
    // The celebrations list animates out.
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: /Sangeet/ })).not.toBeInTheDocument());
    await userEvent.click(screen.getByText('Bride’s side'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Arjun Malhotra');
    await userEvent.type(screen.getByLabelText(/Phone/), '+44 7700 900123');
    await userEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0]![0]).toMatchObject({ attendanceStatus: 'DECLINED', eventIds: [] });
    expect(await screen.findByText(/We will miss you dearly/)).toBeInTheDocument();
  });

  it('shows a friendly error when the server rejects the RSVP', async () => {
    const submit = vi.fn(async () => {
      throw new ApiError(0, 'NETWORK', 'We could not reach the server. Please check your connection and try again.');
    });
    render(<RsvpForm events={EVENTS} timeZone={TZ} submit={submit} />);
    await userEvent.click(screen.getByText('Bride’s side'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Meera Joshi');
    await userEvent.type(screen.getByLabelText(/Phone/), '9810011007');
    await userEvent.click(screen.getByRole('checkbox', { name: /Sangeet/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server');
    expect(screen.getByRole('button', { name: 'Send RSVP' })).toBeEnabled();
  });
});
