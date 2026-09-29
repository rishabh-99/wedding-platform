import { useMemo, useRef } from 'react';
import { useInView } from 'framer-motion';
import { Thumbnail } from '@remotion/player';
import type { EventDTO } from '@wedding/shared';
import { FILM_FPS, FILM_HEIGHT, FILM_WIDTH, type SceneEntry } from './sceneRegistry';
import { toInvitation } from './toInvitation';

interface Props {
  event: EventDTO;
  scene: SceneEntry;
  timeZone: string;
  className?: string;
}

/** A still of the event's film scene (its final composition) for list cards. Drawn only once near the viewport. */
export default function EventArt({ event, scene, timeZone, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, { once: true, margin: '200px 0px' });
  const inputProps = useMemo(
    () => ({ inv: toInvitation(event, scene.slot, timeZone), dur: scene.dur }),
    [event, scene, timeZone],
  );

  return (
    <div
      ref={box}
      aria-hidden="true"
      className={`relative overflow-hidden border border-gold/30 bg-ivory-100 ${className}`}
      style={{ aspectRatio: `${FILM_WIDTH} / ${scene.crop}` }}
    >
      {near ? (
        <Thumbnail
          lazyComponent={scene.load}
          inputProps={inputProps}
          frameToDisplay={scene.holdFrame}
          durationInFrames={scene.dur}
          compositionWidth={FILM_WIDTH}
          compositionHeight={FILM_HEIGHT}
          fps={FILM_FPS}
          renderLoading={() => <div className="skeleton h-full w-full" />}
          style={{ width: '100%', aspectRatio: `${FILM_WIDTH} / ${FILM_HEIGHT}` }}
        />
      ) : (
        <div className="skeleton h-full w-full" />
      )}
    </div>
  );
}
