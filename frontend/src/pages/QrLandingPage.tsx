import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  can,
  formatTime,
  ROLE_LABELS,
  SIDE_LABELS,
  TRANSPORT_STATUS_LABELS,
  TRAVEL_MODE_LABELS,
  type PortraitBoardDTO,
  type SessionUser,
  type StaffGuestCardDTO,
} from '@wedding/shared';
import { ErrorState, LoadingBlock } from '../components/ui/primitives';
import { useSchedule } from '../hooks/useSchedule';
import { api, ApiError, setCsrfToken, uploadWithProgress } from '../services/api';
import { useGuest } from '../services/guest';

/**
 * Where a guest pass QR leads (`/q/<token>`), whichever camera scanned it.
 * - Signed-in team member → quick actions for their role (check in, photo of the day).
 * - The family itself → their guest pass.
 * - Anyone else → a short explanation.
 */
export default function QrLandingPage() {
  const { token = '' } = useParams();
  const staff = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => api.get<{ user: SessionUser; csrfToken: string }>('/api/admin/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (staff.data?.csrfToken) setCsrfToken(staff.data.csrfToken);
  }, [staff.data?.csrfToken]);
  const guest = useGuest();

  return (
    <section className="section">
      <div className="container-page max-w-xl">
        {staff.isLoading || (staff.isError && guest.isLoading) ? (
          <LoadingBlock lines={4} label="Reading the pass" />
        ) : staff.data ? (
          <StaffActions token={token} user={staff.data.user} />
        ) : guest.data ? (
          <Navigate to="/pass" replace />
        ) : (
          <div className="card-paper px-6 py-10 text-center">
            <p className="label">Guest pass</p>
            <h1 className="mt-2 font-display text-3xl text-maroon">This is a family’s entry pass</h1>
            <p className="body-copy mx-auto mt-3 max-w-sm">
              Our team scans it at each celebration. If it’s yours, open your pass with the phone number you RSVP’d with to see your room and journey details.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/pass" className="btn-primary">
                Open my pass
              </Link>
              <Link to="/admin/login" state={{ from: `/q/${token}` }} className="btn-ghost">
                Team sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StaffActions({ token, user }: { token: string; user: SessionUser }) {
  const allowed = can(user.role, 'checkin') || can(user.role, 'portraits') || can(user.role, 'rooms');
  const qc = useQueryClient();
  const card = useQuery({
    queryKey: ['admin', 'pass', token],
    queryFn: () => api.get<StaffGuestCardDTO>(`/api/admin/pass/${encodeURIComponent(token)}`),
    enabled: allowed,
    retry: false,
  });
  const schedule = useSchedule();
  const tz = schedule.timezone;
  // Same day the photographer's board uses: today if it's a wedding day, otherwise the next one.
  const portraitDay = useQuery({
    queryKey: ['admin', 'portraits', 'auto'],
    queryFn: () => api.get<PortraitBoardDTO>('/api/admin/portraits'),
    enabled: can(user.role, 'portraits'),
    select: (b) => b.days.find((d) => d.day === b.day) ?? null,
  });

  if (!allowed) {
    return <ErrorState title="Nothing to do here" message={`Your role (${ROLE_LABELS[user.role]}) doesn’t use guest passes.`} />;
  }
  if (card.isLoading) return <LoadingBlock lines={4} label="Looking up the guest" />;
  if (card.isError || !card.data) {
    const notFound = card.error instanceof ApiError && card.error.status === 404;
    return <ErrorState title={notFound ? 'Unknown pass' : 'Couldn’t read this pass'} message={notFound ? 'This QR code isn’t a guest pass for this wedding.' : undefined} onRetry={() => card.refetch()} />;
  }
  const c = card.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'pass', token] });
  const event = schedule.current ?? schedule.next ?? schedule.previous;

  return (
    <div className="space-y-4">
      <div className="card-paper px-6 py-6">
        <p className="label-sm">Guest pass · {ROLE_LABELS[user.role]}</p>
        <h1 className="mt-1 font-display text-3xl text-maroon">{c.guestName}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Party of {c.numberOfGuests}
          {c.side && <> · {SIDE_LABELS[c.side]}</>}
          {c.attendanceStatus !== 'ATTENDING' && <> · RSVP {c.attendanceStatus.toLowerCase()}</>}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{c.rooms.length ? `Room ${c.rooms.map((r) => `${r.roomNumber} · ${r.accommodationName}`).join(', ')}` : 'No room allotted'}</p>
        <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="mt-2 inline-block text-sm text-maroon underline">
          {c.phone}
        </a>
      </div>

      {can(user.role, 'checkin') && event && <CheckInAction card={c} eventId={event.id} eventName={event.name} onDone={refresh} />}
      {can(user.role, 'portraits') && portraitDay.data && <PortraitAction card={c} day={portraitDay.data.day} label={portraitDay.data.label} onDone={refresh} />}

      {can(user.role, 'rooms') && (
        <div className="card-paper px-6 py-5 text-sm text-ink-soft">
          <p className="label-sm mb-2">Journey</p>
          <p>
            Arriving: {c.travel.arrivalMode ? TRAVEL_MODE_LABELS[c.travel.arrivalMode] : '—'}
            {c.travel.arrivalAt && ` · ${formatTime(c.travel.arrivalAt, tz)}`} {c.travel.pickupNeeded && `· Pickup: ${TRANSPORT_STATUS_LABELS[c.travel.pickupStatus]}`}
          </p>
          <p>
            Leaving: {c.travel.departureMode ? TRAVEL_MODE_LABELS[c.travel.departureMode] : '—'}
            {c.travel.departureAt && ` · ${formatTime(c.travel.departureAt, tz)}`} {c.travel.dropNeeded && `· Drop: ${TRANSPORT_STATUS_LABELS[c.travel.dropStatus]}`}
          </p>
        </div>
      )}

      <p className="text-center text-sm">
        <Link to={can(user.role, 'checkin') ? '/admin/checkin' : can(user.role, 'portraits') ? '/admin/portraits' : '/admin'} className="text-maroon underline">
          Back to the team screen
        </Link>
      </p>
    </div>
  );
}

function CheckInAction({ card, eventId, eventName, onDone }: { card: StaffGuestCardDTO; eventId: string; eventName: string; onDone: () => void }) {
  const existing = card.events.find((e) => e.id === eventId)?.checkedIn ?? null;
  const [count, setCount] = useState(existing ?? card.numberOfGuests);
  const [state, setState] = useState<{ busy: boolean; msg: string | null; error: boolean }>({ busy: false, msg: null, error: false });
  const submit = async () => {
    setState({ busy: true, msg: null, error: false });
    try {
      await api.post('/api/admin/checkin', { token: card.qrToken, eventId, count, method: 'QR' });
      setState({ busy: false, msg: `✓ ${count} checked in for ${eventName}`, error: false });
      navigator.vibrate?.(60);
      onDone();
    } catch (err) {
      setState({ busy: false, msg: (err as Error).message, error: true });
    }
  };
  return (
    <div className="card-paper px-6 py-5">
      <p className="label-sm">Check in · {eventName}</p>
      {existing !== null && !state.msg && <p className="mt-2 text-sm text-emerald-800">Already checked in ({existing}). Saving again updates the count.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center border border-gold/50 bg-white">
          <button type="button" className="h-12 w-12 text-xl text-maroon" onClick={() => setCount(Math.max(1, count - 1))} aria-label="One fewer">
            −
          </button>
          <span className="w-10 text-center text-lg font-semibold tabular-nums">{count}</span>
          <button type="button" className="h-12 w-12 text-xl text-maroon" onClick={() => setCount(Math.min(50, count + 1))} aria-label="One more">
            +
          </button>
        </div>
        <button type="button" className="btn-primary" onClick={submit} disabled={state.busy}>
          Check in {count}
        </button>
      </div>
      {state.msg && (
        <p role="status" className={`mt-3 text-sm ${state.error ? 'text-maroon' : 'text-emerald-800'}`}>
          {state.msg}
        </p>
      )}
    </div>
  );
}

function PortraitAction({ card, day, label, onDone }: { card: StaffGuestCardDTO; day: string; label: string; onDone: () => void }) {
  const done = card.portraitDays.includes(day);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; msg: string | null; error: boolean }>({ busy: false, msg: null, error: false });
  const save = async (file?: File) => {
    setState({ busy: true, msg: null, error: false });
    try {
      const form = new FormData();
      form.append('token', card.qrToken);
      form.append('day', day);
      form.append('method', 'QR');
      if (file) form.append('photo', file);
      await uploadWithProgress('/api/admin/portraits', form);
      setState({ busy: false, msg: file ? '✓ Photo saved' : '✓ Marked as covered', error: false });
      onDone();
    } catch (err) {
      setState({ busy: false, msg: (err as Error).message, error: true });
    }
  };
  return (
    <div className="card-paper px-6 py-5">
      <p className="label-sm">Photo of the day · {label}</p>
      {done && !state.msg && <p className="mt-2 text-sm text-emerald-800">Already covered today — a new photo replaces the old one.</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void save(f);
          e.target.value = '';
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={state.busy} onClick={() => fileRef.current?.click()}>
          {state.busy ? 'Saving…' : 'Take photo'}
        </button>
        <button type="button" className="btn-outline" disabled={state.busy} onClick={() => save()}>
          Tick as covered
        </button>
      </div>
      {state.msg && (
        <p role="status" className={`mt-3 text-sm ${state.error ? 'text-maroon' : 'text-emerald-800'}`}>
          {state.msg}
        </p>
      )}
    </div>
  );
}
