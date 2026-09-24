import sharp from 'sharp';

/**
 * Generates tasteful placeholder "photographs" for development: abstract
 * compositions of jharokha arches, jaali patterns and soft light in the
 * ivory / antique-gold / maroon palette. No text (so no font dependencies),
 * no external downloads, no stock imagery.
 */

export interface ArtPalette {
  bg1: string;
  bg2: string;
  accent: string;
  line: string;
}

export const PALETTES: Record<string, ArtPalette> = {
  ivory: { bg1: '#F7F0E1', bg2: '#E9DCC0', accent: '#6B1E2A', line: '#A8894F' },
  maroon: { bg1: '#5A1822', bg2: '#2E0D13', accent: '#C2A56B', line: '#C2A56B' },
  marigold: { bg1: '#F3D7A0', bg2: '#D99A3B', accent: '#7A2E12', line: '#FFF3D6' },
  henna: { bg1: '#E6DDBF', bg2: '#8C8A4E', accent: '#4E3B1F', line: '#F4ECDB' },
  midnight: { bg1: '#1E2238', bg2: '#0D0F1C', accent: '#C2A56B', line: '#C2A56B' },
  rose: { bg1: '#F2DCD5', bg2: '#C98B83', accent: '#6B1E2A', line: '#FBF7EE' },
  saffron: { bg1: '#F6E3C4', bg2: '#E0A458', accent: '#6B1E2A', line: '#8A6D3B' },
  emerald: { bg1: '#20443A', bg2: '#0F2621', accent: '#D9C08A', line: '#D9C08A' },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function archPath(cx: number, baseY: number, w: number, h: number): string {
  const l = cx - w / 2;
  const r = cx + w / 2;
  const shoulder = baseY - h * 0.62;
  const top = baseY - h;
  // Mughal cusped/ogee arch outline.
  return [
    `M ${l} ${baseY}`,
    `L ${l} ${shoulder}`,
    `C ${l} ${shoulder - h * 0.2}, ${cx - w * 0.18} ${top + h * 0.12}, ${cx} ${top}`,
    `C ${cx + w * 0.18} ${top + h * 0.12}, ${r} ${shoulder - h * 0.2}, ${r} ${shoulder}`,
    `L ${r} ${baseY} Z`,
  ].join(' ');
}

export function artSvg(width: number, height: number, palette: ArtPalette, seed: number): string {
  const rand = rng(seed);
  const cx = width * (0.35 + rand() * 0.3);
  const archW = width * (0.42 + rand() * 0.2);
  const archH = height * (0.62 + rand() * 0.18);
  const baseY = height * 0.94;
  const glowX = cx + (rand() - 0.5) * width * 0.2;
  const glowY = baseY - archH * 0.55;
  const bokeh = Array.from({ length: 22 }, () => {
    const r = 6 + rand() * 38;
    return `<circle cx="${(rand() * width).toFixed(1)}" cy="${(rand() * height * 0.8).toFixed(1)}" r="${r.toFixed(1)}" fill="${palette.line}" opacity="${(0.04 + rand() * 0.14).toFixed(2)}"/>`;
  }).join('');
  const jaaliSize = 34 + Math.round(rand() * 18);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${rand() > 0.5 ? 1 : 0.3}" y2="1">
      <stop offset="0" stop-color="${palette.bg1}"/>
      <stop offset="1" stop-color="${palette.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${(glowX / width).toFixed(3)}" cy="${(glowY / height).toFixed(3)}" r="0.55">
      <stop offset="0" stop-color="#FFF6DE" stop-opacity="0.75"/>
      <stop offset="0.45" stop-color="#FFF6DE" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#FFF6DE" stop-opacity="0"/>
    </radialGradient>
    <pattern id="jaali" width="${jaaliSize}" height="${jaaliSize}" patternUnits="userSpaceOnUse">
      <path d="M ${jaaliSize / 2} 0 L ${jaaliSize} ${jaaliSize / 2} L ${jaaliSize / 2} ${jaaliSize} L 0 ${jaaliSize / 2} Z" fill="none" stroke="${palette.line}" stroke-width="1.2" opacity="0.55"/>
      <circle cx="${jaaliSize / 2}" cy="${jaaliSize / 2}" r="${jaaliSize / 9}" fill="none" stroke="${palette.line}" stroke-width="1" opacity="0.5"/>
    </pattern>
    <clipPath id="arch"><path d="${archPath(cx, baseY, archW, archH)}"/></clipPath>
    <filter id="soft"><feGaussianBlur stdDeviation="${(width / 160).toFixed(1)}"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <g filter="url(#soft)">${bokeh}</g>
  <g clip-path="url(#arch)">
    <rect width="100%" height="100%" fill="${palette.accent}" opacity="0.18"/>
    <rect width="100%" height="100%" fill="url(#jaali)"/>
  </g>
  <path d="${archPath(cx, baseY, archW, archH)}" fill="none" stroke="${palette.line}" stroke-width="${(width / 220).toFixed(1)}" opacity="0.9"/>
  <path d="${archPath(cx, baseY, archW * 1.12, archH * 1.07)}" fill="none" stroke="${palette.line}" stroke-width="${(width / 600).toFixed(1)}" opacity="0.6"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect x="0" y="${baseY}" width="${width}" height="${height - baseY}" fill="${palette.accent}" opacity="0.35"/>
</svg>`;
}

export async function renderArt(width: number, height: number, palette: ArtPalette, seed: number): Promise<Buffer> {
  return sharp(Buffer.from(artSvg(width, height, palette, seed))).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}
