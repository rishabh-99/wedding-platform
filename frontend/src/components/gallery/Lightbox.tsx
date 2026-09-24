import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import type { MediaDTO } from '@wedding/shared';

interface Props {
  items: MediaDTO[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

/** Fullscreen lightbox: swipe (touch), arrow keys, Escape, video playback, captions. */
export function Lightbox({ items, index, onClose, onIndexChange }: Props) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const open = index !== null && !!items[index];
  const item = open ? items[index!]! : null;

  const go = useCallback(
    (delta: number) => {
      if (index === null || !items.length) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      restoreFocus.current?.focus?.();
    };
  }, [open, go, onClose]);

  // Preload neighbours for instant swiping.
  useEffect(() => {
    if (index === null) return;
    for (const d of [1, -1]) {
      const n = items[(index + d + items.length) % items.length];
      if (n && n.type === 'IMAGE') new Image().src = n.urls.medium;
    }
  }, [index, items]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };

  return createPortal(
    <AnimatePresence>
      {open && item && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[90] flex flex-col bg-maroon-night/95 text-ivory"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <p className="font-label text-[0.65rem] uppercase tracking-label text-gold-pale" aria-live="polite">
              {index! + 1} / {items.length}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ivory hover:bg-white/10"
              aria-label="Close photo viewer"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" stroke="currentColor" strokeWidth="1.6" fill="none" aria-hidden="true">
                <path d="M4 4l12 12M16 4L4 16" />
              </svg>
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-16">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={item.id}
                className="flex h-full w-full items-center justify-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                drag={items.length > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.35}
                onDragEnd={onDragEnd}
              >
                {item.type === 'VIDEO' ? (
                  <video
                    src={item.urls.original}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full"
                    poster={item.urls.thumb !== item.urls.original ? item.urls.medium : undefined}
                  />
                ) : (
                  <img
                    src={item.urls.medium}
                    alt={item.caption ?? 'Wedding photograph'}
                    className="max-h-full max-w-full select-none object-contain"
                    draggable={false}
                    style={{ backgroundImage: item.placeholder ? `url(${item.placeholder})` : undefined, backgroundSize: 'cover' }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {items.length > 1 && (
              <>
                <NavButton side="left" onClick={() => go(-1)} />
                <NavButton side="right" onClick={() => go(1)} />
              </>
            )}
          </div>

          <div className="px-6 pb-safe pt-4 text-center">
            {item.caption && <p className="mx-auto max-w-xl font-display text-lg italic text-ivory/90">{item.caption}</p>}
            {item.event && <p className="mt-1 font-label text-[0.6rem] uppercase tracking-label text-gold-pale">{item.event.name}</p>}
            <p className="mt-3 pb-3 text-xs text-ivory/50 sm:hidden">Swipe to browse</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-gold-light/40 text-ivory transition-colors hover:bg-white/10 sm:flex ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" stroke="currentColor" strokeWidth="1.6" fill="none" aria-hidden="true">
        <path d={side === 'left' ? 'M12.5 4L6.5 10l6 6' : 'M7.5 4l6 6-6 6'} />
      </svg>
    </button>
  );
}
