import { useState } from 'react';
import type { EventDTO, EventInput, PaletteColour } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminEvents, useAdminMedia, useAdminMutation } from '../adminApi';
import { Uploader } from '../components/Uploader';
import { btn, Card, ConfirmButton, FieldRow, PageHeader, TextArea, TextInput, fieldErrors } from '../components/ui';

const invalidate = [adminKeys.events, keys.events, ['event']];

export default function DressCodePage() {
  const { data: events, isLoading } = useAdminEvents();
  return (
    <div>
      <PageHeader title="Dress code" description="What to wear for each celebration: a short dress code, a description, a colour palette and reference images." />
      {isLoading ? <LoadingBlock lines={6} /> : <div className="space-y-6">{(events ?? []).map((e) => <DressCodeEditor key={e.id} event={e} />)}</div>}
    </div>
  );
}

function toInput(e: EventDTO, patch: Partial<EventInput>): EventInput {
  return {
    name: e.name,
    slug: e.slug,
    description: e.description,
    startDateTime: e.startDateTime,
    endDateTime: e.endDateTime,
    venueId: e.venueId,
    dressCode: e.dressCode,
    dressCodeDescription: e.dressCodeDescription,
    dressPalette: e.dressPalette,
    helpfulInfo: e.helpfulInfo,
    displayOrder: e.displayOrder,
    status: e.status,
    isPublished: e.isPublished,
    ...patch,
  };
}

function DressCodeEditor({ event }: { event: EventDTO }) {
  const [code, setCode] = useState(event.dressCode ?? '');
  const [desc, setDesc] = useState(event.dressCodeDescription ?? '');
  const [palette, setPalette] = useState<PaletteColour[]>(event.dressPalette);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refs = useAdminMedia({ eventId: event.id, purpose: 'DRESSCODE', pageSize: 50 });
  const save = useAdminMutation((input: EventInput) => api.put(`/api/admin/events/${event.id}`, input), { invalidate, success: `${event.name} dress code saved` });
  const removeRef = useAdminMutation((id: string) => api.del(`/api/admin/media/${id}`), { invalidate: [['admin', 'media'], ['event']], success: 'Image removed' });

  return (
    <Card title={event.name}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <FieldRow label="Dress code" htmlFor={`dc-${event.id}`} error={errors.dressCode}>
            <TextInput id={`dc-${event.id}`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. Evening Glamour" />
          </FieldRow>
          <FieldRow label="Description" htmlFor={`dd-${event.id}`} error={errors.dressCodeDescription}>
            <TextArea id={`dd-${event.id}`} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </FieldRow>
          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">Colour palette</legend>
            <ul className="space-y-2">
              {palette.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input type="color" aria-label={`Colour ${i + 1}`} value={c.hex} onChange={(e) => setPalette(palette.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))} className="h-10 w-12 cursor-pointer border border-gold/40" />
                  <TextInput aria-label={`Colour ${i + 1} name`} value={c.name} onChange={(e) => setPalette(palette.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <button type="button" className={btn.ghost} onClick={() => setPalette(palette.filter((_, j) => j !== i))} aria-label={`Remove ${c.name}`}>✕</button>
                </li>
              ))}
            </ul>
            {errors.dressPalette && <p className="mt-1 text-xs text-maroon">{errors.dressPalette}</p>}
            <button type="button" className={`${btn.secondary} mt-2`} onClick={() => setPalette([...palette, { name: 'New colour', hex: '#A8894F' }])} disabled={palette.length >= 12}>
              Add colour
            </button>
          </fieldset>
          <button
            type="button"
            className={btn.primary}
            disabled={save.isPending}
            onClick={() =>
              save.mutate(toInput(event, { dressCode: code, dressCodeDescription: desc, dressPalette: palette }), { onError: (err) => setErrors(fieldErrors(err)) })
            }
          >
            Save
          </button>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">Reference images</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(refs.data?.items ?? []).map((m) => (
              <div key={m.id} className="relative">
                <img src={m.urls.thumb} alt="" className="aspect-[3/4] w-full object-cover" />
                <ConfirmButton className={`${btn.small} absolute right-1 top-1 bg-ivory/90 text-maroon`} confirmLabel="Sure?" onConfirm={() => removeRef.mutate(m.id)}>✕</ConfirmButton>
              </div>
            ))}
          </div>
          <Uploader purpose="DRESSCODE" eventId={event.id} allowVideo={false} label="Add reference images" onUploaded={() => void refs.refetch()} />
        </div>
      </div>
    </Card>
  );
}
