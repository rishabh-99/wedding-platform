import { useState, type FormEvent } from 'react';
import { venueInputSchema, type VenueDTO } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminMutation, useAdminVenues } from '../adminApi';
import { btn, Card, ConfirmButton, FieldRow, Modal, PageHeader, TextArea, TextInput, fieldErrors } from '../components/ui';

const invalidate = [adminKeys.venues, keys.venues, keys.events, adminKeys.events];
const FIELDS: { key: keyof VenueDTO; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'mapsUrl', label: 'Google Maps link' },
  { key: 'address', label: 'Address', multiline: true },
  { key: 'description', label: 'Description', multiline: true },
  { key: 'parkingInformation', label: 'Parking', multiline: true },
  { key: 'nearbyLandmarks', label: 'Nearby landmarks', multiline: true },
  { key: 'transportInformation', label: 'Transport', multiline: true },
  { key: 'contactInformation', label: 'Contact', multiline: true },
];

export default function VenuesPage() {
  const { data, isLoading } = useAdminVenues();
  const [editing, setEditing] = useState<VenueDTO | 'new' | null>(null);
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/venues/${id}`), { invalidate, success: 'Venue deleted' });

  return (
    <div>
      <PageHeader title="Venues" description="Directions buttons across the site open each venue’s Google Maps link." actions={<button type="button" className={btn.primary} onClick={() => setEditing('new')}>New venue</button>} />
      {isLoading ? (
        <LoadingBlock lines={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((v) => (
            <Card key={v.id}>
              <p className="font-display text-2xl text-maroon">{v.name}</p>
              {v.address && <p className="mt-1 text-sm text-ink-soft">{v.address}</p>}
              {v.mapsUrl ? (
                <a href={v.mapsUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-maroon underline">{v.mapsUrl}</a>
              ) : (
                <p className="mt-2 text-sm text-maroon">No maps link yet</p>
              )}
              <div className="mt-4 flex gap-2">
                <button type="button" className={btn.secondary} onClick={() => setEditing(v)}>Edit</button>
                <ConfirmButton onConfirm={() => remove.mutate(v.id)} />
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <VenueForm venue={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function VenueForm({ venue, onClose }: { venue: VenueDTO | null; onClose: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, (venue?.[f.key] as string | null) ?? ''])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation(
    (input: Record<string, unknown>) => (venue ? api.put(`/api/admin/venues/${venue.id}`, input) : api.post('/api/admin/venues', input)),
    { invalidate, success: 'Venue saved', onSuccess: onClose },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input = { ...form, displayOrder: venue?.displayOrder ?? 0 };
    const parsed = venueInputSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    save.mutate(input, { onError: (err) => setErrors(fieldErrors(err)) });
  };
  return (
    <Modal open onClose={onClose} title={venue ? `Edit ${venue.name}` : 'New venue'} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {FIELDS.map((f) => (
          <div key={f.key} className={f.multiline ? 'sm:col-span-2' : ''}>
            <FieldRow label={f.label} error={errors[f.key]} htmlFor={`v-${f.key}`}>
              {f.multiline ? (
                <TextArea id={`v-${f.key}`} rows={2} value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
              ) : (
                <TextInput id={`v-${f.key}`} value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
              )}
            </FieldRow>
          </div>
        ))}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>Save venue</button>
        </div>
      </form>
    </Modal>
  );
}
