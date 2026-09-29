import { createElement, type ComponentType } from 'react';
import { DURATIONS, type SceneId } from './vendor/film/timeline';
import type { SceneProps } from './vendor/scenes/types';

/*
 * Which illustrated film scene belongs to which celebration. Keyed by the event slug used on
 * the site; an event with no entry simply has no artwork. Only the lightweight timing data lives
 * here, so importing this file never pulls in Remotion or the scene code.
 */

/** Where the event's details sit in the film's invitation data (see toInvitation.ts). */
export type InvitationSlot =
  | { kind: 'event'; key: 'engagement' | 'haldi' | 'sangeet' | 'reception' }
  | { kind: 'weddingDay'; id: 'sehra' | 'baraat' | 'jaimaal' | 'lunch' | 'phere' | 'vidai' };

export interface SceneEntry {
  id: SceneId;
  /** Scene length in frames at 30 fps, as in the film. */
  dur: number;
  /** A frame inside the scene's final held composition, used for stills and reduced motion. */
  holdFrame: number;
  /**
   * Height (of 1920) to show. The film prints each event's title in a band at the bottom of the
   * frame; the site hides those titles and shows the details as page text, so the band is cropped.
   */
  crop: number;
  slot: InvitationSlot;
  load: () => Promise<{ default: ComponentType<Record<string, unknown>> }>;
}

export const FILM_WIDTH = 1080;
export const FILM_HEIGHT = 1920;
export const FILM_FPS = 30;

type Loader = () => Promise<Record<string, ComponentType<SceneProps>>>;

/** Wraps a scene so the film's own title block is never drawn (HideEventTitles is the film's switch for this). */
const artOnly = (load: Loader, name: string) => async () => {
  const [mod, { HideEventTitles }] = await Promise.all([load(), import('./vendor/kit/EventTitle')]);
  const Scene = mod[name]!;
  const ArtOnly = (props: Record<string, unknown>) =>
    createElement(HideEventTitles.Provider, { value: true }, createElement(Scene, props as SceneProps));
  ArtOnly.displayName = `ArtOnly(${name})`;
  return { default: ArtOnly };
};

const entry = (id: SceneId, slot: InvitationSlot, load: Loader, name: string, crop = 1540): SceneEntry => ({
  id,
  dur: DURATIONS[id],
  holdFrame: DURATIONS[id] - 1,
  crop,
  slot,
  load: artOnly(load, name),
});

const engagement = entry('engagement', { kind: 'event', key: 'engagement' }, () => import('./vendor/scenes/EngagementScene'), 'EngagementScene');
const haldiMehendi = entry('haldiMehendi', { kind: 'event', key: 'haldi' }, () => import('./vendor/scenes/HaldiMehendiScene'), 'HaldiMehendiScene');
const sangeet = entry('sangeet', { kind: 'event', key: 'sangeet' }, () => import('./vendor/scenes/SangeetScene'), 'SangeetScene');
const sehra = entry('sehra', { kind: 'weddingDay', id: 'sehra' }, () => import('./vendor/scenes/SehraScene'), 'SehraScene', 1580);
const baraat = entry('baraat', { kind: 'weddingDay', id: 'baraat' }, () => import('./vendor/scenes/BaraatScene'), 'BaraatScene');
const jaimaal = entry('jaimaal', { kind: 'weddingDay', id: 'jaimaal' }, () => import('./vendor/scenes/JaimaalScene'), 'JaimaalScene');
const lunch = entry('lunch', { kind: 'weddingDay', id: 'lunch' }, () => import('./vendor/scenes/LunchScene'), 'LunchScene');
const phere = entry('phere', { kind: 'weddingDay', id: 'phere' }, () => import('./vendor/scenes/PhereScene'), 'PhereScene', 1570);
const vidai = entry('vidai', { kind: 'weddingDay', id: 'vidai' }, () => import('./vendor/scenes/VidaiScene'), 'VidaiScene');
const reception = entry('reception', { kind: 'event', key: 'reception' }, () => import('./vendor/scenes/ReceptionScene'), 'ReceptionScene');

/** Event slug → scene. The first seven are the live site's events; the rest are ready for events not yet added. */
const BY_SLUG: Record<string, SceneEntry> = {
  engagement,
  'haldi-mehendi': haldiMehendi,
  sangeet,
  'sehra-bandhi': sehra,
  baraat,
  jaimal: jaimaal,
  'the-pheras': phere,
  // Not on the site yet — shown automatically if an event with one of these slugs is added.
  haldi: haldiMehendi,
  mehendi: haldiMehendi,
  'sehra-bandi': sehra,
  jaimaal,
  jaimala: jaimaal,
  pheras: phere,
  phere,
  'jaimal-phere': phere, // the seed data's combined ceremony
  lunch,
  vidai,
  reception,
  'gala-dinner': reception,
};

export function sceneForSlug(slug: string): SceneEntry | null {
  return BY_SLUG[slug] ?? null;
}
