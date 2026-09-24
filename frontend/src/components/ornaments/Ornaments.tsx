import type { SVGProps } from 'react';

/**
 * Hand-drawn ornament set — Mughal/Rajasthani motifs reduced to fine gold
 * line-work so they frame content without competing with it.
 */

type SvgProps = SVGProps<SVGSVGElement> & { className?: string };

/** Horizontal rule with a small lotus-bud centrepiece. */
export function OrnamentDivider({ className = '', ...props }: SvgProps) {
  return (
    <svg viewBox="0 0 240 24" fill="none" aria-hidden="true" className={`h-5 w-48 text-gold ${className}`} {...props}>
      <path d="M0 12h92M148 12h92" stroke="currentColor" strokeWidth=".8" />
      <path d="M78 12h14M148 12h14" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M120 2c4 4 6 7 6 10s-2 6-6 10c-4-4-6-7-6-10s2-6 6-10Z"
        stroke="currentColor"
        strokeWidth=".9"
        fill="currentColor"
        fillOpacity=".12"
      />
      <path d="M120 6c-5 1-10 3-14 6 4 3 9 5 14 6M120 6c5 1 10 3 14 6-4 3-9 5-14 6" stroke="currentColor" strokeWidth=".8" />
      <circle cx="100" cy="12" r="1.4" fill="currentColor" />
      <circle cx="140" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Corner filigree — place four, rotated, inside a relative frame. */
export function CornerFiligree({ className = '', ...props }: SvgProps) {
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className={`h-14 w-14 text-gold ${className}`} {...props}>
      <path d="M2 78V22C2 11 11 2 22 2h56" stroke="currentColor" strokeWidth="1" />
      <path d="M8 78V26C8 16 16 8 26 8h52" stroke="currentColor" strokeWidth=".6" opacity=".7" />
      <path
        d="M14 40c0-14 12-26 26-26-6 5-9 11-9 17 0 8 6 12 12 12-3 6-10 9-16 7-8-2-13-5-13-10Z"
        stroke="currentColor"
        strokeWidth=".8"
        fill="currentColor"
        fillOpacity=".08"
      />
      <circle cx="30" cy="30" r="2" fill="currentColor" />
      <path d="M40 14c3-3 7-4 11-4M14 40c-3 3-4 7-4 11" stroke="currentColor" strokeWidth=".7" />
    </svg>
  );
}

/** Four corner filigrees positioned absolutely around a relative parent. */
export function FramedCorners({ className = '', size = 'h-10 w-10 sm:h-14 sm:w-14' }: { className?: string; size?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <CornerFiligree className={`absolute left-2 top-2 ${size}`} />
      <CornerFiligree className={`absolute right-2 top-2 rotate-90 ${size}`} />
      <CornerFiligree className={`absolute bottom-2 right-2 rotate-180 ${size}`} />
      <CornerFiligree className={`absolute bottom-2 left-2 -rotate-90 ${size}`} />
    </div>
  );
}

/** Jharokha (ogee arch) outline — used as a frame behind headings and portraits. */
export function ArchOutline({ className = '', ...props }: SvgProps) {
  return (
    <svg viewBox="0 0 200 300" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet" className={`text-gold ${className}`} {...props}>
      <path d="M8 300V118C8 70 52 30 100 6c48 24 92 64 92 112v182" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path d="M20 300V122c0-42 38-78 80-100 42 22 80 58 80 100v178" stroke="currentColor" strokeWidth=".6" opacity=".6" vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy="6" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** Radial rosette (stylised lotus mandala) for quiet background accents. */
export function Rosette({ className = '', ...props }: SvgProps) {
  const petals = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className={`text-gold ${className}`} {...props}>
      <circle cx="100" cy="100" r="96" stroke="currentColor" strokeWidth=".5" />
      <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth=".4" strokeDasharray="1 4" />
      {petals.map((deg) => (
        <path
          key={deg}
          d="M100 100c-8-18-8-40 0-62 8 22 8 44 0 62Z"
          transform={`rotate(${deg} 100 100)`}
          stroke="currentColor"
          strokeWidth=".6"
          fill="currentColor"
          fillOpacity=".04"
        />
      ))}
      {petals.map((deg) => (
        <circle key={`d${deg}`} cx="100" cy="22" r="1.2" fill="currentColor" transform={`rotate(${deg + 11.25} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="14" stroke="currentColor" strokeWidth=".8" />
      <circle cx="100" cy="100" r="4" fill="currentColor" />
    </svg>
  );
}

/** Couple monogram: initials within a fine double circle. */
export function Monogram({ a, b, className = '' }: { a: string; b: string; className?: string }) {
  return (
    <div className={`relative inline-flex h-16 w-16 items-center justify-center ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full text-gold" fill="none">
        <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth=".8" />
        <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth=".4" />
        <path d="M32 2v4M32 58v4M2 32h4M58 32h4" stroke="currentColor" strokeWidth=".8" />
      </svg>
      <span className="font-display text-xl italic leading-none text-maroon">
        {a.charAt(0)}
        <span className="mx-0.5 text-sm text-gold">&amp;</span>
        {b.charAt(0)}
      </span>
    </div>
  );
}
