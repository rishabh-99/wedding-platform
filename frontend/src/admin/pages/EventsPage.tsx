import { useState, type FormEvent } from 'react';
import { eventInputSchema, formatDateTime, parseLocalDateTime, toLocalDateTimeInput, type EventDTO, type EventInput } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminEvents, useAdminMutation, useAdminVenues, useWeddingTz } from '../adminApi';
import { btn, ConfirmButton, FieldRow, Modal, PageHeader, Select, StatusPill, TextArea, TextInput, Toggle, fieldErrors, tableCls } from '../components/ui';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

const invalidate = [adminKeys.events, keys.events, keys.schedule, ['event']];

export default function EventsPage() {
  const { data: events, isLoading } = useAdminEvents();
  const tz = useWeddingTz();
  const [editing, setEditing] = useState<EventDTO | 'new' | null>(null);

  const reorder = useAdminMutation((ids: string[]) => api.post('/api/admin/events/reorder', { ids }), { invalidate, success: 'Order saved' });
  const publish = useAdminMutation(({ id, isPublished }: { id: string; isPublished: boolean }) => api.patch(`/api/admin/events/${id}/publish`, { isPublished }), {
    invalidate,
    success: 'Event updated',
  });
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/events/${id}`), { invalidate, success: 'Event deleted' });

  const list = [...(events ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const move = (index: number, delta: number) => {
    const ids = list.map((e) => e.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    reorder.mutate(ids);
  };

  return (
    <div>
      <PageHeader
        title="Events"
        description="The countdown, “What’s happening now” and live mode are computed from these records automatically."
        actions={<button type="button" className={btn.primary} onClick={() => setEditing('new')}>New event</button>}
      />
      {isLoading ? (
        <LoadingBlock lines={6} />
      ) : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead>
              <tr>
                <th className={tableCls.th}>Order</th>
                <th className={tableCls.th}>Event</th>
                <th className={tableCls.th}>Starts</th>
                <th className={tableCls.th}>Venue</th>
                <th className={tableCls.th}>Status</th>
                <th className={tableCls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e, i) => (
                <tr key={e.id}>
                  <td className={tableCls.td}>
                    <div className="flex gap-1">
                      <button type="button" className={`${btn.small} border border-gold/40`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label={`Move ${e.name} up`}>↑</button>
                      <button type="button" className={`${btn.small} border border-gold/40`} disabled={i === list.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label={`Move ${e.name} down`}>↓</button>
                    </div>
                  </td>
                  <td className={tableCls.td}>
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-xs text-ink-muted">/{e.slug}</p>
                  </td>
                  <td className={`${tableCls.td} whitespace-nowrap`}>{formatDateTime(e.startDateTime, tz)}</td>
                  <td className={tableCls.td}>{e.venue?.name ?? '—'}</td>
                  <td className={tableCls.td}>
                    <div className="flex flex-wrap gap-1">
                      <StatusPill status={e.isPublished ? 'PUBLISHED' : 'HIDDEN'} />
                      {e.status !== 'SCHEDULED' && <StatusPill status={e.status} />}
                    </div>
                  </td>
                  <td className={tableCls.td}>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => setEditing(e)}>Edit</button>
                      <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => publish.mutate({ id: e.id, isPublished: !e.isPublished })}>
                        {e.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} onConfirm={() => remove.mutate(e.id)}>Delete</ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EventForm event={editing === 'new' ? null : editing} nextOrder={list.length + 1} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EventForm({ event, nextOrder, onClose }: { event: EventDTO | null; nextOrder: number; onClose: () => void }) {
  const tz = useWeddingTz();
  const { data: venues } = useAdminVenues();
  const startLocal = event ? toLocalDateTimeInput(event.startDateTime, tz) : '';
  const endLocal = event?.endDateTime ? toLocalDateTimeInput(event.endDateTime, tz) : '';
  const [form, setForm] = useState({
    name: event?.name ?? '',
    slug: event?.slug ?? '',
    date: startLocal.slice(0, 10),
    startTime: startLocal.slice(11, 16),
    endDate: endLocal.slice(0, 10),
    endTime: endLocal.slice(11, 16),
    venueId: event?.venueId ?? '',
    description: event?.description ?? '',
    dressCode: event?.dressCode ?? '',
    helpfulInfo: event?.helpfulInfo ?? '',
    displayOrder: event?.displayOrder ?? nextOrder,
    status: event?.status ?? 'SCHEDULED',
    isPublished: event?.isPublished ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(!!event);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useAdminMutation(
    (input: EventInput) => (event ? api.put(`/api/admin/events/${event.id}`, input) : api.post('/api/admin/events', input)),
    { invalidate, success: event ? 'Event saved' : 'Event created', onSuccess: onClose },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.date || !form.startTime) errs.startDateTime = 'Choose a date and start time';
    let startDateTime = '';
    let endDateTime: string | null = null;
    try {
      if (form.date && form.startTime) startDateTime = parseLocalDateTime(`${form.date}T${form.startTime}`, tz).toISOString();
      if (form.endTime) endDateTime = parseLocalDateTime(`${form.endDate || form.date}T${form.endTime}`, tz).toISOString();
    } catch {
      errs.startDateTime = 'Invalid date or time';
    }
    const input: EventInput = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      startDateTime,
      endDateTime,
      venueId: form.venueId || null,
      dressCode: form.dressCode,
      dressCodeDescription: event?.dressCodeDescription ?? null,
      dressPalette: event?.dressPalette ?? [],
      helpfulInfo: form.helpfulInfo,
      displayOrder: Number(form.displayOrder),
      status: form.status as EventInput['status'],
      isPublished: form.isPublished,
    };
    const parsed = eventInputSchema.safeParse(input);
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate(input, { onError: (err) => setErrors(fieldErrors(err)) });
  };

  return (
    <Modal open onClose={onClose} title={event ? `Edit ${event.name}` : 'New event'} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <FieldRow label="Name" error={errors.name} htmlFor="ev-name">
          <TextInput
            id="ev-name"
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value);
              if (!slugTouched) set('slug', slugify(e.target.value));
            }}
          />
        </FieldRow>
        <FieldRow label="Slug (URL)" error={errors.slug} htmlFor="ev-slug" hint="Used in /celebrations/…">
          <TextInput id="ev-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }} />
        </FieldRow>
        <FieldRow label={`Date (${tz})`} error={errors.startDateTime} htmlFor="ev-date">
          <TextInput id="ev-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </FieldRow>
        <FieldRow label="Start time" htmlFor="ev-start">
          <TextInput id="ev-start" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
        </FieldRow>
        <FieldRow label="End date (optional)" htmlFor="ev-enddate" hint="Defaults to the start date">
          <TextInput id="ev-enddate" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </FieldRow>
        <FieldRow label="End time (optional)" error={errors.endDateTime} htmlFor="ev-end" hint="Leave blank for “onwards”">
          <TextInput id="ev-end" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
        </FieldRow>
        <FieldRow label="Venue" htmlFor="ev-venue">
          <Select id="ev-venue" value={form.venueId} onChange={(e) => set('venueId', e.target.value)}>
            <option value="">— No venue —</option>
            {(venues ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Dress code" error={errors.dressCode} htmlFor="ev-dress" hint="Palette & details: Dress Code page">
          <TextInput id="ev-dress" value={form.dressCode} onChange={(e) => set('dressCode', e.target.value)} />
        </FieldRow>
        <div className="sm:col-span-2">
          <FieldRow label="Description" error={errors.description} htmlFor="ev-desc">
            <TextArea id="ev-desc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </FieldRow>
        </div>
        <div className="sm:col-span-2">
          <FieldRow label="Helpful information" error={errors.helpfulInfo} htmlFor="ev-info">
            <TextArea id="ev-info" rows={3} value={form.helpfulInfo} onChange={(e) => set('helpfulInfo', e.target.value)} />
          </FieldRow>
        </div>
        <FieldRow label="Display order" htmlFor="ev-order">
          <TextInput id="ev-order" type="number" min={0} value={form.displayOrder} onChange={(e) => set('displayOrder', Number(e.target.value))} />
        </FieldRow>
        <FieldRow label="Status" htmlFor="ev-status">
          <Select id="ev-status" value={form.status} onChange={(e) => set('status', e.target.value as typeof form.status)}>
            <option value="SCHEDULED">Scheduled</option>
            <option value="POSTPONED">Postponed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </FieldRow>
        <div className="sm:col-span-2">
          <Toggle id="ev-pub" checked={form.isPublished} onChange={(v) => set('isPublished', v)} label="Published (visible to guests)" />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save event'}</button>
        </div>
      </form>
    </Modal>
  );
}
