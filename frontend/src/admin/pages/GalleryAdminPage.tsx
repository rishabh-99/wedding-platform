import { useEffect, useState, type FormEvent } from 'react';
import { albumInputSchema, type AlbumDTO, type MediaDTO } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminAlbums, useAdminEvents, useAdminMedia, useAdminMutation } from '../adminApi';
import { Uploader } from '../components/Uploader';
import { btn, Card, ConfirmButton, FieldRow, Modal, PageHeader, Select, StatusPill, TextInput, Toggle, fieldErrors } from '../components/ui';

const invalidate = [adminKeys.albums, ['admin', 'media'], keys.albums, keys.galleryAll];

export default function GalleryAdminPage() {
  const { data: albums, isLoading } = useAdminAlbums();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlbumDTO | 'new' | null>(null);
  const sorted = [...(albums ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const album = sorted.find((a) => a.id === selected) ?? null;

  useEffect(() => {
    if (!selected && sorted[0]) setSelected(sorted[0].id);
  }, [selected, sorted]);

  const reorder = useAdminMutation((ids: string[]) => api.post('/api/admin/albums/reorder', { ids }), { invalidate, success: 'Album order saved' });
  const move = (i: number, d: number) => {
    const ids = sorted.map((a) => a.id);
    const [m] = ids.splice(i, 1);
    ids.splice(i + d, 0, m!);
    reorder.mutate(ids);
  };

  return (
    <div>
      <PageHeader title="Gallery" description="Albums for each celebration. Uploads are optimised automatically (WebP renditions + thumbnails)." actions={<button type="button" className={btn.primary} onClick={() => setEditing('new')}>New album</button>} />
      {isLoading ? (
        <LoadingBlock lines={5} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <Card title="Albums">
            <ul className="space-y-1">
              {sorted.map((a, i) => (
                <li key={a.id} className={`flex items-center gap-1 ${a.id === selected ? 'bg-maroon/[0.06]' : ''}`}>
                  <button type="button" onClick={() => setSelected(a.id)} className={`min-h-[40px] flex-1 px-2 text-left text-sm ${a.id === selected ? 'font-semibold text-maroon' : ''}`}>
                    {a.name} <span className="text-xs text-ink-muted">({a.count})</span>
                    {!a.isPublished && <span className="ml-1 text-xs text-ink-muted">· hidden</span>}
                  </button>
                  <button type="button" className={btn.small} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${a.name} up`}>↑</button>
                  <button type="button" className={btn.small} disabled={i === sorted.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${a.name} down`}>↓</button>
                </li>
              ))}
            </ul>
          </Card>
          {album ? <AlbumPanel album={album} onEdit={() => setEditing(album)} /> : <p className="text-sm text-ink-muted">Create an album to start uploading.</p>}
        </div>
      )}
      {editing && <AlbumForm album={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onCreated={(a) => setSelected(a.id)} />}
    </div>
  );
}

function AlbumPanel({ album, onEdit }: { album: AlbumDTO; onEdit: () => void }) {
  const media = useAdminMedia({ albumId: album.id, purpose: 'GALLERY', pageSize: 200 });
  const items = [...(media.data?.items ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const update = useAdminMutation(({ id, ...body }: { id: string; caption?: string | null; isPublished?: boolean }) => api.patch(`/api/admin/media/${id}`, body), { invalidate, success: 'Saved' });
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/media/${id}`), { invalidate, success: 'Deleted' });
  const reorder = useAdminMutation((ids: string[]) => api.post('/api/admin/media/reorder', { ids }), { invalidate });
  const removeAlbum = useAdminMutation(() => api.del(`/api/admin/albums/${album.id}`), { invalidate, success: 'Album deleted (photos kept in the media library)' });

  const move = (i: number, d: number) => {
    const ids = items.map((m) => m.id);
    const [m] = ids.splice(i, 1);
    ids.splice(i + d, 0, m!);
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-4">
      <Card
        title={`${album.name} · ${items.length} items`}
        actions={
          <div className="flex gap-2">
            <button type="button" className={btn.secondary} onClick={onEdit}>Album settings</button>
            <ConfirmButton onConfirm={() => removeAlbum.mutate(undefined)}>Delete album</ConfirmButton>
          </div>
        }
      >
        <Uploader purpose="GALLERY" albumId={album.id} eventId={album.eventId} />
      </Card>
      {media.isLoading ? (
        <LoadingBlock lines={3} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((m, i) => (
            <MediaTile
              key={m.id}
              media={m}
              first={i === 0}
              last={i === items.length - 1}
              onMove={(d) => move(i, d)}
              onSave={(caption) => update.mutate({ id: m.id, caption })}
              onTogglePublish={() => update.mutate({ id: m.id, isPublished: !m.isPublished })}
              onDelete={() => remove.mutate(m.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaTile({ media, first, last, onMove, onSave, onTogglePublish, onDelete }: {
  media: MediaDTO;
  first: boolean;
  last: boolean;
  onMove: (d: number) => void;
  onSave: (caption: string | null) => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(media.caption ?? '');
  return (
    <li className="border border-gold/25 bg-white/70">
      <div className="relative aspect-square bg-ivory-200">
        <img src={media.urls.thumb} alt={media.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />
        <span className="absolute left-1 top-1">
          <StatusPill status={media.isPublished ? 'PUBLISHED' : 'HIDDEN'} />
        </span>
        {media.type === 'VIDEO' && <span className="absolute bottom-1 right-1 bg-ink/70 px-1.5 text-xs text-ivory">VIDEO</span>}
      </div>
      <div className="space-y-1.5 p-2">
        <input
          aria-label="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== (media.caption ?? '') && onSave(caption || null)}
          placeholder="Caption"
          className="w-full border border-gold/30 px-2 py-1 text-xs"
        />
        <div className="flex flex-wrap gap-1">
          <button type="button" className={`${btn.small} border border-gold/40`} disabled={first} onClick={() => onMove(-1)} aria-label="Move earlier">←</button>
          <button type="button" className={`${btn.small} border border-gold/40`} disabled={last} onClick={() => onMove(1)} aria-label="Move later">→</button>
          <button type="button" className={`${btn.small} border border-gold/40`} onClick={onTogglePublish}>{media.isPublished ? 'Hide' : 'Publish'}</button>
          <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Sure?" onConfirm={onDelete}>Delete</ConfirmButton>
        </div>
      </div>
    </li>
  );
}

function AlbumForm({ album, onClose, onCreated }: { album: AlbumDTO | null; onClose: () => void; onCreated: (a: AlbumDTO) => void }) {
  const { data: events } = useAdminEvents();
  const [form, setForm] = useState({
    name: album?.name ?? '',
    slug: album?.slug ?? '',
    description: album?.description ?? '',
    eventId: album?.eventId ?? '',
    displayOrder: album?.displayOrder ?? 99,
    isPublished: album?.isPublished ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation(
    (input: typeof form) => (album ? api.put<AlbumDTO>(`/api/admin/albums/${album.id}`, input) : api.post<AlbumDTO>('/api/admin/albums', input)),
    { invalidate, success: 'Album saved', onSuccess: (a) => { onCreated(a as AlbumDTO); onClose(); } },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = albumInputSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    save.mutate(form, { onError: (err) => setErrors(fieldErrors(err)) });
  };
  return (
    <Modal open onClose={onClose} title={album ? 'Album settings' : 'New album'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FieldRow label="Name" error={errors.name} htmlFor="al-name">
          <TextInput
            id="al-name"
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value, slug: album ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))
            }
          />
        </FieldRow>
        <FieldRow label="Slug" error={errors.slug} htmlFor="al-slug">
          <TextInput id="al-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        </FieldRow>
        <FieldRow label="Celebration" htmlFor="al-event">
          <Select id="al-event" value={form.eventId} onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}>
            <option value="">— None —</option>
            {(events ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </Select>
        </FieldRow>
        <FieldRow label="Description" htmlFor="al-desc">
          <TextInput id="al-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </FieldRow>
        <Toggle checked={form.isPublished} onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} label="Visible to guests" />
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
