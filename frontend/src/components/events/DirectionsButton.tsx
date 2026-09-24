import type { VenueDTO } from '@wedding/shared';

/** One-tap directions: opens the venue's configured Google Maps link. */
export function DirectionsButton({
  venue,
  className = '',
  variant = 'primary',
}: {
  venue: VenueDTO | null;
  className?: string;
  variant?: 'primary' | 'outline';
}) {
  if (!venue?.mapsUrl) {
    return (
      <span className={`${variant === 'primary' ? 'btn-primary' : 'btn-outline'} pointer-events-none opacity-60 ${className}`} aria-disabled="true">
        Directions coming soon
      </span>
    );
  }
  return (
    <a
      href={venue.mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-outline'} ${className}`}
      aria-label={`Get directions to ${venue.name} (opens Google Maps)`}
    >
      <PinIcon />
      Get directions
    </a>
  );
}

export function PinIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="10" cy="8" r="2.2" />
    </svg>
  );
}
