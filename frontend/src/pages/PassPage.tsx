import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDayMonth,
  formatTime,
  formatWeekday,
  parseLocalDateTime,
  SIDE_LABELS,
  toLocalDateTimeInput,
  TRANSPORT_STATUS_LABELS,
  TRAVEL_MODE_LABELS,
  type GuestPortalDTO,
  type GuestTravelInput,
  type TransportStatus,
  type TravelMode,
} from '@wedding/shared';
import { MediaImage } from '../components/gallery/MediaImage';
import { Lightbox } from '../components/gallery/Lightbox';
import { NotificationToggle } from '../components/push/PushPrompt';
import { ContactCards } from '../components/sections/ContactCards';
import { useQrCode } from '../components/sections/WhatsAppGroup';
import { FramedCorners } from '../components/ornaments/Ornaments';
import { ErrorState, LoadingBlock, SectionHeading } from '../components/ui/primitives';
import { useSchedule } from '../hooks/useSchedule';
import { ApiError } from '../services/api';
import { useGuest, useGuestLogin, useGuestLogout, useGuestPhotoUpload, useUpdateTravel } from '../services/guest';

export default function PassPage() {
  const guest = useGuest();
  return (
    <section className="section">
      <div className="container-page max-w-3xl">
        {guest.isLoading ? (
          <LoadingBlock lines={6} label="Loading your pass" />
        ) : guest.isError ? (
          <ErrorState onRetry={() => guest.refetch()} />
        ) : guest.data ? (
          <Pass data={guest.data} />
        ) : (
          <SignIn />
        )}
      </div>
    </section>
  );
}

// ── Sign in ─────────────────────────────────────────────────────────────────

function SignIn() {
  const login = useGuestLogin();
  const [phone, setPhone] = useState('');
  const notFound = login.error instanceof ApiError && login.error.status === 404;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phone.trim()) login.mutate(phone.trim());
  };
  return (
    <>
      <SectionHeading
        as="h1"
        eyebrow="Your guest pass"
        title="Welcome"
        intro="Enter the mobile number you used for your RSVP to see your room, your entry pass and your journey details."
      />
      <form onSubmit={submit} className="card-paper mx-auto max-w-md px-6 py-8" noValidate>
        <label htmlFor="pass-phone" className="field-label">
          Mobile number
        </label>
        <input
          id="pass-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          className="field-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={!!login.error}
          aria-describedby={login.error ? 'pass-err' : undefined}
        />
        {login.error && (
          <p id="pass-err" className="field-error" role="alert">
            {notFound ? (
              <>
                We couldn’t find an RSVP with this number.{' '}
                <Link to="/rsvp" className="underline">
                  RSVP here
                </Link>{' '}
                first, or try the number another family member used.
              </>
            ) : (
              login.error.message
            )}
          </p>
        )}
        <button type="submit" className="btn-primary mt-5 w-full" disabled={login.isPending || !phone.trim()}>
          {login.isPending ? 'Opening…' : 'Open my pass'}
        </button>
      </form>
    </>
  );
}

// ── Signed in ───────────────────────────────────────────────────────────────

function Block({ title, eyebrow, children, id }: { title: string; eyebrow?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card-paper mt-6 px-5 py-6 sm:px-8 sm:py-8" aria-labelledby={id ? `${id}-title` : undefined}>
      {eyebrow && <p className="label-sm">{eyebrow}</p>}
      <h2 id={id ? `${id}-title` : undefined} className="mt-1 font-display text-2xl text-maroon sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Pass({ data }: { data: GuestPortalDTO }) {
  const logout = useGuestLogout();
  const firstName = data.guestName.split(' ')[0];
  return (
    <>
      <header className="text-center">
        <p className="label">Your guest pass</p>
        <h1 className="heading-lg mt-2">Namaste, {firstName}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          {data.numberOfGuests} {data.numberOfGuests === 1 ? 'guest' : 'guests'}
          {data.side && <> · {SIDE_LABELS[data.side]}</>}
          {data.attendanceStatus !== 'ATTENDING' && <> · RSVP: {data.attendanceStatus === 'MAYBE' ? 'Maybe' : 'Not attending'}</>}
        </p>
      </header>

      <QrPass data={data} />
      <StayBlock data={data} />
      <CelebrationsBlock data={data} />
      <JourneyBlock data={data} />
      <div className="mt-6">
        <NotificationToggle />
      </div>
      <PortraitsBlock data={data} />
      <SharedAlbumBlock data={data} />

      <div className="mt-10 text-center">
        <button type="button" className="btn-ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Sign out
        </button>
      </div>
    </>
  );
}

function QrPass({ data }: { data: GuestPortalDTO }) {
  const { dataUrl } = useQrCode(data.qrUrl, 640);
  return (
    <section className="card-paper relative mx-auto mt-8 max-w-md px-6 py-8 text-center" aria-labelledby="qr-title">
      <FramedCorners size="h-7 w-7" />
      <h2 id="qr-title" className="font-display text-2xl text-maroon">
        Family entry pass
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
        One pass for the whole family. Show it at the entrance of each celebration — and to our photographer.
      </p>
      <div className="mt-5 flex justify-center">
        {dataUrl ? (
          <img src={dataUrl} alt={`Entry pass QR code for ${data.guestName}`} width={240} height={240} className="border border-gold/40 bg-[#FFFDF7] p-1" />
        ) : (
          <div className="skeleton h-[240px] w-[240px]" aria-hidden="true" />
        )}
      </div>
      <p className="mt-3 font-display text-xl text-maroon">{data.guestName}</p>
      {dataUrl && (
        <a href={dataUrl} download={`guest-pass-${data.guestName.replace(/\s+/g, '-').toLowerCase()}.png`} className="btn-outline mt-4 px-5 py-2">
          Save to phone
        </a>
      )}
    </section>
  );
}

function StayBlock({ data }: { data: GuestPortalDTO }) {
  return (
    <Block id="stay" eyebrow="Where you’re staying" title={data.rooms.length ? 'Your room' : 'Room not allotted yet'}>
      {data.rooms.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.rooms.map((r) => (
            <li key={r.id} className="border border-gold/30 bg-ivory px-4 py-4">
              <p className="label-sm">{r.accommodationName}</p>
              <p className="mt-1 font-display text-3xl text-maroon">Room {r.roomNumber}</p>
              {r.notes && <p className="mt-1 text-sm text-ink-soft">{r.notes}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="body-copy">
          The hospitality team is still arranging rooms. Your room number will appear here as soon as it is allotted — no need to check back with anyone.
        </p>
      )}
      {data.hospitalityContacts.length > 0 && (
        <div className="mt-6">
          <p className="label-sm mb-3">Need help? Contact hospitality</p>
          <ContactCards contacts={data.hospitalityContacts} />
        </div>
      )}
    </Block>
  );
}

function CelebrationsBlock({ data }: { data: GuestPortalDTO }) {
  const { timezone } = useSchedule();
  if (!data.events.length) return null;
  return (
    <Block id="my-events" eyebrow="You’re joining us for" title="Your celebrations">
      <ul className="divide-y divide-gold/20">
        {data.events.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <Link to={`/celebrations/${e.slug}`} className="font-display text-xl text-maroon hover:underline">
                {e.name}
              </Link>
              <p className="text-sm text-ink-muted">
                {formatWeekday(e.startDateTime, timezone)}, {formatDayMonth(e.startDateTime, timezone)} · {formatTime(e.startDateTime, timezone)}
              </p>
            </div>
            {e.checkedIn ? (
              <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">✓ Arrived · {e.checkedIn}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Block>
  );
}

// ── Journey ────────────────────────────────────────────────────────────────

const MODES = Object.entries(TRAVEL_MODE_LABELS) as [TravelMode, string][];

function StatusChip({ status }: { status: TransportStatus }) {
  const tone = status === 'ASSIGNED' || status === 'DONE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800';
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{TRANSPORT_STATUS_LABELS[status]}</span>;
}

function JourneyBlock({ data }: { data: GuestPortalDTO }) {
  const { timezone } = useSchedule();
  const save = useUpdateTravel();
  const t = data.travel;
  const toInput = (iso: string | null) => (iso ? toLocalDateTimeInput(iso, timezone) : '');
  const initial = () => ({
    arrivalMode: t.arrivalMode ?? '',
    arrivalAt: toInput(t.arrivalAt),
    arrivalDetails: t.arrivalDetails ?? '',
    pickupNeeded: t.pickupNeeded,
    departureMode: t.departureMode ?? '',
    departureAt: toInput(t.departureAt),
    departureDetails: t.departureDetails ?? '',
    dropNeeded: t.dropNeeded,
  });
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const hasAny = !!(t.arrivalMode || t.arrivalAt || t.departureMode || t.departureAt);
  const [editing, setEditing] = useState(!hasAny);
  const prev = useRef(data.travel);
  useEffect(() => {
    if (prev.current !== data.travel && !editing) setForm(initial());
    prev.current = data.travel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.travel, editing]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: GuestTravelInput = {
      arrivalMode: (form.arrivalMode || null) as TravelMode | null,
      arrivalAt: form.arrivalAt ? parseLocalDateTime(form.arrivalAt, timezone).toISOString() : null,
      arrivalDetails: form.arrivalDetails,
      pickupNeeded: form.pickupNeeded,
      departureMode: (form.departureMode || null) as TravelMode | null,
      departureAt: form.departureAt ? parseLocalDateTime(form.departureAt, timezone).toISOString() : null,
      departureDetails: form.departureDetails,
      dropNeeded: form.dropNeeded,
    };
    save.mutate(input, {
      onSuccess: () => {
        setSaved(true);
        setEditing(false);
      },
    });
  };

  const when = (iso: string | null) => (iso ? `${formatWeekday(iso, timezone)}, ${formatDayMonth(iso, timezone)} · ${formatTime(iso, timezone)}` : 'Time not added');

  if (!editing) {
    return (
      <Block id="journey" eyebrow="Arrival & pickup" title="Your journey">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['Arriving', t.arrivalMode, t.arrivalAt, t.arrivalDetails, t.pickupNeeded, t.pickupStatus, 'Pickup'],
              ['Leaving', t.departureMode, t.departureAt, t.departureDetails, t.dropNeeded, t.dropStatus, 'Drop'],
            ] as const
          ).map(([label, mode, at, details, needed, status, kind]) => (
            <div key={label} className="border border-gold/30 bg-ivory px-4 py-4">
              <p className="label-sm">{label}</p>
              <p className="mt-1 font-display text-xl text-maroon">{mode ? TRAVEL_MODE_LABELS[mode] : 'Not added yet'}</p>
              <p className="text-sm text-ink-soft">{when(at)}</p>
              {details && <p className="mt-1 text-sm text-ink-soft">{details}</p>}
              <div className="mt-3 flex items-center gap-2 text-sm">
                {needed ? (
                  <>
                    <span className="text-ink-soft">{kind}:</span> <StatusChip status={status} />
                  </>
                ) : (
                  <span className="text-ink-muted">No {kind.toLowerCase()} needed</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {saved && (
          <p className="mt-3 text-sm text-emerald-800" role="status">
            Saved — the hospitality team can see this now.
          </p>
        )}
        <button type="button" className="btn-outline mt-5 px-5 py-2" onClick={() => setEditing(true)}>
          Edit journey details
        </button>
      </Block>
    );
  }

  const field = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
  });
  const leg = (prefix: 'arrival' | 'departure', title: string, checkKey: 'pickupNeeded' | 'dropNeeded', checkLabel: string) => (
    <fieldset className="border border-gold/30 bg-ivory px-4 py-4">
      <legend className="px-1 font-display text-xl text-maroon">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${prefix}-mode`}>
            Travelling by
          </label>
          <select id={`${prefix}-mode`} className="field-input" {...field(`${prefix}Mode`)}>
            <option value="">Choose…</option>
            {MODES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`${prefix}-at`}>
            Date & time (IST)
          </label>
          <input id={`${prefix}-at`} type="datetime-local" className="field-input" {...field(`${prefix}At`)} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor={`${prefix}-details`}>
            Train / flight number, station or airport
          </label>
          <input id={`${prefix}-details`} className="field-input" maxLength={300} placeholder="e.g. 12004 Shatabdi, Kanpur Central" {...field(`${prefix}Details`)} />
        </div>
      </div>
      <label className="mt-4 flex min-h-[44px] items-center gap-3 text-ink">
        <input
          type="checkbox"
          className="h-5 w-5 accent-maroon"
          checked={form[checkKey]}
          onChange={(e) => setForm({ ...form, [checkKey]: e.target.checked })}
        />
        {checkLabel}
      </label>
    </fieldset>
  );

  return (
    <Block id="journey" eyebrow="Arrival & pickup" title="Your journey">
      <p className="body-copy mb-5">Tell us how and when you’re arriving so we can arrange a pickup and have your room ready.</p>
      <form onSubmit={submit} className="space-y-5">
        {leg('arrival', 'Arriving in Kanpur', 'pickupNeeded', 'Please arrange a pickup for us')}
        {leg('departure', 'Leaving Kanpur', 'dropNeeded', 'Please arrange a drop for us')}
        {save.error && (
          <p className="field-error" role="alert">
            {save.error.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save journey'}
          </button>
          {hasAny && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setForm(initial());
                setEditing(false);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </Block>
  );
}

// ── Photos ─────────────────────────────────────────────────────────────────

function PortraitsBlock({ data }: { data: GuestPortalDTO }) {
  const { timezone } = useSchedule();
  const [open, setOpen] = useState<number | null>(null);
  const items = data.portraits.map((p) => p.media);
  return (
    <Block id="portraits" eyebrow="From our photographer" title="Your photos of the day">
      {data.portraitsAvailable ? (
        items.length ? (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.portraits.map((p, i) => (
                <li key={p.day}>
                  <button type="button" className="block w-full text-left" onClick={() => setOpen(i)} aria-label={`Open photo from ${p.day}`}>
                    <MediaImage media={p.media} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-[4/5]" />
                    <p className="mt-1 text-center text-xs text-ink-muted">
                      {formatWeekday(`${p.day}T12:00:00Z`, timezone)}, {formatDayMonth(`${p.day}T12:00:00Z`, timezone)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            {open !== null && <Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndexChange={setOpen} />}
          </>
        ) : (
          <p className="body-copy">Your photos are still being edited — they’ll appear here soon.</p>
        )
      ) : (
        <p className="body-copy">
          Each day, our photographer will take a special photograph of your family — just show them your pass. After the wedding, those photos will be waiting for you right here.
        </p>
      )}
    </Block>
  );
}

function SharedAlbumBlock({ data }: { data: GuestPortalDTO }) {
  const upload = useGuestPhotoUpload();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = (list: FileList | null) => {
    const files = [...(list ?? [])].slice(0, 10);
    if (!files.length) return;
    setMessage(null);
    setProgress(0);
    upload.mutate(
      { files, onProgress: setProgress },
      {
        onSuccess: ({ results }) => {
          const ok = results.filter((r) => r.ok).length;
          const failed = results.filter((r) => !r.ok);
          setMessage(
            `${ok ? `${ok} photo${ok === 1 ? '' : 's'} shared — they’ll appear in the gallery once the family approves them.` : ''}${
              failed.length ? ` ${failed.map((f) => `${f.filename}: ${f.error}`).join(' · ')}` : ''
            }`.trim(),
          );
        },
        onError: (err) => setMessage(err.message),
        onSettled: () => {
          setProgress(null);
          if (inputRef.current) inputRef.current.value = '';
        },
      },
    );
  };

  return (
    <Block id="share" eyebrow="Shared album" title="Share your photos">
      <p className="body-copy">Took a lovely picture? Add it to the shared wedding album (up to 10 at a time).</p>
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" id="album-files" onChange={(e) => onFiles(e.target.files)} />
      <label htmlFor="album-files" className={`btn-primary mt-4 cursor-pointer ${upload.isPending ? 'pointer-events-none opacity-60' : ''}`}>
        {progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : 'Choose photos'}
      </label>
      {message && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {message}
        </p>
      )}
      {data.uploads.length > 0 && (
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {data.uploads.map((m) => (
            <li key={m.id} className="relative">
              <MediaImage media={m} sizes="120px" className="aspect-square" />
              <span
                className={`absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${
                  m.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800' : 'bg-ivory/90 text-ink-soft'
                }`}
              >
                {m.status === 'APPROVED' ? 'In gallery' : 'Awaiting approval'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}
