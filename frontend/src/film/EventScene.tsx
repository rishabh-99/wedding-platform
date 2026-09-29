import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Player, type PlayerRef } from '@remotion/player';
import type { EventDTO } from '@wedding/shared';
import { FILM_FPS, FILM_HEIGHT, FILM_WIDTH, type SceneEntry } from './sceneRegistry';
import { toInvitation } from './toInvitation';

interface Props {
  event: EventDTO;
  scene: SceneEntry;
  timeZone: string;
  className?: string;
}

/**
 * The event's illustrated scene from the invitation film, drawn live. It plays once when it
 * scrolls into view, pauses when scrolled away, then holds its final composition. With reduced
 * motion it shows that final composition straight away.
 */
export default function EventScene({ event, scene, timeZone, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerRef>(null);
  const reduce = useReducedMotion();
  const inView = useInView(box, { amount: 0.4 });
  const [ended, setEnded] = useState(false);
  const inputProps = useMemo(
    () => ({ inv: toInvitation(event, scene.slot, timeZone), dur: scene.dur }),
    [event, scene, timeZone],
  );

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onEnded = () => setEnded(true);
    p.addEventListener('ended', onEnded);
    return () => p.removeEventListener('ended', onEnded);
  }, []);

  useEffect(() => {
    const p = player.current;
    if (!p || reduce) return;
    if (inView && !ended) p.play();
    else p.pause();
  }, [inView, ended, reduce]);

  const replay = () => {
    player.current?.seekTo(0);
    setEnded(false);
  };

  return (
    <figure className={`relative ${className}`}>
      <div
        ref={box}
        role="img"
        aria-label={`Illustration: ${event.name}`}
        className="relative overflow-hidden border border-gold/40 bg-ivory-100 shadow-paper"
        style={{ aspectRatio: `${FILM_WIDTH} / ${scene.crop}` }}
      >
        <Player
          ref={player}
          lazyComponent={scene.load}
          inputProps={inputProps}
          durationInFrames={scene.dur}
          compositionWidth={FILM_WIDTH}
          compositionHeight={FILM_HEIGHT}
          fps={FILM_FPS}
          initialFrame={reduce ? scene.holdFrame : 0}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          moveToBeginningWhenEnded={false}
          // The scenes are silent; without this the player preloads silent data: audio, which the CSP blocks.
          numberOfSharedAudioTags={0}
          renderLoading={() => <div className="skeleton h-full w-full" />}
          acknowledgeRemotionLicense
          style={{ width: '100%', aspectRatio: `${FILM_WIDTH} / ${FILM_HEIGHT}` }}
        />
      </div>
      {ended && !reduce && (
        <button
          type="button"
          onClick={replay}
          className="absolute bottom-3 right-3 border border-gold/50 bg-ivory-50/90 px-3 py-1.5 font-label text-[0.65rem] uppercase tracking-label text-maroon backdrop-blur-sm hover:bg-ivory-50"
        >
          Replay
        </button>
      )}
    </figure>
  );
}
