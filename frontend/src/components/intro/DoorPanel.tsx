import { useId } from 'react';

/**
 * One leaf of the royal doors, drawn in SVG: antique-gold foil body, maroon
 * inlay border, a jaali lattice under a half-ogee arch, carved lower panels,
 * brass studs and a ring knocker. The right leaf is the mirror image.
 */
export function DoorPanel({ side }: { side: 'left' | 'right' }) {
  const uid = useId().replace(/:/g, '');
  const foil = `foil-${uid}`;
  const sheen = `sheen-${uid}`;
  const jaali = `jaali-${uid}`;
  const studs = Array.from({ length: 11 }, (_, i) => 150 + i * 42);

  return (
    <svg
      viewBox="0 0 200 600"
      preserveAspectRatio="none"
      className="h-full w-full"
      style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={foil} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C4A56A" />
          <stop offset=".35" stopColor="#A8894F" />
          <stop offset=".62" stopColor="#B99A5E" />
          <stop offset="1" stopColor="#80653A" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF6DE" stopOpacity="0" />
          <stop offset=".55" stopColor="#FFF6DE" stopOpacity=".22" />
          <stop offset="1" stopColor="#FFF6DE" stopOpacity="0" />
        </linearGradient>
        <pattern id={jaali} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M8 0L16 8L8 16L0 8Z" fill="none" stroke="#5E4724" strokeWidth=".9" />
          <circle cx="8" cy="8" r="1.6" fill="#5E4724" opacity=".7" />
        </pattern>
      </defs>

      {/* Leaf body with half-ogee top edge (the two leaves meet in a pointed arch). */}
      <path d="M0 600V175C0 96 96 34 200 2V600Z" fill={`url(#${foil})`} />
      <path d="M0 600V175C0 96 96 34 200 2V600Z" fill={`url(#${sheen})`} />
      <path d="M0 600V175C0 96 96 34 200 2" fill="none" stroke="#5E4724" strokeWidth="2" />

      {/* Maroon inlay border */}
      <path d="M12 590V180C12 108 100 52 190 22V590Z" fill="none" stroke="#6B1E2A" strokeWidth="2.2" />
      <path d="M18 584V183C18 114 102 60 184 32V584Z" fill="none" stroke="#E3D3AE" strokeWidth=".7" opacity=".7" />

      {/* Upper jaali under the arch */}
      <path d="M34 300V192C34 136 104 90 172 64V300Z" fill={`url(#${jaali})`} opacity=".85" />
      <path d="M34 300V192C34 136 104 90 172 64V300Z" fill="none" stroke="#5E4724" strokeWidth="1.4" />

      {/* Carved lower panels */}
      {[
        [34, 324, 138, 120],
        [34, 462, 138, 108],
      ].map(([x, y, w, h]) => (
        <g key={y}>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke="#5E4724" strokeWidth="1.4" />
          <rect x={x! + 8} y={y! + 8} width={w! - 16} height={h! - 16} fill="#6B1E2A" fillOpacity=".12" stroke="#6B1E2A" strokeWidth=".9" />
          <g transform={`translate(${x! + w! / 2} ${y! + h! / 2})`}>
            <circle r="16" fill="none" stroke="#5E4724" strokeWidth="1" />
            {Array.from({ length: 8 }, (_, i) => (
              <path key={i} d="M0 0c-3-6-3-11 0-15 3 4 3 9 0 15Z" fill="#5E4724" opacity=".55" transform={`rotate(${i * 45})`} />
            ))}
            <circle r="3" fill="#E3D3AE" />
          </g>
        </g>
      ))}

      {/* Brass studs along the meeting edge */}
      {studs.map((y) => (
        <g key={y}>
          <circle cx="186" cy={y} r="3.2" fill="#E3D3AE" />
          <circle cx="186" cy={y} r="3.2" fill="none" stroke="#5E4724" strokeWidth=".8" />
        </g>
      ))}

      {/* Ring knocker */}
      <g transform="translate(160 316)">
        <circle r="5" fill="#E3D3AE" stroke="#5E4724" strokeWidth="1" />
        <circle cy="16" r="13" fill="none" stroke="#E3D3AE" strokeWidth="3" />
        <circle cy="16" r="13" fill="none" stroke="#5E4724" strokeWidth=".8" />
      </g>
    </svg>
  );
}
