import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ATTENDANCE_LABELS,
  SIDE_LABELS,
  formatDayMonth,
  formatTime,
  rsvpInputSchema,
  type AttendanceStatus,
  type EventDTO,
  type GuestSide,
  type RsvpInput,
  type RsvpSubmitResult,
} from '@wedding/shared';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../services/api';
import { guestKey } from '../../services/guest';
import { OrnamentDivider } from '../ornaments/Ornaments';

interface Props {
  events: EventDTO[];
  timeZone: string;
  /** Injected for tests. */
  submit?: (input: RsvpInput) => Promise<RsvpSubmitResult>;
}

const newKey = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * RSVP flow. Validation uses the same zod schema as the API. Duplicate
 * protection: the button locks while submitting, and an idempotency key makes
 * retries/double-taps return the original RSVP; the server also merges by phone.
 */
export function RsvpForm({ events, timeZone: tz, submit }: Props) {
  const [result, setResult] = useState<RsvpSubmitResult | null>(null);
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const idempotencyKey = useRef(newKey());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RsvpInput>({
    resolver: zodResolver(rsvpInputSchema),
    defaultValues: {
      guestName: '',
      phone: '',
      email: '',
      numberOfGuests: 1,
      attendanceStatus: 'ATTENDING',
      eventIds: [],
      message: '',
      website: '',
    },
  });

  const status = watch('attendanceStatus') as AttendanceStatus;
  const side = watch('side') as GuestSide | undefined;
  const selected = watch('eventIds') ?? [];
  const declined = status === 'DECLINED';
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime)),
    [events],
  );

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const payload: RsvpInput = { ...values, idempotencyKey: idempotencyKey.current, eventIds: declined ? [] : values.eventIds };
      const res = await (submit ?? ((v: RsvpInput) => api.post<RsvpSubmitResult>('/api/rsvp', v)))(payload);
      setResult(res);
      // Submitting an RSVP also signs this device in to the family's guest pass.
      void qc.invalidateQueries({ queryKey: guestKey });
      window.scrollTo?.({ top: (document.getElementById('rsvp')?.offsetTop ?? 0) - 80, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fields)) {
          setError(field as keyof RsvpInput, { message });
        }
        setServerError(err.message);
      } else {
        setServerError('We could not send your RSVP. Please try again.');
      }
    }
  });

  const toggleEvent = (id: string) => {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setValue('eventIds', [...set], { shouldValidate: !!errors.eventIds });
  };

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-paper mx-auto max-w-xl px-6 py-12 text-center sm:px-10"
        role="status"
        data-testid="rsvp-confirmation"
      >
        <p className="label">{result.updated ? 'RSVP updated' : 'RSVP received'}</p>
        <h3 className="mt-3 font-display text-4xl text-maroon">Thank you, {result.guestName.split(' ')[0]}</h3>
        <OrnamentDivider className="mx-auto mt-5" />
        <p className="body-copy mx-auto mt-5 max-w-sm">
          {result.attendanceStatus === 'DECLINED'
            ? 'We will miss you dearly, and we are grateful to have you in our thoughts.'
            : result.attendanceStatus === 'MAYBE'
              ? 'Thank you for letting us know. Please update your RSVP whenever your plans are confirmed.'
              : 'We are so looking forward to celebrating with you.'}
        </p>
        {result.updated && (
          <p className="mt-3 text-sm text-ink-muted">We found an earlier RSVP with this phone number and updated it.</p>
        )}
        {result.attendanceStatus !== 'DECLINED' && (
          <div className="mt-6">
            <Link to="/pass" className="btn-primary">
              Open your guest pass
            </Link>
            <p className="mt-2 text-xs text-ink-muted">Your entry QR, room details and journey — all in one place.</p>
          </div>
        )}
        <button
          type="button"
          className="btn-ghost mt-6"
          onClick={() => {
            idempotencyKey.current = newKey();
            reset();
            setResult(null);
          }}
        >
          Submit another RSVP
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card-paper mx-auto max-w-2xl px-5 py-8 sm:px-10 sm:py-12" aria-describedby="rsvp-help">
      <p id="rsvp-help" className="sr-only">
        All fields except email and message are required.
      </p>
      {/* Honeypot for bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>

      <fieldset>
        <legend className="field-label">Will you be joining us?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((s) => (
            <label
              key={s}
              className={`flex min-h-[52px] cursor-pointer items-center justify-center border px-3 text-center font-label text-[0.7rem] uppercase tracking-wide2 transition-colors ${
                status === s ? 'border-maroon bg-maroon text-ivory' : 'border-gold/40 text-ink-soft hover:border-gold'
              }`}
            >
              <input type="radio" value={s} className="sr-only" {...register('attendanceStatus')} />
              {ATTENDANCE_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="field-label">You are a guest of</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SIDE_LABELS) as GuestSide[]).map((s) => (
            <label
              key={s}
              className={`flex min-h-[52px] cursor-pointer items-center justify-center border px-3 text-center font-label text-[0.7rem] uppercase tracking-wide2 transition-colors ${
                side === s ? 'border-maroon bg-maroon/[0.06] text-maroon' : 'border-gold/40 text-ink-soft hover:border-gold'
              }`}
            >
              <input type="radio" value={s} className="sr-only" {...register('side')} />
              {SIDE_LABELS[s]}
            </label>
          ))}
        </div>
        {errors.side?.message && (
          <p className="field-error" role="alert">
            {errors.side.message}
          </p>
        )}
      </fieldset>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={errors.guestName?.message} id="guestName">
          <input id="guestName" autoComplete="name" className="field-input" {...register('guestName')} aria-invalid={!!errors.guestName} />
        </Field>
        <Field label="Phone (WhatsApp preferred)" error={errors.phone?.message} id="phone">
          <input id="phone" type="tel" inputMode="tel" autoComplete="tel" className="field-input" placeholder="+91" {...register('phone')} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="Email (optional)" error={errors.email?.message} id="email">
          <input id="email" type="email" inputMode="email" autoComplete="email" className="field-input" {...register('email')} aria-invalid={!!errors.email} />
        </Field>
        {!declined && (
          <Field label="Number of guests (including you)" error={errors.numberOfGuests?.message} id="numberOfGuests">
            <input id="numberOfGuests" type="number" min={1} max={20} inputMode="numeric" className="field-input" {...register('numberOfGuests')} aria-invalid={!!errors.numberOfGuests} />
          </Field>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!declined && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <fieldset className="mt-7">
              <legend className="field-label">Which celebrations will you attend?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {sortedEvents.map((e) => {
                  const checked = selected.includes(e.id);
                  return (
                    <label
                      key={e.id}
                      className={`flex min-h-[56px] cursor-pointer items-center gap-3 border px-4 py-2 transition-colors ${
                        checked ? 'border-maroon bg-maroon/[0.05]' : 'border-gold/35 hover:border-gold'
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleEvent(e.id)} className="h-5 w-5 accent-maroon" />
                      <span>
                        <span className="block font-display text-lg leading-tight text-ink">{e.name}</span>
                        <span className="block text-xs text-ink-muted">
                          {formatDayMonth(e.startDateTime, tz)} · {formatTime(e.startDateTime, tz)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.eventIds?.message && <p className="field-error" role="alert">{errors.eventIds.message}</p>}
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-7">
        <Field label="A note for the couple (optional)" id="message" error={errors.message?.message}>
          <textarea id="message" rows={4} className="field-input resize-y" {...register('message')} />
        </Field>
      </div>

      {serverError && (
        <p role="alert" className="mt-6 border border-maroon/30 bg-maroon/[0.04] px-4 py-3 text-sm text-maroon">
          {serverError}
        </p>
      )}

      <div className="mt-8 text-center">
        <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-[16rem]" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send RSVP'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, id, children }: { label: string; error?: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error && (
        <p className="field-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
