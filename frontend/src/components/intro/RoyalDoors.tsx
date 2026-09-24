import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { DoorPanel } from './DoorPanel';

const INTRO_KEY = 'wedding.introSeen';

export function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* private mode */
  }
}

interface RoyalDoorsProps {
  coupleName1?: string;
  coupleName2?: string;
  onComplete: () => void;
}

/**
 * Cinematic opening: a pair of carved antique-gold doors set in an ivory
 * jharokha. "Enter the celebration" swings them open (CSS 3D, GPU-only
 * transforms) and the site is revealed behind. Reduced-motion users get a
 * simple cross-fade. Skippable at any time.
 */
export function RoyalDoors({ coupleName1, coupleName2, onComplete }: RoyalDoorsProps) {
  const reduce = useReducedMotion();
  const [opening, setOpening] = useState(false);
  const [visible, setVisible] = useState(true);
  const enterRef = useRef<HTMLButtonElement>(null);

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${6 + ((i * 53) % 88)}%`,
        top: `${40 + ((i * 37) % 55)}%`,
        delay: `${(i * 0.73) % 9}s`,
        duration: `${8 + (i % 5)}s`,
        size: 2 + (i % 3),
        drift: `${((i % 2 ? 1 : -1) * (8 + (i % 4) * 6)).toFixed(0)}px`,
      })),
    [],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    enterRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const finish = () => {
    markIntroSeen();
    setVisible(false);
  };

  const enter = () => {
    if (opening) return;
    setOpening(true);
    window.setTimeout(finish, reduce ? 350 : 1900);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doorTransition = { duration: 1.6, ease: [0.65, 0, 0.35, 1] as const };

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          key="royal-doors"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome"
          className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-ivory pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 1.04, transition: { duration: reduce ? 0.3 : 0.7, ease: 'easeOut' } }}
        >
          {/* Ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 55% at 50% 52%, rgba(255,243,214,0.95) 0%, rgba(251,247,238,0.4) 45%, rgba(239,228,204,0.9) 100%)',
            }}
          />

          {/* Very subtle gold particles */}
          {!reduce && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {particles.map((p, i) => (
                <span
                  key={i}
                  className="absolute animate-drift rounded-full bg-gold-light"
                  style={{
                    left: p.left,
                    top: p.top,
                    width: p.size,
                    height: p.size,
                    animationDelay: p.delay,
                    animationDuration: p.duration,
                    ['--drift-x' as string]: p.drift,
                    boxShadow: '0 0 6px rgba(194,165,107,.8)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Skip sits in its own row so it can never cover the heading on short phone screens. */}
          <div className="relative z-20 flex shrink-0 justify-end px-2 pt-2 sm:px-6 sm:pt-4">
            <button
              type="button"
              onClick={finish}
              className="min-h-[44px] rounded-sm px-4 font-label text-[0.65rem] uppercase tracking-label text-ink-muted transition-colors hover:text-maroon"
            >
              Skip intro
            </button>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center pb-6">

          <motion.p
            className="label relative z-10 mb-2 text-center sm:mb-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: opening ? 0 : 1, y: 0 }}
            transition={{ duration: 0.8, delay: opening ? 0 : 0.2 }}
          >
            The wedding of
          </motion.p>
          <motion.h1
            className="relative z-10 mb-5 px-6 text-center font-display text-[2.1rem] italic leading-tight text-maroon sm:mb-8 sm:text-5xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: opening ? 0 : 1, y: 0 }}
            transition={{ duration: 0.9, delay: opening ? 0 : 0.35 }}
          >
            {coupleName1 ?? ' '} <span className="text-gold">&amp;</span> {coupleName2 ?? ''}
          </motion.h1>

          {/* Doorway */}
          <div
            className="relative z-10 aspect-[2/3] w-[min(72vw,40vh,420px)] shrink-0"
            style={{ perspective: '1600px' }}
          >
            {/* Ivory jharokha frame around the doorway */}
            <svg aria-hidden="true" viewBox="0 0 440 640" preserveAspectRatio="none" className="absolute -inset-[6%] h-[112%] w-[112%] text-gold">
              <path d="M8 640V200C8 110 110 40 220 6c110 34 212 104 212 194v440" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M20 640V204C20 120 116 54 220 22c104 32 200 98 200 182v436" fill="none" stroke="currentColor" strokeWidth=".8" opacity=".7" />
              <circle cx="220" cy="6" r="4" fill="#6B1E2A" />
            </svg>

            {/* Warm light behind the doors, revealed as they open */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 60%, #FFF8E6 0%, #F6E6C0 55%, #E7D0A0 100%)',
                clipPath: 'polygon(0 29%, 10% 15%, 25% 7%, 50% 0, 75% 7%, 90% 15%, 100% 29%, 100% 100%, 0 100%)',
              }}
            />

            <motion.div
              className="absolute inset-y-0 left-0 w-1/2 shadow-[8px_0_24px_-12px_rgba(46,36,32,.5)]"
              style={{ transformOrigin: 'left center', backfaceVisibility: 'hidden' }}
              animate={
                opening
                  ? reduce
                    ? { opacity: 0 }
                    : { rotateY: -108 }
                  : { rotateY: 0, opacity: 1 }
              }
              transition={reduce ? { duration: 0.3 } : doorTransition}
            >
              <DoorPanel side="left" />
            </motion.div>
            <motion.div
              className="absolute inset-y-0 right-0 w-1/2 shadow-[-8px_0_24px_-12px_rgba(46,36,32,.5)]"
              style={{ transformOrigin: 'right center', backfaceVisibility: 'hidden' }}
              animate={
                opening
                  ? reduce
                    ? { opacity: 0 }
                    : { rotateY: 108 }
                  : { rotateY: 0, opacity: 1 }
              }
              transition={reduce ? { duration: 0.3 } : doorTransition}
            >
              <DoorPanel side="right" />
            </motion.div>
          </div>

          <motion.button
            ref={enterRef}
            type="button"
            onClick={enter}
            className="btn-primary relative z-10 mt-7 shrink-0 px-8 shadow-glow sm:mt-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: opening ? 0 : 1, y: 0 }}
            transition={{ duration: 0.8, delay: opening ? 0 : 0.6 }}
          >
            Enter the celebration
          </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
