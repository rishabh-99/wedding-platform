import { useRef, useState, type DragEvent } from 'react';
import { preflightUpload, type MediaDTO, type MediaPurpose } from '@wedding/shared';
import { uploadWithProgress } from '../../services/api';
import { btn, formatBytes } from './ui';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface Props {
  purpose: MediaPurpose;
  albumId?: string | null;
  eventId?: string | null;
  isPublished?: boolean;
  allowVideo?: boolean;
  multiple?: boolean;
  label?: string;
  onUploaded?: (media: MediaDTO[]) => void;
}

interface UploadResponse {
  results: { ok: boolean; filename: string; media?: MediaDTO; error?: string }[];
}

/**
 * Drag-and-drop uploader with per-file progress. Files are pre-validated in the
 * browser (type, extension, size) so oversized/invalid files are never sent;
 * the server re-validates everything (magic bytes, dimensions, duration).
 */
export function Uploader({ purpose, albumId, eventId, isPublished = true, allowVideo = true, multiple = true, label, onUploaded }: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const update = (id: string, patch: Partial<UploadItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, multiple ? 50 : 1);
    const queued: UploadItem[] = list.map((file) => {
      const check = preflightUpload(file, { allowVideo });
      return {
        id: `${file.name}-${file.size}-${Math.random()}`,
        file,
        progress: 0,
        status: check.ok ? 'queued' : 'error',
        error: check.ok ? undefined : check.error,
      };
    });
    setItems((prev) => [...prev.filter((p) => p.status === 'uploading'), ...queued]);
    setBusy(true);
    const uploaded: MediaDTO[] = [];
    for (const item of queued.filter((q) => q.status === 'queued')) {
      update(item.id, { status: 'uploading' });
      const form = new FormData();
      form.set('purpose', purpose);
      if (albumId) form.set('albumId', albumId);
      if (eventId) form.set('eventId', eventId);
      form.set('isPublished', String(isPublished));
      form.append('files', item.file);
      try {
        const res = await uploadWithProgress<UploadResponse>('/api/admin/media', form, (p) => update(item.id, { progress: p }));
        const r = res.results[0];
        if (r?.ok && r.media) {
          uploaded.push(r.media);
          update(item.id, { status: 'done', progress: 1 });
        } else {
          update(item.id, { status: 'error', error: r?.error ?? 'Upload failed' });
        }
      } catch (err) {
        update(item.id, { status: 'error', error: (err as Error).message });
      }
    }
    setBusy(false);
    if (uploaded.length) onUploaded?.(uploaded);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging ? 'border-maroon bg-maroon/[0.04]' : 'border-gold/50 bg-white/50'
        }`}
      >
        <p className="font-display text-xl text-maroon">{label ?? (multiple ? 'Drop photographs or videos here' : 'Drop a file here')}</p>
        <p className="mt-1 text-xs text-ink-muted">
          JPEG, PNG, WebP, HEIC{allowVideo ? ', MP4, MOV, WebM' : ''} · images up to 25 MB{allowVideo ? ', videos up to 200 MB / 10 min' : ''}
        </p>
        <button type="button" className={`${btn.secondary} mt-4`} onClick={() => input.current?.click()} disabled={busy}>
          Choose {multiple ? 'files' : 'a file'}
        </button>
        <input
          ref={input}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={`image/jpeg,image/png,image/webp,image/heic,image/heif${allowVideo ? ',video/mp4,video/quicktime,video/webm' : ''}`}
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className="border border-gold/20 bg-white/60 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{i.file.name}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {formatBytes(i.file.size)} ·{' '}
                  {i.status === 'done' ? '✓ Uploaded' : i.status === 'error' ? 'Failed' : i.status === 'uploading' ? `${Math.round(i.progress * 100)}%` : 'Waiting'}
                </span>
              </div>
              {i.status === 'uploading' && (
                <div className="mt-1.5 h-1 bg-gold/20" role="progressbar" aria-valuenow={Math.round(i.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${i.file.name}`}>
                  <div className="h-full bg-maroon transition-[width]" style={{ width: `${i.progress * 100}%` }} />
                </div>
              )}
              {i.error && <p className="mt-1 text-xs text-maroon">{i.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
