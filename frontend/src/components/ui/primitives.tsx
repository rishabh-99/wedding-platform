import { Component, type ErrorInfo, type ReactNode } from 'react';
import { OrnamentReveal } from '../../animations/Reveal';
import { OrnamentDivider } from '../ornaments/Ornaments';

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'center',
  as: Tag = 'h2',
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: 'center' | 'left';
  as?: 'h1' | 'h2';
  id?: string;
}) {
  const center = align === 'center';
  return (
    <header className={`mb-10 sm:mb-14 ${center ? 'text-center' : ''}`}>
      {eyebrow && <p className="label mb-3">{eyebrow}</p>}
      <Tag id={id} className="heading-lg">
        {title}
      </Tag>
      <OrnamentReveal className={`mt-5 flex ${center ? 'justify-center' : ''}`}>
        <OrnamentDivider />
      </OrnamentReveal>
      {intro && <p className={`body-copy mt-5 ${center ? 'mx-auto' : ''} max-w-prose2`}>{intro}</p>}
    </header>
  );
}

export function LiveBadge({ label = 'Live', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-label text-[0.68rem] uppercase tracking-label text-maroon ${className}`}>
      <span className="live-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-sm ${className}`} />;
}

export function LoadingBlock({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function ErrorState({
  title = 'We couldn’t load this just now',
  message = 'Please check your connection and try again.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="card-paper mx-auto max-w-md px-6 py-8 text-center">
      <p className="font-display text-xl text-maroon">{title}</p>
      <p className="body-copy mt-2">{message}</p>
      {onRetry && (
        <button type="button" className="btn-outline mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-10 text-center">
      <OrnamentDivider className="mx-auto mb-4" />
      <p className="font-display text-xl text-maroon">{title}</p>
      {message && <p className="body-copy mt-2">{message}</p>}
    </div>
  );
}

interface BoundaryState {
  error: Error | null;
}

/** Keeps a rendering failure in one section from taking down the whole page. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('UI error', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="container-page py-16">
            <ErrorState
              title="Something didn’t load properly"
              message="Please refresh the page. If this keeps happening, let the family know."
              onRetry={() => window.location.reload()}
            />
          </div>
        )
      );
    }
    return this.props.children;
  }
}
