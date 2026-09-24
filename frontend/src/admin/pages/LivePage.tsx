import { useState, type FormEvent } from 'react';
import {
  formatDateTime,
  liveUpdateInputSchema,
  parseLocalDateTime,
  toLocalDateTimeInput,
  type LiveUpdateDTO,
  type LiveUpdateInput,
  type MediaDTO,
} from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminEvents, useAdminLive, useAdminMutation, useWeddingTz } from '../adminApi';
import { Uploader } from '../components/Uploader';
import { btn, Card, ConfirmButton, FieldRow, Modal, PageHeader, Select, StatusPill, TextArea, TextInput, fieldErrors } from '../components/ui';

const invalidate = [['admin', 'live'], keys.liveAll];
const TABS = ['all', 'PUBLISHED', 'SCHEDULED', 'DRAFT'] as const;

export default function LivePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const { data, isLoading } = useAdminLive(tab === 'all' ? undefined : tab);
  const [editing, setEditing] = useState<LiveUpdateDTO | null>(null);
  const tz = useWeddingTz();

  const publish = useAdminMutation(({ id, isPublished }: { id: string; isPublished: boolean }) => api.patch(`/api/admin/live/${id}/publish`, { isPublished }), {
    invalidate,
    success: (r) => ((r as LiveUpdateDTO).published ? 'Published — guests will see it instantly' : 'Unpublished'),
  });
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/live/${id}`), { invalidate, success: 'Update deleted' });

  return (
    <div>
      <PageHeader title="Live updates" description="Published updates reach every open guest browser instantly, without a refresh." />
      <Card title="New update">
        <LiveComposer key="new" onDone={() => setTab('all')} />
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter updates">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? btn.primary : btn.secondary}>
            {t === 'all' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingBlock lines={4} />
      ) : !data?.length ? (
        <p className="py-8 text-center text-sm text-ink-muted">No updates here yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 border border-gold/25 bg-white/70 p-4 sm:flex-row">
              {u.media && (
                <img src={u.media.urls.thumb} alt="" className="h-24 w-32 shrink-0 object-cover" loading="lazy" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <StatusPill status={u.status} />
                  <span className="uppercase tracking-wider">{u.type}</span>
                  {u.event && <span>· {u.event.name}</span>}
                  <span>
                    ·{' '}
                    {u.status === 'PUBLISHED' && u.publishedAt
                      ? `Published ${formatDateTime(u.publishedAt, tz)}`
                      : u.status === 'SCHEDULED' && u.scheduledFor
                        ? `Scheduled for ${formatDateTime(u.scheduledFor, tz)}`
                        : `Edited ${formatDateTime(u.updatedAt, tz)}`}
                  </span>
                </div>
                {u.title && <p className="mt-1 font-semibold">{u.title}</p>}
                <p className="mt-1 whitespace-pre-line text-sm">{u.content}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-1 sm:flex-col">
                <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => setEditing(u)}>Edit</button>
                <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => publish.mutate({ id: u.id, isPublished: !u.published })}>
                  {u.published ? 'Unpublish' : 'Publish now'}
                </button>
                <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} onConfirm={() => remove.mutate(u.id)}>Delete</ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title="Edit update" wide>
          <LiveComposer existing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function LiveComposer({ existing, onDone }: { existing?: LiveUpdateDTO; onDone?: () => void }) {
  const tz = useWeddingTz();
  const { data: events } = useAdminEvents();
  const [eventId, setEventId] = useState(existing?.eventId ?? '');
  const [type, setType] = useState<LiveUpdateInput['type']>(existing?.type ?? 'TEXT');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [media, setMedia] = useState<MediaDTO | null>(existing?.media ?? null);
  const [when, setWhen] = useState(existing?.scheduledFor ? toLocalDateTimeInput(existing.scheduledFor, tz) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploaderKey, setUploaderKey] = useState(0);

  const save = useAdminMutation(
    (input: LiveUpdateInput) => (existing ? api.put<LiveUpdateDTO>(`/api/admin/live/${existing.id}`, input) : api.post<LiveUpdateDTO>('/api/admin/live', input)),
    {
      invalidate,
      success: (r) => {
        const s = (r as LiveUpdateDTO).status;
        return s === 'PUBLISHED' ? 'Published — guests will see it instantly' : s === 'SCHEDULED' ? 'Scheduled' : 'Saved as draft';
      },
      onSuccess: () => {
        if (!existing) {
          setTitle('');
          setContent('');
          setMedia(null);
          setWhen('');
          setUploaderKey((k) => k + 1);
        }
        onDone?.();
      },
    },
  );

  const submit = (action: 'publish' | 'schedule' | 'draft') => (e?: FormEvent) => {
    e?.preventDefault();
    let scheduledFor: string | null = null;
    if (action === 'schedule') {
      if (!when) return setErrors({ scheduledFor: 'Choose when to publish' });
      scheduledFor = parseLocalDateTime(when, tz).toISOString();
    }
    const input: LiveUpdateInput = { eventId: eventId || null, type, title, content, mediaAssetId: media?.id ?? null, action, scheduledFor };
    const parsed = liveUpdateInputSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    save.mutate(input, { onError: (err) => setErrors(fieldErrors(err)) });
  };

  return (
    <form onSubmit={submit('publish')} className="grid gap-4 lg:grid-cols-[1fr_20rem]" noValidate>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Celebration" htmlFor="lu-event">
            <Select id="lu-event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">— General —</option>
              {(events ?? []).map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="Type" htmlFor="lu-type">
            <Select id="lu-type" value={type} onChange={(e) => setType(e.target.value as LiveUpdateInput['type'])}>
              <option value="TEXT">Text</option>
              <option value="PHOTO">Photo</option>
              <option value="VIDEO">Video</option>
              <option value="ANNOUNCEMENT">Announcement</option>
            </Select>
          </FieldRow>
        </div>
        <FieldRow label="Title (optional)" htmlFor="lu-title" error={errors.title}>
          <TextInput id="lu-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FieldRow>
        <FieldRow label="Caption / message" htmlFor="lu-content" error={errors.content}>
          <TextArea id="lu-content" rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="The dance floor is officially open!" />
        </FieldRow>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : existing?.published ? 'Save & keep published' : 'Publish now'}
          </button>
          <button type="button" className={btn.secondary} onClick={() => submit('draft')()} disabled={save.isPending}>
            {existing?.published ? 'Unpublish (draft)' : 'Save draft'}
          </button>
          <div className="flex items-end gap-2">
            <FieldRow label={`Schedule (${tz})`} htmlFor="lu-when" error={errors.scheduledFor}>
              <TextInput id="lu-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </FieldRow>
            <button type="button" className={btn.secondary} onClick={() => submit('schedule')()} disabled={save.isPending}>
              Schedule
            </button>
          </div>
        </div>
      </div>
      <div>
        {media ? (
          <div className="border border-gold/30 bg-white/60 p-2">
            {media.type === 'VIDEO' ? (
              <video src={media.urls.original} controls className="w-full" />
            ) : (
              <img src={media.urls.thumb} alt="" className="w-full object-cover" />
            )}
            <button type="button" className={`${btn.ghost} mt-2 w-full`} onClick={() => setMedia(null)}>Remove media</button>
          </div>
        ) : (
          <Uploader
            key={uploaderKey}
            purpose="LIVE"
            multiple={false}
            label="Add a photo or video"
            eventId={eventId || null}
            onUploaded={(m) => {
              setMedia(m[0] ?? null);
              if (m[0] && type === 'TEXT') setType(m[0].type === 'VIDEO' ? 'VIDEO' : 'PHOTO');
            }}
          />
        )}
      </div>
    </form>
  );
}
