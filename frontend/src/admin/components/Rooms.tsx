import { useState, type FormEvent } from 'react';
import {
  SIDE_LABELS,
  accommodationInputSchema,
  formatDateTime,
  parseLocalDateTime,
  roomAssignmentInputSchema,
  toLocalDateTimeInput,
  type AccommodationDTO,
  type GuestSide,
  type RoomAssignmentDTO,
} from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { adminKeys, useAccommodations, useAdminMutation, useRoomBoard, useWeddingTz } from '../adminApi';
import { useToast } from './Toast';
import { btn, Card, ConfirmButton, FieldRow, Modal, Select, StatusPill, TextArea, TextInput, fieldErrors, tableCls } from './ui';

const invalidate = [['admin', 'rsvps'], adminKeys.rooms, adminKeys.accommodations];

export interface RoomTarget {
  rsvpId: string;
  guestName: string;
  numberOfGuests: number;
  rooms: RoomAssignmentDTO[];
}

/** Allot / edit / remove rooms for one RSVP party. */
export function RoomAssignModal({ target, onClose }: { target: RoomTarget; onClose: () => void }) {
  const tz = useWeddingTz();
  const { data: accommodations, isLoading } = useAccommodations();
  const toast = useToast();
  const [editing, setEditing] = useState<RoomAssignmentDTO | null>(null);
  const [rooms, setRooms] = useState(target.rooms);
  const blank = { accommodationId: '', roomNumber: '', checkIn: '', checkOut: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useAdminMutation(
    (body: Record<string, unknown>) =>
      editing ? api.put<RoomAssignmentDTO>(`/api/admin/rooms/${editing.id}`, body) : api.post<RoomAssignmentDTO>('/api/admin/rooms', body),
    {
      invalidate,
      onSuccess: (r) => {
        const room = r as RoomAssignmentDTO;
        setRooms((prev) => [...prev.filter((x) => x.id !== room.id), room].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })));
        toast.show(
          room.sharedWith?.length
            ? `Room ${room.roomNumber} saved — note: also allotted to ${room.sharedWith.join(', ')}`
            : `Room ${room.roomNumber} at ${room.accommodationName} allotted`,
          room.sharedWith?.length ? 'info' : 'success',
        );
        setEditing(null);
        setForm((f) => ({ ...blank, accommodationId: f.accommodationId, checkIn: f.checkIn, checkOut: f.checkOut }));
      },
    },
  );
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/rooms/${id}`), {
    invalidate,
    success: 'Room removed',
    onSuccess: () => undefined,
  });

  const startEdit = (room: RoomAssignmentDTO) => {
    setEditing(room);
    setForm({
      accommodationId: room.accommodationId,
      roomNumber: room.roomNumber,
      checkIn: room.checkIn ? toLocalDateTimeInput(room.checkIn, tz) : '',
      checkOut: room.checkOut ? toLocalDateTimeInput(room.checkOut, tz) : '',
      notes: room.notes ?? '',
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      rsvpId: target.rsvpId,
      accommodationId: form.accommodationId,
      roomNumber: form.roomNumber,
      checkIn: form.checkIn ? parseLocalDateTime(form.checkIn, tz).toISOString() : null,
      checkOut: form.checkOut ? parseLocalDateTime(form.checkOut, tz).toISOString() : null,
      notes: form.notes,
    };
    const parsed = roomAssignmentInputSchema.safeParse(body);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    save.mutate(body, { onError: (err) => setErrors(fieldErrors(err)) });
  };

  return (
    <Modal open onClose={onClose} title={`Rooms — ${target.guestName}`} wide>
      <p className="mb-4 text-sm text-ink-muted">
        Party of {target.numberOfGuests}. A party can hold several rooms, across different venues.
      </p>
      {rooms.length > 0 ? (
        <ul className="mb-5 divide-y divide-gold/15 border border-gold/25 bg-white/60">
          {rooms.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold">{r.accommodationName}</span> · Room {r.roomNumber}
                {(r.checkIn || r.checkOut) && (
                  <span className="block text-xs text-ink-muted">
                    {r.checkIn ? formatDateTime(r.checkIn, tz) : '—'} → {r.checkOut ? formatDateTime(r.checkOut, tz) : '—'}
                  </span>
                )}
              </span>
              <span className="flex gap-1">
                <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => startEdit(r)}>Edit</button>
                <ConfirmButton
                  className={`${btn.small} border border-maroon/40 text-maroon`}
                  confirmLabel="Sure?"
                  onConfirm={() => remove.mutate(r.id, { onSuccess: () => setRooms((prev) => prev.filter((x) => x.id !== r.id)) })}
                >
                  Remove
                </ConfirmButton>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 border border-dashed border-gold/40 px-3 py-3 text-sm text-ink-muted">No rooms allotted yet.</p>
      )}

      {isLoading ? (
        <LoadingBlock lines={3} />
      ) : !accommodations?.length ? (
        <p className="text-sm text-maroon">Add a room venue first in the “Rooms” tab (e.g. the hotel where rooms are blocked).</p>
      ) : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
          <p className="font-semibold sm:col-span-2">{editing ? `Edit room ${editing.roomNumber}` : 'Allot a room'}</p>
          <FieldRow label="Venue / hotel" htmlFor="rm-acc" error={errors.accommodationId}>
            <Select id="rm-acc" value={form.accommodationId} onChange={(e) => setForm({ ...form, accommodationId: e.target.value })}>
              <option value="">— Choose —</option>
              {accommodations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </FieldRow>
          <FieldRow label="Room number" htmlFor="rm-no" error={errors.roomNumber}>
            <TextInput id="rm-no" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. 204" />
          </FieldRow>
          <FieldRow label={`Check-in (${tz})`} htmlFor="rm-in" error={errors.checkIn}>
            <TextInput id="rm-in" type="datetime-local" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </FieldRow>
          <FieldRow label="Check-out" htmlFor="rm-out" error={errors.checkOut}>
            <TextInput id="rm-out" type="datetime-local" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </FieldRow>
          <div className="sm:col-span-2">
            <FieldRow label="Notes" htmlFor="rm-notes">
              <TextInput id="rm-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. extra bed, ground floor" />
            </FieldRow>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            {editing && <button type="button" className={btn.ghost} onClick={() => { setEditing(null); setForm(blank); }}>Cancel edit</button>}
            <button type="submit" className={btn.primary} disabled={save.isPending}>{editing ? 'Save room' : 'Allot room'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Hotels / venues and every allotted room, plus the parties still waiting for one. */
export function RoomBoard() {
  const tz = useWeddingTz();
  const { data, isLoading } = useRoomBoard();
  const [venue, setVenue] = useState<AccommodationDTO | 'new' | null>(null);
  const [target, setTarget] = useState<RoomTarget | null>(null);
  const [sideFilter, setSideFilter] = useState<GuestSide | 'ALL'>('ALL');
  const removeVenue = useAdminMutation((id: string) => api.del(`/api/admin/accommodations/${id}`), { invalidate, success: 'Venue deleted' });
  const removeRoom = useAdminMutation((id: string) => api.del(`/api/admin/rooms/${id}`), { invalidate, success: 'Room removed' });

  if (isLoading || !data) return <LoadingBlock lines={6} />;
  const matches = (s: GuestSide | null) => sideFilter === 'ALL' || s === sideFilter;
  const unassigned = data.unassigned.filter((u) => matches(u.side));
  const venues = data.accommodations.map((a) => ({ ...a, rooms: a.rooms.filter((r) => matches(r.side)) }));
  const totalRooms = venues.reduce((n, a) => n + a.rooms.length, 0);
  const countFor = (s: GuestSide | 'ALL') =>
    s === 'ALL' ? data.unassigned.length : data.unassigned.filter((u) => u.side === s).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by side">
          {(['ALL', 'BRIDE', 'GROOM'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sideFilter === s}
              onClick={() => setSideFilter(s)}
              className={sideFilter === s ? btn.primary : btn.secondary}
            >
              {s === 'ALL' ? 'All guests' : SIDE_LABELS[s]}
              <span className={`text-xs ${sideFilter === s ? 'text-gold-pale' : 'text-ink-muted'}`}>{countFor(s)} waiting</span>
            </button>
          ))}
        </div>
        <button type="button" className={btn.primary} onClick={() => setVenue('new')}>Add room venue</button>
      </div>
      <p className="text-sm text-ink-muted">
        {totalRooms} rooms allotted across {venues.length} venues · {unassigned.length} parties still need rooms
        {sideFilter !== 'ALL' && ` (${SIDE_LABELS[sideFilter]})`}
      </p>

      {unassigned.length > 0 && (
        <Card title={`Waiting for a room (${unassigned.length})`}>
          <ul className="flex flex-wrap gap-2">
            {unassigned.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="flex min-h-[40px] items-center gap-2 border border-gold/40 bg-white/70 px-3 text-sm hover:border-maroon"
                  onClick={() => setTarget({ rsvpId: u.id, guestName: u.guestName, numberOfGuests: u.numberOfGuests, rooms: [] })}
                >
                  <span className="font-semibold">{u.guestName}</span>
                  <span className="text-xs text-ink-muted">×{u.numberOfGuests}{u.side ? ` · ${SIDE_LABELS[u.side]}` : ''}</span>
                  <span className="text-xs text-maroon">Allot →</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {venues.length === 0 && (
        <p className="border border-dashed border-gold/40 px-4 py-6 text-center text-sm text-ink-muted">
          No room venues yet. Add the hotels or guest houses where rooms are held for guests.
        </p>
      )}

      {venues.map((a) => (
        <Card
          key={a.id}
          title={`${a.name} · ${a.rooms.length} rooms`}
          actions={
            <div className="flex gap-1">
              <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => setVenue(a)}>Edit venue</button>
              <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Delete venue & its rooms?" onConfirm={() => removeVenue.mutate(a.id)}>
                Delete
              </ConfirmButton>
            </div>
          }
        >
          {(a.address || a.contactPhone) && (
            <p className="mb-3 text-xs text-ink-muted">
              {[a.address, a.contactName, a.contactPhone].filter(Boolean).join(' · ')}
            </p>
          )}
          {a.rooms.length ? (
            <div className={tableCls.wrap}>
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    {['Room', 'Party', 'Side', 'Check-in → out', 'Notes', ''].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {a.rooms.map((r) => (
                    <tr key={r.id}>
                      <td className={`${tableCls.td} font-semibold`}>
                        {r.roomNumber}
                        {r.sharedWith && r.sharedWith.length > 0 && <span className="ml-1 text-xs font-normal text-maroon" title={`Shared with ${r.sharedWith.join(', ')}`}>shared</span>}
                      </td>
                      <td className={tableCls.td}>{r.guestName} <span className="text-xs text-ink-muted">×{r.numberOfGuests}</span></td>
                      <td className={`${tableCls.td} text-xs`}>{r.side ? SIDE_LABELS[r.side] : '—'}</td>
                      <td className={`${tableCls.td} whitespace-nowrap text-xs`}>
                        {r.checkIn ? formatDateTime(r.checkIn, tz) : '—'} → {r.checkOut ? formatDateTime(r.checkOut, tz) : '—'}
                      </td>
                      <td className={`${tableCls.td} text-xs`}>{r.notes ?? ''}</td>
                      <td className={tableCls.td}>
                        <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Sure?" onConfirm={() => removeRoom.mutate(r.id)}>
                          Remove
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No rooms allotted here yet.</p>
          )}
        </Card>
      ))}

      {venue && <AccommodationForm venue={venue === 'new' ? null : venue} onClose={() => setVenue(null)} />}
      {target && <RoomAssignModal target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

function AccommodationForm({ venue, onClose }: { venue: AccommodationDTO | null; onClose: () => void }) {
  const [form, setForm] = useState({
    name: venue?.name ?? '',
    address: venue?.address ?? '',
    mapsUrl: venue?.mapsUrl ?? '',
    contactName: venue?.contactName ?? '',
    contactPhone: venue?.contactPhone ?? '',
    notes: venue?.notes ?? '',
    displayOrder: venue?.displayOrder ?? 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation(
    (body: typeof form) => (venue ? api.put(`/api/admin/accommodations/${venue.id}`, body) : api.post('/api/admin/accommodations', body)),
    { invalidate, success: 'Room venue saved', onSuccess: onClose },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = accommodationInputSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    save.mutate(form, { onError: (err) => setErrors(fieldErrors(err)) });
  };
  const field = (k: keyof typeof form, label: string, multiline = false) => (
    <FieldRow label={label} htmlFor={`acc-${k}`} error={errors[k]}>
      {multiline ? (
        <TextArea id={`acc-${k}`} rows={2} value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      ) : (
        <TextInput id={`acc-${k}`} value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      )}
    </FieldRow>
  );
  return (
    <Modal open onClose={onClose} title={venue ? `Edit ${venue.name}` : 'New room venue'}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {field('name', 'Name (hotel / guest house / block)')}
        {field('address', 'Address', true)}
        {field('mapsUrl', 'Google Maps link')}
        <div className="grid gap-3 sm:grid-cols-2">
          {field('contactName', 'Contact person')}
          {field('contactPhone', 'Contact phone')}
        </div>
        {field('notes', 'Notes (e.g. rooms held, rates, check-in rules)', true)}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function RoomsSummary({ rooms }: { rooms: RoomAssignmentDTO[] }) {
  if (!rooms.length) return <StatusPill status="NO ROOM" />;
  return (
    <span className="block text-xs leading-snug">
      {rooms.map((r) => (
        <span key={r.id} className="block whitespace-nowrap">
          {r.accommodationName} · <span className="font-semibold">{r.roomNumber}</span>
        </span>
      ))}
    </span>
  );
}
