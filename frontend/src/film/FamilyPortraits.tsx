import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Reveal } from '../animations/Reveal';
import { Character } from './vendor/characters/Character';
import { people, wardrobe } from './vendor/characters/cast';
import type { HeldProp, Outfit, Person, Pose } from './vendor/characters/types';
import { PaperDefs } from './vendor/paper/PaperDefs';
import {
  BoardroomPanel,
  Emblem,
  PANEL_H,
  PANEL_W,
  PIXEL_W,
  PixelPanel,
  TerminalPanel,
  type EmblemKind,
} from './vendor/props/EntrancePanels';
import { useFrameClock } from './useFrameClock';

/*
 * The family as drawn in the invitation film: the couple, the groom's parents and his three
 * brothers, each brother with the playful "entrance" panel he gets in the film.
 */

interface Brother {
  kind: EmblemKind;
  person: Person;
  outfit: Outfit;
  holding: HeldProp;
  pose: Partial<Pose>;
  /** What his panel shows, for screen readers and as a caption. */
  caption: string;
  /** Frame at which his panel has finished building (the film folds it away just after). */
  end: number;
}

const BROTHERS: Brother[] = [
  {
    kind: 'ceo',
    person: people.hardik,
    outfit: wardrobe.hardik.catalogue,
    holding: 'laptop',
    pose: { rShoulder: -32, rElbow: -66, headTilt: 3 },
    caption: 'The boardroom: three brothers, one wedding confirmed, joy up 100%.',
    end: 88,
  },
  {
    kind: 'cto',
    person: people.ashish,
    outfit: wardrobe.ashish.catalogue,
    holding: 'diagram',
    pose: { rShoulder: -26, rElbow: -74, headTilt: -2 },
    caption: 'The terminal: initializing wedding.exe.',
    end: 86,
  },
  {
    kind: 'gamer',
    person: people.pranab,
    outfit: wardrobe.pranab.catalogue,
    holding: 'console',
    pose: { rShoulder: -118, rElbow: -22, lShoulder: 9, lElbow: -8 },
    caption: 'The pixel game: Player 3 has joined. Level up!',
    end: 52,
  },
];

/** Pause between one brother's entrance finishing and the next one starting. */
const NEXT_DELAY_MS = 1400;

/** Characters are drawn in a 400×1000 box; this sizes one by its width and keeps the aspect. */
function Figure({ person, outfit, pose, holding, className }: { person: Person; outfit: Outfit; pose?: Partial<Pose>; holding?: HeldProp; className: string }) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden="true" className="absolute bottom-[1.5%] left-1/2 h-[4%] w-[72%] -translate-x-1/2 rounded-[50%] border border-gold/50 bg-ivory-200 shadow-paper" />
      <Character person={person} outfit={outfit} pose={pose} holding={holding} style={{ position: 'relative', display: 'block', width: '100%', height: 'auto' }} />
    </div>
  );
}

function Portrait({ person, outfit, pose, holding, size, delay = 0, above }: {
  person: Person;
  outfit: Outfit;
  pose?: Partial<Pose>;
  holding?: HeldProp;
  size: string;
  delay?: number;
  above?: ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <figure className="flex flex-col items-center text-center">
        {above}
        <Figure person={person} outfit={outfit} pose={pose} holding={holding} className={size} />
        <figcaption className="mt-3">
          <p className="font-display text-xl font-medium leading-tight text-maroon sm:text-2xl">{person.name}</p>
          <p className="label-sm mt-1">{person.role}</p>
        </figcaption>
      </figure>
    </Reveal>
  );
}

function RowLabel({ children }: { children: ReactNode }) {
  return <h3 className="label mb-6 text-center">{children}</h3>;
}

/** Scales a fixed-size film panel to the width of its box. */
function useScale(base: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / base || 0.5);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [base]);
  return { ref, scale };
}

function EntranceStage({ brother, frame }: { brother: Brother; frame: number }) {
  const { ref, scale } = useScale(PANEL_W);
  const pixel = brother.kind === 'gamer';
  return (
    <div ref={ref} aria-hidden="true" className="relative mx-auto w-full max-w-[26rem]" style={{ aspectRatio: `${PANEL_W} / ${PANEL_H}` }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: PANEL_W, height: PANEL_H, transform: `scale(${scale})` }}>
        <div className="absolute top-0" style={{ left: pixel ? (PANEL_W - PIXEL_W) / 2 : 0, width: pixel ? PIXEL_W : PANEL_W, height: PANEL_H }}>
          {brother.kind === 'ceo' && <BoardroomPanel f={frame} />}
          {brother.kind === 'cto' && <TerminalPanel f={frame} />}
          {pixel && <PixelPanel f={frame} landAt={32} landX={PIXEL_W / 2 + 10} />}
        </div>
      </div>
    </div>
  );
}

function Brothers() {
  const reduce = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { once: true, amount: 0.5 });
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [auto, setAuto] = useState(true);
  const brother = BROTHERS[active]!;
  const frame = useFrameClock(started && !reduce, brother.end, `${active}-${started}`);

  // The first time the row is seen, play the entrances in turn, as in the film.
  useEffect(() => {
    if (inView) setStarted(true);
  }, [inView]);
  useEffect(() => {
    if (!auto || reduce || !started || frame < brother.end || active >= BROTHERS.length - 1) return;
    const t = window.setTimeout(() => setActive((i) => i + 1), NEXT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [auto, reduce, started, frame, brother.end, active]);

  const choose = (i: number) => {
    setAuto(false);
    setStarted(true);
    setActive(i);
  };

  return (
    <div>
      <RowLabel>The brothers</RowLabel>
      <div ref={stage} className="mb-10">
        <div className="card-paper mx-auto max-w-[28rem] p-3 sm:p-4">
          <EntranceStage brother={brother} frame={frame} />
        </div>
        <p className="mx-auto mt-3 max-w-[28rem] text-center font-display text-lg italic text-ink-soft" aria-live="polite">
          {brother.person.name.split(' ')[0]} · {brother.caption}
        </p>
      </div>
      <ul className="grid grid-cols-3 items-end gap-3 sm:gap-8">
        {BROTHERS.map((b, i) => (
          <li key={b.kind}>
            <button
              type="button"
              onClick={() => choose(i)}
              aria-pressed={i === active}
              aria-label={`Show ${b.person.name}’s entrance`}
              className={`group w-full rounded-sm pb-2 pt-1 transition-colors ${i === active ? 'bg-gold/[0.08]' : 'hover:bg-gold/[0.05]'}`}
            >
              <Portrait
                person={b.person}
                outfit={b.outfit}
                pose={b.pose}
                holding={b.holding}
                size="w-20 sm:w-28"
                delay={0.08 * i}
                above={
                  <span className={`mb-2 block transition-transform ${i === active ? 'scale-110' : 'group-hover:scale-105'}`}>
                    <Emblem kind={b.kind} size={52} />
                  </span>
                }
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Couple, parents and brothers, with the brothers' film entrances. */
export default function FamilyPortraits({ variant = 'full' }: { variant?: 'full' | 'teaser' }) {
  if (variant === 'teaser') {
    // One row: brothers on the outside, parents beside the couple, the couple drawn a size larger.
    const row: { person: Person; outfit: Outfit; couple?: boolean }[] = [
      { person: people.pranab, outfit: wardrobe.pranab.catalogue },
      { person: people.ashish, outfit: wardrobe.ashish.catalogue },
      { person: people.vinod, outfit: wardrobe.vinod.catalogue },
      { person: people.rishabh, outfit: wardrobe.rishabh.wedding, couple: true },
      { person: people.nandita, outfit: wardrobe.nandita.wedding, couple: true },
      { person: people.rewa, outfit: wardrobe.rewa.catalogue },
      { person: people.hardik, outfit: wardrobe.hardik.catalogue },
    ];
    return (
      <div aria-hidden="true" className="flex items-end justify-center gap-1 sm:gap-3">
        <PaperDefs />
        {row.map(({ person, outfit, couple }, i) => (
          <Reveal key={person.id} delay={0.06 * i}>
            <Figure person={person} outfit={outfit} className={couple ? 'w-12 sm:w-20 md:w-24' : 'w-10 sm:w-16 md:w-20'} />
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-16 sm:space-y-20">
      <PaperDefs />
      <div>
        <RowLabel>The couple</RowLabel>
        <div className="flex items-end justify-center gap-8 sm:gap-16">
          <Portrait person={people.rishabh} outfit={wardrobe.rishabh.wedding} size="w-28 sm:w-36" />
          <Portrait person={people.nandita} outfit={wardrobe.nandita.wedding} size="w-28 sm:w-36" delay={0.08} />
        </div>
      </div>
      <div>
        <RowLabel>The groom’s parents</RowLabel>
        <div className="flex items-end justify-center gap-8 sm:gap-16">
          <Portrait person={people.vinod} outfit={wardrobe.vinod.catalogue} pose={{ lElbow: -14 }} size="w-24 sm:w-32" />
          <Portrait person={people.rewa} outfit={wardrobe.rewa.catalogue} pose={{ rElbow: 28, rShoulder: -4 }} size="w-24 sm:w-32" delay={0.08} />
        </div>
      </div>
      <div className="mx-auto max-w-2xl">
        <Brothers />
      </div>
    </div>
  );
}
