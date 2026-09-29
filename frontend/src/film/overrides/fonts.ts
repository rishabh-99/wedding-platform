/*
 * Site replacement for the film's theme/fonts.ts. The film loads its faces with @remotion/fonts;
 * here they are plain @font-face rules bundled with the film chunk. Cormorant Garamond comes from
 * @fontsource like the rest of the site. No Devanagari faces: the site is English only.
 */
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '../fonts/film-fonts.css';

export const fonts = {
  display: "'Cormorant Garamond', Georgia, serif",
  label: 'Marcellus, Georgia, serif',
  mono: "'IBM Plex Mono', Consolas, monospace",
  pixel: "'Press Start 2P', monospace",
  latin: "'Cormorant Garamond', Georgia, serif",
} as const;

export const isDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);
