import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { countdownParts, type DateInput } from '@wedding/shared';

function Unit({ value, label, pad = 2 }: { value: number; label: string; pad?: number }) {
  const reduce = useReducedMotion();
  const text = String(value).padStart(pad, '0');
  return (
    <div className="flex min-w-[3.3rem] flex-col items-center min-[380px]:min-w-[4.2rem] sm:min-w-[5.5rem]">
      <div className="relative h-[2.8rem] overflow-hidden min-[380px]:h-[3.2rem] sm:h-[4.4rem]" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className="block font-display text-[2.3rem] font-medium leading-none tabular-nums text-maroon min-[380px]:text-[2.8rem] sm:text-[3.9rem]"
            initial={reduce ? { opacity: 0 } : { y: '60%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: '-60%', opacity: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="label-sm mt-2">{label}</span>
    </div>
  );
}

/** Days / hours / minutes / seconds to a target instant (driven by the shared clock). */
export function Countdown({ target, now, compact = false }: { target: DateInput; now: DateInput; compact?: boolean }) {
  const c = countdownParts(target, now);
  const sr = `${c.days} days, ${c.hours} hours and ${c.minutes} minutes to go`;
  if (compact) {
    return (
      <p className="font-display text-2xl tabular-nums text-maroon" aria-label={sr}>
        {c.days > 0 && <>{c.days}d </>}
        {String(c.hours).padStart(2, '0')}h {String(c.minutes).padStart(2, '0')}m {String(c.seconds).padStart(2, '0')}s
      </p>
    );
  }
  return (
    <div role="timer" aria-label={sr} className="flex items-start justify-center gap-0.5 min-[380px]:gap-1 sm:gap-4" data-testid="countdown">
      <Unit value={c.days} label={c.days === 1 ? 'Day' : 'Days'} pad={c.days >= 100 ? 3 : 2} />
      <Sep />
      <Unit value={c.hours} label="Hours" />
      <Sep />
      <Unit value={c.minutes} label="Minutes" />
      <Sep />
      <Unit value={c.seconds} label="Seconds" />
    </div>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className="mt-4 h-1.5 w-1.5 rotate-45 bg-gold/70 sm:mt-6" />
  );
}
