import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-gold/25 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-maroon sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: string; actions?: ReactNode }) {
  return (
    <section className={`border border-gold/25 bg-white/70 p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-label text-[0.7rem] uppercase tracking-wide2 text-ink-soft">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, accent = false }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={`min-w-0 border px-4 py-4 sm:px-5 ${accent ? 'border-maroon/40 bg-maroon text-ivory' : 'border-gold/25 bg-white/70'}`}>
      <p className={`font-label text-[0.62rem] uppercase tracking-wide2 ${accent ? 'text-gold-pale' : 'text-ink-muted'}`}>{label}</p>
      <p
        className={`mt-1 font-display tabular-nums leading-tight [overflow-wrap:anywhere] ${typeof value === 'string' ? 'text-2xl sm:text-3xl' : 'text-3xl'} ${
          accent ? 'text-ivory' : 'text-maroon'
        }`}
      >
        {value}
      </p>
      {hint && <p className={`mt-0.5 text-xs ${accent ? 'text-ivory/70' : 'text-ink-muted'}`}>{hint}</p>}
    </div>
  );
}

const btnBase = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const btn = {
  primary: `${btnBase} bg-maroon text-ivory hover:bg-maroon-light`,
  secondary: `${btnBase} border border-gold/60 bg-white/60 text-maroon hover:bg-gold/10`,
  ghost: `${btnBase} text-ink-soft hover:bg-gold/10 hover:text-maroon`,
  danger: `${btnBase} border border-maroon/40 text-maroon hover:bg-maroon hover:text-ivory`,
  small: 'inline-flex min-h-[32px] items-center justify-center rounded-sm px-2.5 text-xs font-semibold transition-colors disabled:opacity-50',
};

export function FieldRow({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-maroon" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = 'block min-h-[40px] w-full rounded-sm border border-gold/40 bg-white px-3 py-2 text-sm text-ink focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={`${inputCls} resize-y ${props.className ?? ''}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <label htmlFor={id} className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm text-ink">
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-ink/20 transition-colors peer-checked:bg-maroon peer-focus-visible:ring-2 peer-focus-visible:ring-maroon" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      {label}
    </label>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PUBLISHED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ATTENDING: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    SCHEDULED: 'bg-amber-50 text-amber-800 border-amber-200',
    MAYBE: 'bg-amber-50 text-amber-800 border-amber-200',
    PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    DRAFT: 'bg-stone-100 text-stone-700 border-stone-200',
    HIDDEN: 'bg-stone-100 text-stone-700 border-stone-200',
    DECLINED: 'bg-rose-50 text-rose-800 border-rose-200',
    REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
    CANCELLED: 'bg-rose-50 text-rose-800 border-rose-200',
    POSTPONED: 'bg-amber-50 text-amber-800 border-amber-200',
    LIVE: 'bg-maroon text-ivory border-maroon',
    'NO ROOM': 'bg-amber-50 text-amber-800 border-amber-200',
    BRIDE: 'bg-rose-50 text-rose-800 border-rose-200',
    GROOM: 'bg-sky-50 text-sky-800 border-sky-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider ${styles[status] ?? 'border-gold/30 bg-ivory-100 text-ink-soft'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative max-h-[92vh] w-full overflow-y-auto border border-gold/40 bg-ivory shadow-paper outline-none ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/25 bg-ivory px-5 py-3">
          <h2 className="font-display text-2xl text-maroon">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center text-ink-soft hover:text-maroon" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Two-step destructive action: first click arms, second confirms. */
export function ConfirmButton({ onConfirm, children = 'Delete', confirmLabel = 'Confirm delete', className = btn.danger, disabled }: {
  onConfirm: () => void;
  children?: ReactNode;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${className} ${armed ? '!bg-maroon !text-ivory' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-ink-muted">
        {children}
      </td>
    </tr>
  );
}

export const tableCls = {
  wrap: 'overflow-x-auto border border-gold/25 bg-white/70',
  table: 'min-w-full text-left text-sm',
  th: 'whitespace-nowrap border-b border-gold/25 bg-ivory-100/80 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft',
  td: 'border-b border-gold/10 px-3 py-2.5 align-top',
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Map server field errors into a record. */
export function fieldErrors(err: unknown): Record<string, string> {
  return (err as { fields?: Record<string, string> } | null)?.fields ?? {};
}
