import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import type { SettingsDTO } from '@wedding/shared';
import { ArchOutline, FramedCorners, OrnamentDivider, Rosette } from '../ornaments/Ornaments';

const line = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.18, duration: 0.9, ease: [0.22, 1, 0.36, 1] } }),
};

/** Invitation hero: names set like engraved stationery inside a gold jharokha frame. */
export function Hero({ settings }: { settings: SettingsDTO }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const rosetteY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const rosetteRotate = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 18]);

  return (
    <section ref={ref} className="relative overflow-hidden pb-6 pt-4 sm:pb-16 sm:pt-12" aria-labelledby="hero-title">
      {/* Outer div centres; inner motion div parallaxes (framer owns its transform). */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-[140vw] max-w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-[0.10]">
        <motion.div style={{ y: rosetteY, rotate: rosetteRotate }}>
          <Rosette className="h-full w-full" />
        </motion.div>
      </div>

      <div className="container-page relative">
        <div className="relative mx-auto max-w-2xl px-10 pb-10 pt-20 text-center sm:px-20 sm:pb-20 sm:pt-28">
          <FramedCorners />
          {/* The arch spans the frame; content keeps clear of its strokes via the padding above. */}
          <ArchOutline preserveAspectRatio="none" className="pointer-events-none absolute inset-x-4 bottom-4 top-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] opacity-70 sm:inset-x-10 sm:w-[calc(100%-5rem)]" />

          <motion.div initial="hidden" animate="visible" className="relative">
            {/* In live mode the LiveRibbon above the hero carries the "● LIVE" message. */}
            <motion.p variants={line} custom={0} className="label">
              {settings.familiesLine}
            </motion.p>
            <motion.h1
              id="hero-title"
              variants={line}
              custom={1}
              className="mt-5 font-display text-[3rem] font-medium italic leading-[0.95] text-maroon sm:mt-6 sm:text-7xl md:text-[5.5rem]"
            >
              <span className="block">{settings.coupleName1}</span>
              <span className="my-2 block font-display text-3xl not-italic text-gold sm:my-3 sm:text-4xl" aria-label="and">
                &amp;
              </span>
              <span className="block">{settings.coupleName2}</span>
            </motion.h1>
            <motion.p variants={line} custom={2} className="mx-auto mt-7 max-w-sm font-display text-xl italic text-ink-soft sm:text-2xl">
              {settings.inviteLine}
            </motion.p>
            <motion.div variants={line} custom={3} className="mt-7 flex justify-center">
              <OrnamentDivider />
            </motion.div>
            <motion.p variants={line} custom={3} className="mt-5 font-label text-[0.72rem] uppercase tracking-label text-ink sm:text-[0.8rem]">
              {settings.weddingDatesLabel}
            </motion.p>
            {settings.welcomeMessage && (
              <motion.p variants={line} custom={4} className="body-copy mx-auto mt-5 max-w-md">
                {settings.welcomeMessage}
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
