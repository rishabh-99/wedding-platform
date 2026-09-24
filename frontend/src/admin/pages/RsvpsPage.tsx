import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ATTENDANCE_LABELS,
  SIDE_LABELS,
  formatDateTime,
  rsvpAdminUpdateSchema,
  type AttendanceStatus,
  type GuestSide,
  type RsvpDTO,
  type SessionUser,
  can,
} from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { useAccommodations, useAdminEvents, useAdminMutation, useAdminRsvps, useDashboard, useWeddingTz } from '../adminApi';
import { RoomAssignModal, RoomBoard, RoomsSummary, type RoomTarget } from '../components/Rooms';
import { btn, ConfirmButton, EmptyRow, FieldRow, Modal, PageHeader, Select, Stat, StatusPill, TextArea, TextInput, fieldErrors, tableCls } from '../components/ui';

const invalidate = [['admin', 'rsvps'], ['admin', 'rooms']];

export default function RsvpsPage({ user }: { user: SessionUser }) {
  const [params, setParams] = useSearchParams();
  const canRooms = can(user.role, 'rooms');
  const canEdit = can(user.role, 'guestsEdit');
  const tab = canRooms && params.get('tab') === 'rooms' ? 'rooms' : 'guests';
  const { data: dash } = useDashboard();

  return (
    <div>
      <PageHeader
        title="RSVPs & rooms"
        description="Every response, whose side guests are from, and room allotment for the hospitality team."
        actions={
          <a href="/api/admin/rsvps/export.xlsx" className={btn.primary} download>
            Download RSVP Excel
          </a>
        }
      />

      {dash && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Responses" value={dash.counts.rsvps} hint={`${dash.counts.declined} declined`} />
          <Stat label="Total guests" value={dash.counts.totalGuests} hint={`${dash.counts.confirmedGuests} confirmed · ${dash.counts.maybeGuests} maybe`} />
          {(['BRIDE', 'GROOM'] as GuestSide[]).map((s) => {
            const row = dash.sides.find((x) => x.side === s);
            return <Stat key={s} label={SIDE_LABELS[s]} value={row?.guests ?? 0} hint={`${row?.responses ?? 0} responses`} />;
          })}
          <Stat label="Rooms allotted" value={dash.rooms.assigned} />
          <Stat label="Need rooms" value={dash.rooms.partiesNeedingRooms} hint="parties attending without a room" accent={dash.rooms.partiesNeedingRooms > 0} />
        </div>
      )}

      {canRooms && (
      <div className="mb-5 flex gap-2" role="tablist" aria-label="RSVP views">
        <button type="button" role="tab" aria-selected={tab === 'guests'} className={tab === 'guests' ? btn.primary : btn.secondary} onClick={() => setParams({})}>
          Guests
        </button>
        <button type="button" role="tab" aria-selected={tab === 'rooms'} className={tab === 'rooms' ? btn.primary : btn.secondary} onClick={() => setParams({ tab: 'rooms' })}>
          Rooms
        </button>
      </div>
      )}

      {tab === 'rooms' ? <RoomBoard /> : <GuestList canRooms={canRooms} canEdit={canEdit} />}
    </div>
  );
}

function GuestList({ canRooms, canEdit }: { canRooms: boolean; canEdit: boolean }) {
  const tz = useWeddingTz();
  const { data: events } = useAdminEvents();
  const { data: accommodations } = useAccommodations();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState('');
  const [side, setSide] = useState('');
  const [eventId, setEventId] = useState('');
  const [room, setRoom] = useState('');
  const [sort, setSort] = useState('submittedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<RsvpDTO | null>(null);
  const [roomTarget, setRoomTarget] = useState<RoomTarget | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [debouncedQ, status, side, eventId, room, sort, order]);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    side: side || undefined,
    eventId: eventId || undefined,
    needsRoom: room === 'none' ? 'true' : undefined,
    accommodationId: room && room !== 'none' ? room : undefined,
    sort,
    order,
    page,
    pageSize: 50,
  };
  const { data, isLoading, isFetching } = useAdminRsvps(params);
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/rsvps/${id}`), { invalidate, success: 'RSVP deleted' });

  const sortBy = (key: string) => {
    if (sort === key) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder(key === 'guestName' ? 'asc' : 'desc');
    }
  };
  const sortIcon = (key: string) => (sort === key ? (order === 'asc' ? ' ↑' : ' ↓') : '');
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const pageGuests = (data?.items ?? []).reduce((s, r) => s + r.numberOfGuests, 0);

  return (
    <>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <TextInput type="search" placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search RSVPs" className="xl:col-span-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by attendance">
          <option value="">All responses</option>
          {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((s) => <option key={s} value={s}>{ATTENDANCE_LABELS[s]}</option>)}
        </Select>
        <Select value={side} onChange={(e) => setSide(e.target.value)} aria-label="Filter by side">
          <option value="">Both sides</option>
          {(Object.keys(SIDE_LABELS) as GuestSide[]).map((s) => <option key={s} value={s}>{SIDE_LABELS[s]}</option>)}
        </Select>
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Filter by celebration">
          <option value="">All celebrations</option>
          {(events ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <Select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Filter by room">
          <option value="">Any room status</option>
          <option value="none">Needs a room</option>
          {(accommodations ?? []).map((a) => <option key={a.id} value={a.id}>Staying at {a.name}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <LoadingBlock lines={8} />
      ) : (
        <>
          <div className={`${tableCls.wrap} ${isFetching ? 'opacity-70' : ''}`}>
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}><button type="button" onClick={() => sortBy('guestName')}>Guest{sortIcon('guestName')}</button></th>
                  <th className={tableCls.th}>Side</th>
                  <th className={tableCls.th}>Contact</th>
                  <th className={tableCls.th}><button type="button" onClick={() => sortBy('numberOfGuests')}>Guests{sortIcon('numberOfGuests')}</button></th>
                  <th className={tableCls.th}><button type="button" onClick={() => sortBy('attendanceStatus')}>Status{sortIcon('attendanceStatus')}</button></th>
                  <th className={tableCls.th}>Rooms</th>
                  <th className={tableCls.th}>Celebrations</th>
                  <th className={tableCls.th}><button type="button" onClick={() => sortBy('submittedAt')}>Submitted{sortIcon('submittedAt')}</button></th>
                  <th className={tableCls.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!data?.items.length && <EmptyRow colSpan={9}>No RSVPs match these filters.</EmptyRow>}
                {data?.items.map((r) => (
                  <tr key={r.id}>
                    <td className={tableCls.td}>
                      <p className="font-semibold">{r.guestName}</p>
                      {r.message && <p className="mt-1 max-w-[16rem] text-xs italic text-ink-muted">“{r.message}”</p>}
                    </td>
                    <td className={tableCls.td}>{r.side ? <StatusPill status={r.side} /> : <span className="text-xs text-ink-muted">—</span>}</td>
                    <td className={`${tableCls.td} whitespace-nowrap text-xs`}>
                      <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="block">{r.phone}</a>
                      {r.email && <a href={`mailto:${r.email}`} className="block text-ink-muted">{r.email}</a>}
                    </td>
                    <td className={`${tableCls.td} tabular-nums`}>{r.numberOfGuests}</td>
                    <td className={tableCls.td}><StatusPill status={r.attendanceStatus} /></td>
                    <td className={tableCls.td}>
                      {!canRooms ? (
                        <RoomsSummary rooms={r.rooms} />
                      ) : r.attendanceStatus === 'DECLINED' && !r.rooms.length ? (
                        <span className="text-xs text-ink-muted">—</span>
                      ) : (
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => setRoomTarget({ rsvpId: r.id, guestName: r.guestName, numberOfGuests: r.numberOfGuests, rooms: r.rooms })}
                          aria-label={`Manage rooms for ${r.guestName}`}
                        >
                          <RoomsSummary rooms={r.rooms} />
                        </button>
                      )}
                    </td>
                    <td className={`${tableCls.td} min-w-[10rem] text-xs`}>{r.events.map((e) => e.name).join(', ') || '—'}</td>
                    <td className={`${tableCls.td} whitespace-nowrap text-xs`}>{formatDateTime(r.submittedAt, tz)}</td>
                    <td className={tableCls.td}>
                      <div className="flex flex-wrap gap-1">
                        {!canRooms && !canEdit && <a href={`tel:${r.phone.replace(/s/g, '')}`} className={`${btn.small} border border-gold/40`}>Call</a>}
                        {canRooms && <button
                          type="button"
                          className={`${btn.small} border border-gold/40`}
                          onClick={() => setRoomTarget({ rsvpId: r.id, guestName: r.guestName, numberOfGuests: r.numberOfGuests, rooms: r.rooms })}
                        >
                          Rooms
                        </button>}
                        {canEdit && <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => setEditing(r)}>Edit</button>}
                        {canEdit && <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Sure?" onConfirm={() => remove.mutate(r.id)}>Delete</ConfirmButton>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
            <span>
              {data?.total ?? 0} RSVPs · {pageGuests} guests on this page
            </span>
            <span className="flex items-center gap-2">
              <button type="button" className={btn.secondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              Page {page} of {pages}
              <button type="button" className={btn.secondary} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          </div>
        </>
      )}
      {editing && <RsvpEditForm rsvp={editing} onClose={() => setEditing(null)} />}
      {roomTarget && <RoomAssignModal target={roomTarget} onClose={() => setRoomTarget(null)} />}
    </>
  );
}

function RsvpEditForm({ rsvp, onClose }: { rsvp: RsvpDTO; onClose: () => void }) {
  const { data: events } = useAdminEvents();
  const [form, setForm] = useState({
    guestName: rsvp.guestName,
    phone: rsvp.phone,
    email: rsvp.email ?? '',
    numberOfGuests: rsvp.numberOfGuests,
    side: (rsvp.side ?? '') as GuestSide | '',
    attendanceStatus: rsvp.attendanceStatus,
    eventIds: rsvp.events.map((e) => e.id),
    message: rsvp.message ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation((input: Record<string, unknown>) => api.put(`/api/admin/rsvps/${rsvp.id}`, input), { invalidate, success: 'RSVP updated', onSuccess: onClose });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = { ...form, side: form.side || null };
    const parsed = rsvpAdminUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    save.mutate(body, { onError: (err) => setErrors(fieldErrors(err)) });
  };
  return (
    <Modal open onClose={onClose} title={`Edit RSVP — ${rsvp.guestName}`} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <FieldRow label="Name" error={errors.guestName} htmlFor="r-name"><TextInput id="r-name" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} /></FieldRow>
        <FieldRow label="Phone" error={errors.phone} htmlFor="r-phone"><TextInput id="r-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FieldRow>
        <FieldRow label="Email" error={errors.email} htmlFor="r-email"><TextInput id="r-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FieldRow>
        <FieldRow label="Guests" error={errors.numberOfGuests} htmlFor="r-n"><TextInput id="r-n" type="number" min={0} value={form.numberOfGuests} onChange={(e) => setForm({ ...form, numberOfGuests: Number(e.target.value) })} /></FieldRow>
        <FieldRow label="Side" htmlFor="r-side" error={errors.side}>
          <Select id="r-side" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as GuestSide | '' })}>
            <option value="">— Not specified —</option>
            {(Object.keys(SIDE_LABELS) as GuestSide[]).map((s) => <option key={s} value={s}>{SIDE_LABELS[s]}</option>)}
          </Select>
        </FieldRow>
        <FieldRow label="Attendance" htmlFor="r-status">
          <Select id="r-status" value={form.attendanceStatus} onChange={(e) => setForm({ ...form, attendanceStatus: e.target.value as AttendanceStatus })}>
            {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((s) => <option key={s} value={s}>{ATTENDANCE_LABELS[s]}</option>)}
          </Select>
        </FieldRow>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">Celebrations</legend>
          <div className="grid gap-1 sm:grid-cols-3">
            {(events ?? []).map((ev) => (
              <label key={ev.id} className="flex min-h-[36px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-maroon"
                  checked={form.eventIds.includes(ev.id)}
                  onChange={(e) => setForm({ ...form, eventIds: e.target.checked ? [...form.eventIds, ev.id] : form.eventIds.filter((x) => x !== ev.id) })}
                />
                {ev.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <FieldRow label="Message" htmlFor="r-msg"><TextArea id="r-msg" rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></FieldRow>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>Save RSVP</button>
        </div>
      </form>
    </Modal>
  );
}
