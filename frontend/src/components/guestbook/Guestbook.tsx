import { useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { formatLongDate, guestbookInputSchema, preflightUpload, type GuestbookDTO } from '@wedding/shared';
import { ApiError, uploadWithProgress } from '../../services/api';
import { MediaImage } from '../gallery/MediaImage';
import { OrnamentDivider } from '../ornaments/Ornaments';

/** Approved blessings, displayed as quiet stationery cards. */
export function BlessingCards({ items, timeZone }: { items: GuestbookDTO[]; timeZone: string }) {
  return (
    <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3">
      {items.map((g, i) => (
        <motion.li
          key={g.id}
          className="card-paper mb-5 break-inside-avoid px-6 py-7"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: (i % 3) * 0.06 }}
        >
          {g.media && <MediaImage media={g.media} sizes="(min-width: 1024px) 30vw, 90vw" className="mb-5" />}
          <span aria-hidden="true" className="block font-display text-5xl leading-none text-gold/60">“</span>
          <blockquote className="-mt-3 whitespace-pre-line font-display text-xl leading-snug text-ink">{g.message}</blockquote>
          <p className="mt-4 font-label text-[0.68rem] uppercase tracking-label text-maroon">— {g.guestName}</p>
          <p className="mt-1 text-xs text-ink-muted">{formatLongDate(g.createdAt, timeZone)}</p>
        </motion.li>
      ))}
    </ul>
  );
}

/** "Leave your blessings" — name, message and an optional photograph. Held for approval. */
export function GuestbookForm() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    setErrors((e) => ({ ...e, photo: '' }));
    if (!f) return setFile(null);
    const check = preflightUpload(f, { allowVideo: false, guest: true });
    if (!check.ok) {
      setErrors((e) => ({ ...e, photo: check.error ?? 'This file cannot be uploaded' }));
      return setFile(null);
    }
    setFile(f);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parsed = guestbookInputSchema.safeParse({ guestName: name, message, website: honeypot.current?.value ?? '' });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      return setErrors(fieldErrors);
    }
    setErrors({});
    const form = new FormData();
    form.set('guestName', parsed.data.guestName);
    form.set('message', parsed.data.message);
    form.set('website', honeypot.current?.value ?? '');
    if (file) form.set('photo', file);
    try {
      setProgress(0);
      await uploadWithProgress('/api/guestbook', form, setProgress);
      setDone(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Your message could not be sent. Please try again.');
    } finally {
      setProgress(null);
    }
  };

  if (done) {
    return (
      <div className="card-paper mx-auto max-w-xl px-6 py-10 text-center" role="status">
        <p className="label">Thank you</p>
        <p className="mt-3 font-display text-3xl text-maroon">Your blessing is on its way</p>
        <OrnamentDivider className="mx-auto mt-4" />
        <p className="body-copy mt-4">It will appear here once the family has had a chance to read it.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card-paper mx-auto max-w-xl px-5 py-8 sm:px-10">
      <input ref={honeypot} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0" name="website" />
      <div>
        <label htmlFor="gb-name" className="field-label">Your name</label>
        <input id="gb-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.guestName} />
        {errors.guestName && <p className="field-error" role="alert">{errors.guestName}</p>}
      </div>
      <div className="mt-5">
        <label htmlFor="gb-message" className="field-label">Your blessing</label>
        <textarea id="gb-message" rows={5} className="field-input resize-y" value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!errors.message} />
        {errors.message && <p className="field-error" role="alert">{errors.message}</p>}
      </div>
      <div className="mt-5">
        <label htmlFor="gb-photo" className="field-label">A photograph (optional)</label>
        <input
          id="gb-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-4 file:min-h-[44px] file:border file:border-gold/50 file:bg-transparent file:px-4 file:font-label file:text-[0.65rem] file:uppercase file:tracking-wide2 file:text-maroon"
        />
        {errors.photo && <p className="field-error" role="alert">{errors.photo}</p>}
      </div>
      {serverError && <p role="alert" className="mt-5 border border-maroon/30 bg-maroon/[0.04] px-4 py-3 text-sm text-maroon">{serverError}</p>}
      {progress !== null && file && (
        <div className="mt-5 h-1 w-full bg-gold/20" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-maroon transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="mt-7 text-center">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={progress !== null}>
          {progress !== null ? 'Sending…' : 'Leave your blessing'}
        </button>
      </div>
    </form>
  );
}
