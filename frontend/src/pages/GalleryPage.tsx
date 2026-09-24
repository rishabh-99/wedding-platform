import { useSearchParams } from 'react-router-dom';
import { Masonry } from '../components/gallery/Masonry';
import { EmptyState, ErrorState, LoadingBlock, SectionHeading } from '../components/ui/primitives';
import { useAlbums, useGallery } from '../services/queries';

/** Gallery with album filtering (Engagement, Haldi, Mehendi, …) and "All photos". */
export default function GalleryPage() {
  const [params, setParams] = useSearchParams();
  const album = params.get('album') ?? undefined;
  const albums = useAlbums();
  const gallery = useGallery(album, 30);
  const items = gallery.data?.pages.flatMap((p) => p.items) ?? [];
  const current = albums.data?.find((a) => a.slug === album);

  return (
    <section className="section" aria-labelledby="gallery-page-title">
      <div className="container-page">
        <SectionHeading id="gallery-page-title" as="h1" eyebrow="The album" title={current ? current.name : 'The gallery'} />

        <nav aria-label="Albums" className="-mx-5 mb-10 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-2 sm:flex-wrap sm:justify-center">
            <li>
              <FilterChip active={!album} onClick={() => setParams({})} label="All photos" />
            </li>
            {(albums.data ?? [])
              .filter((a) => a.count > 0)
              .map((a) => (
                <li key={a.id}>
                  <FilterChip active={album === a.slug} onClick={() => setParams({ album: a.slug })} label={a.name} count={a.count} />
                </li>
              ))}
          </ul>
        </nav>

        {gallery.isLoading ? (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton mb-3" style={{ height: 160 + ((i * 67) % 140) }} />
            ))}
          </div>
        ) : gallery.isError ? (
          <ErrorState title="The gallery could not be loaded" onRetry={() => gallery.refetch()} />
        ) : items.length ? (
          <>
            <Masonry items={items} />
            {gallery.hasNextPage && (
              <div className="mt-10 text-center">
                <button type="button" className="btn-outline" onClick={() => gallery.fetchNextPage()} disabled={gallery.isFetchingNextPage}>
                  {gallery.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="Photographs coming soon" message="Moments from the celebrations will appear here." />
        )}
        {gallery.isFetchingNextPage && <LoadingBlock lines={1} />}
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] whitespace-nowrap border px-4 font-label text-[0.66rem] uppercase tracking-wide2 transition-colors ${
        active ? 'border-maroon bg-maroon text-ivory' : 'border-gold/40 text-ink-soft hover:border-gold hover:text-maroon'
      }`}
    >
      {label}
      {count !== undefined && <span className={`ml-2 ${active ? 'text-gold-pale' : 'text-ink-muted'}`}>{count}</span>}
    </button>
  );
}
