import { useEffect, useState } from 'react';
import { FILM_FPS } from './sceneRegistry';

/**
 * A film frame counter for artwork drawn outside a Remotion player (the film's pieces animate
 * from a frame number). While `running`, it counts from 0 to `end` at 30 fps and stops there;
 * changing `restartKey` starts it again. When not running it sits on `end`, the finished state.
 */
export function useFrameClock(running: boolean, end: number, restartKey: unknown = null): number {
  const [frame, setFrame] = useState(running ? 0 : end);

  useEffect(() => {
    if (!running) {
      setFrame(end);
      return;
    }
    setFrame(0);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.min(end, Math.floor(((now - t0) / 1000) * FILM_FPS));
      setFrame(f);
      if (f < end) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, end, restartKey]);

  return frame;
}
