import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MediaDTO } from '@wedding/shared';
import { Lightbox } from './Lightbox';
import { MediaImage } from './MediaImage';

/** Premium masonry grid (CSS columns keep natural aspect ratios) with a fullscreen lightbox. */
export function Masonry({ items, columns = 'columns-2 sm:columns-3 lg:columns-4' }: { items: MediaDTO[]; columns?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const reduce = useReducedMotion();

  return (
    <>
      <ul className={`${columns} gap-3 sm:gap-4`} data-testid="masonry">
        {items.map((m, i) => (
          <motion.li
            key={m.id}
            className="mb-3 break-inside-avoid sm:mb-4"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -5% 0px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: (i % 4) * 0.05 }}
          >
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group relative block w-full overflow-hidden border border-gold/20 bg-ivory-100 text-left"
              aria-label={`Open ${m.type === 'VIDEO' ? 'video' : 'photo'}${m.caption ? `: ${m.caption}` : ''}`}
            >
              {m.type === 'VIDEO' && m.urls.thumb === m.urls.original ? (
                // No poster frame was generated — let the browser show the first frame.
                <video src={`${m.urls.original}#t=0.5`} preload="metadata" muted playsInline className="block w-full" aria-hidden="true" />
              ) : (
                <MediaImage
                  media={m}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="transition-transform duration-700 group-hover:scale-[1.02]"
                />
              )}
              {m.type === 'VIDEO' && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-ivory/70 bg-ink/40 text-ivory">
                    <svg viewBox="0 0 20 20" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M6 4l10 6-10 6z" />
                    </svg>
                  </span>
                </span>
              )}
              {m.caption && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 to-transparent px-3 pb-2 pt-8 text-xs text-ivory opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {m.caption}
                </span>
              )}
            </button>
          </motion.li>
        ))}
      </ul>
      <Lightbox items={items} index={index} onClose={() => setIndex(null)} onIndexChange={setIndex} />
    </>
  );
}
