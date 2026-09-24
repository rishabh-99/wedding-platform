import { useState } from 'react';
import type { MediaDTO } from '@wedding/shared';

interface Props {
  media: MediaDTO;
  sizes?: string;
  className?: string;
  alt?: string;
  eager?: boolean;
  fit?: 'cover' | 'contain';
}

/**
 * Progressive, responsive image: a tiny blurred placeholder paints instantly,
 * then the browser picks the thumbnail (≤640w) or medium (≤1800w) WebP
 * rendition via srcset. The original upload is never used for display.
 */
export function MediaImage({ media, sizes = '100vw', className = '', alt, eager = false, fit = 'cover' }: Props) {
  const [loaded, setLoaded] = useState(false);
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : undefined;
  const thumbW = Math.min(640, media.width ?? 640);
  const srcSet =
    media.urls.thumb !== media.urls.medium ? `${media.urls.thumb} ${thumbW}w, ${media.urls.medium} ${Math.min(1800, media.width ?? 1800)}w` : undefined;

  return (
    <div
      className={`relative overflow-hidden bg-ivory-200 ${className}`}
      style={{
        aspectRatio: ratio,
        backgroundImage: media.placeholder ? `url(${media.placeholder})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <img
        src={media.urls.medium}
        srcSet={srcSet}
        sizes={sizes}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        alt={alt ?? media.caption ?? 'Wedding photograph'}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full transition-[opacity,filter] duration-700 ${fit === 'cover' ? 'object-cover' : 'object-contain'} ${
          loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
        }`}
      />
    </div>
  );
}
