/*
 * Site replacement for the film's data/i18n.ts. The film shows Hindi first with English
 * beneath; the site is English only. Every helper keeps its signature but puts the English in
 * the primary (`hi`) slot and leaves the companion line empty, so `Dual` renders one line.
 */
export type Bi = { hi: string; en: string };

export const hiDigits = (s: string) => s;
export const hi = (en: string): string => en.trim();
export const missingHindi = (): string[] => [];

export const bi = (en: string): Bi => ({ hi: en, en: '' });

const dateEn = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y!, m! - 1, d)))
    .replace(/^(\w+) /, '$1, ');
};

export const whenBi = (isoDate: string, time?: string): Bi => ({
  hi: [dateEn(isoDate), time ?? ''].filter(Boolean).join(' · '),
  en: '',
});

export const coupleBi = (groom: string, bride: string): Bi => ({ hi: `${groom} & ${bride}`, en: '' });
