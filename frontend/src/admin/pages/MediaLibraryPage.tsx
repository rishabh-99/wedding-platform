import { useEffect, useState } from 'react';
import { formatDateTime, type MediaDTO } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { useAdminEvents, useAdminMedia, useAdminMutation, useWeddingTz } from '../adminApi';
import { btn, ConfirmButton, EmptyRow, formatBytes, Modal, PageHeader, Select, StatusPill, TextInput, tableCls } from '../components/ui';

export default function MediaLibraryPage() {
  const tz = useWeddingTz();
  const { data: events } = useAdminEvents();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [type, setType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [eventId, setEventId] = useState('');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<MediaDTO | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setDq(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [dq, type, purpose, eventId]);

  const { data, isLoading } = useAdminMedia({ q: dq || undefined, type: type || undefined, purpose: purpose || undefined, eventId: eventId || undefined, page, pageSize: 40 });
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/media/${id}`), { invalidate: [['admin', 'media'], keys.galleryAll], success: 'Deleted' });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader title="Media library" description="Every uploaded file. Originals are preserved; guests see optimised renditions." />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput type="search" placeholder="Search filename or caption" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          <option value="IMAGE">Images</option>
          <option value="VIDEO">Videos</option>
          <option value="DOCUMENT">Documents</option>
        </Select>
        <Select value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="Used for">
          <option value="">All uses</option>
          {['GALLERY', 'LIVE', 'GUESTBOOK', 'BRANDING', 'DRESSCODE', 'STORY'].map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
        </Select>
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Celebration">
          <option value="">All celebrations</option>
          {(events ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </div>
      {isLoading ? (
        <LoadingBlock lines={8} />
      ) : (
        <>
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead>
                <tr>
                  {['Preview', 'Filename', 'Type', 'Size', 'Celebration', 'Uploaded', 'Storage location', ''].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {!data?.items.length && <EmptyRow colSpan={8}>No media found.</EmptyRow>}
                {data?.items.map((m) => (
                  <tr key={m.id}>
                    <td className={tableCls.td}>
                      <button type="button" onClick={() => setPreview(m)} aria-label={`Preview ${m.originalFilename}`}>
                        <img src={m.urls.thumb} alt="" className="h-12 w-16 object-cover" loading="lazy" />
                      </button>
                    </td>
                    <td className={`${tableCls.td} max-w-[14rem]`}>
                      <p className="truncate font-semibold">{m.originalFilename}</p>
                      {m.caption && <p className="truncate text-xs text-ink-muted">{m.caption}</p>}
                    </td>
                    <td className={tableCls.td}>
                      <div className="flex flex-col gap-1 text-xs">
                        <span>{m.type} · {m.purpose.toLowerCase()}</span>
                        {m.width && m.height && <span className="text-ink-muted">{m.width}×{m.height}{m.duration ? ` · ${Math.round(m.duration)}s` : ''}</span>}
                        {!m.isPublished && <StatusPill status="HIDDEN" />}
                      </div>
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{formatBytes(m.size)}</td>
                    <td className={tableCls.td}>{m.event?.name ?? '—'}</td>
                    <td className={`${tableCls.td} whitespace-nowrap text-xs`}>{formatDateTime(m.createdAt, tz)}</td>
                    <td className={`${tableCls.td} max-w-[16rem] break-all text-xs text-ink-muted`}>{m.storageDriver}</td>
                    <td className={tableCls.td}>
                      <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Sure?" onConfirm={() => remove.mutate(m.id)}>Delete</ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
            <span>{data?.total ?? 0} files</span>
            <span className="flex items-center gap-2">
              <button type="button" className={btn.secondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              {page} / {pages}
              <button type="button" className={btn.secondary} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          </div>
        </>
      )}
      {preview && (
        <Modal open onClose={() => setPreview(null)} title={preview.originalFilename} wide>
          {preview.type === 'VIDEO' ? (
            <video src={preview.urls.original} controls className="w-full" />
          ) : (
            <img src={preview.urls.medium} alt={preview.caption ?? ''} className="w-full" />
          )}
          <a href={preview.urls.original} target="_blank" rel="noreferrer" className={`${btn.secondary} mt-3`}>Open original</a>
        </Modal>
      )}
    </div>
  );
}
