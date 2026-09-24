import { useMemo, useState, type FormEvent } from 'react';
import {
  formatInTz,
  formatTime,
  parseLocalDateTime,
  SIDE_LABELS,
  toLocalDateTimeInput,
  TRANSPORT_STATUS_LABELS,
  TRAVEL_MODE_LABELS,
  type ArrivalRowDTO,
  type StaffTravelInput,
  type TransportStatus,
  type TravelMode,
} from '@wedding/shared';
import { api } from '../../services/api';
import { useAdminMutation, useWeddingTz } from '../adminApi';
import { btn, Card, FieldRow, Modal, PageHeader, Select, StatusPill, TextArea, TextInput, Toggle } from '../components/ui';
import { staffKeys, telHref, useArrivals, waHref } from '../staffApi';

type Leg = 'arrival' | 'departure';
const STATUSES = Object.keys(TRANSPORT_STATUS_LABELS) as TransportStatus[];
const MODES = Object.keys(TRAVEL_MODE_LABELS) as TravelMode[];

/** Full payload for PUT /arrivals/:id from a row (the endpoint replaces the whole journey). */
function toInput(r: ArrivalRowDTO): StaffTravelInput {
  return {
    arrivalMode: r.arrivalMode,
    arrivalAt: r.arrivalAt,
    arrivalDetails: r.arrivalDetails,
    pickupNeeded: r.pickupNeeded,
    pickupStatus: r.pickupStatus,
    departureMode: r.departureMode,
    departureAt: r.departureAt,
    departureDetails: r.departureDetails,
    dropNeeded: r.dropNeeded,
    dropStatus: r.dropStatus,
    transportNotes: r.transportNotes ?? null,
  };
}

const statusTone = (s: TransportStatus) => (s === 'PENDING' ? 'PENDING' : s === 'NOT_NEEDED' ? 'HIDDEN' : 'APPROVED');

export default function ArrivalsPage() {
  const tz = useWeddingTz();
  const [leg, setLeg] = useState<Leg>('arrival');
  const [q, setQ] = useState('');
  const [needsTransport, setNeedsTransport] = useState(false);
  const [editing, setEditing] = useState<ArrivalRowDTO | null>(null);
  const list = useArrivals({ q: q.trim() || undefined, needsTransport });

  const groups = useMemo(() => {
    const at = (r: ArrivalRowDTO) => (leg === 'arrival' ? r.arrivalAt : r.departureAt);
    const rows = [...(list.data ?? [])].sort((a, b) => (Date.parse(at(a) ?? '') || Infinity) - (Date.parse(at(b) ?? '') || Infinity));
    const out = new Map<string, ArrivalRowDTO[]>();
    for (const r of rows) {
      const t = at(r);
      const label = t ? formatInTz(t, tz, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Time not shared yet';
      out.set(label, [...(out.get(label) ?? []), r]);
    }
    return [...out.entries()];
  }, [list.data, leg, tz]);

  const summary = useMemo(() => {
    const rows = list.data ?? [];
    const key = leg === 'arrival' ? 'pickup' : 'drop';
    const needed = rows.filter((r) => (key === 'pickup' ? r.pickupNeeded : r.dropNeeded));
    return {
      shared: rows.filter((r) => (leg === 'arrival' ? r.arrivalAt || r.arrivalMode : r.departureAt || r.departureMode)).length,
      total: rows.length,
      needed: needed.length,
      toArrange: needed.filter((r) => (key === 'pickup' ? r.pickupStatus : r.dropStatus) === 'PENDING').length,
    };
  }, [list.data, leg]);

  return (
    <>
      <PageHeader title="Arrivals & pickups" description="Every family’s journey in one place. Guests fill this in from their guest pass; you can edit it too." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['arrival', 'Arrivals'],
            ['departure', 'Departures'],
          ] as [Leg, string][]
        ).map(([l, label]) => (
          <button key={l} type="button" onClick={() => setLeg(l)} className={`${btn.small} border px-3 ${leg === l ? 'border-maroon bg-maroon text-ivory' : 'border-gold/50 bg-white text-ink-soft'}`} aria-pressed={leg === l}>
            {label}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-maroon" checked={needsTransport} onChange={(e) => setNeedsTransport(e.target.checked)} />
          Needs pickup / drop only
        </label>
        <TextInput className="ml-auto max-w-xs" type="search" placeholder="Search name, phone, details" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wider text-ink-soft">Journeys shared</p>
          <p className="font-display text-3xl text-maroon">
            {summary.shared} / {summary.total}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-ink-soft">{leg === 'arrival' ? 'Pickups' : 'Drops'} requested</p>
          <p className="font-display text-3xl text-maroon">{summary.needed}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-ink-soft">Still to arrange</p>
          <p className={`font-display text-3xl ${summary.toArrange ? 'text-amber-700' : 'text-maroon'}`}>{summary.toArrange}</p>
        </Card>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : !groups.length ? (
        <Card>
          <p className="py-6 text-center text-sm text-ink-muted">No families match.</p>
        </Card>
      ) : (
        groups.map(([label, rows]) => (
          <section key={label} className="mb-6">
            <h2 className="mb-2 font-display text-xl text-maroon">{label}</h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {rows.map((r) => (
                <JourneyCard key={r.rsvpId} row={r} leg={leg} tz={tz} onEdit={() => setEditing(r)} />
              ))}
            </ul>
          </section>
        ))
      )}

      {editing && <EditJourneyModal row={editing} tz={tz} onClose={() => setEditing(null)} />}
    </>
  );
}

function JourneyCard({ row, leg, tz, onEdit }: { row: ArrivalRowDTO; leg: Leg; tz: string; onEdit: () => void }) {
  const isArrival = leg === 'arrival';
  const mode = isArrival ? row.arrivalMode : row.departureMode;
  const at = isArrival ? row.arrivalAt : row.departureAt;
  const details = isArrival ? row.arrivalDetails : row.departureDetails;
  const needed = isArrival ? row.pickupNeeded : row.dropNeeded;
  const status = isArrival ? row.pickupStatus : row.dropStatus;
  const setStatus = useAdminMutation(
    (s: TransportStatus) => api.put(`/api/admin/arrivals/${row.rsvpId}`, { ...toInput(row), [isArrival ? 'pickupStatus' : 'dropStatus']: s }),
    { invalidate: [staffKeys.arrivalsAll], success: 'Updated' },
  );

  return (
    <li className={`border bg-white/80 px-4 py-4 ${needed && status === 'PENDING' ? 'border-amber-200' : 'border-gold/30'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-xl text-maroon">{row.guestName}</p>
          <p className="text-xs text-ink-muted">
            Party of {row.numberOfGuests}
            {row.side && <> · {SIDE_LABELS[row.side]}</>}
            {row.rooms.length > 0 ? <> · Room {row.rooms.map((x) => `${x.roomNumber} (${x.accommodationName})`).join(', ')}</> : <> · No room yet</>}
          </p>
        </div>
        <div className="flex gap-1">
          <a href={telHref(row.phone)} className={`${btn.small} border border-gold/50`}>
            Call
          </a>
          <a href={waHref(row.phone)} target="_blank" rel="noopener noreferrer" className={`${btn.small} border border-gold/50`}>
            WhatsApp
          </a>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink">
        <strong>{at ? formatTime(at, tz) : '—'}</strong> · {mode ? TRAVEL_MODE_LABELS[mode] : 'Mode not shared'}
        {details && <span className="text-ink-soft"> · {details}</span>}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {needed ? (
          <>
            <span className="text-sm text-ink-soft">{isArrival ? 'Pickup' : 'Drop'}:</span>
            <Select aria-label={`${isArrival ? 'Pickup' : 'Drop'} status`} className="!min-h-[36px] w-auto" value={status} onChange={(e) => setStatus.mutate(e.target.value as TransportStatus)} disabled={setStatus.isPending}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TRANSPORT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <StatusPill status={statusTone(status)} />
          </>
        ) : (
          <span className="text-sm text-ink-muted">No {isArrival ? 'pickup' : 'drop'} needed</span>
        )}
        <button type="button" className={`${btn.small} ml-auto border border-gold/50`} onClick={onEdit}>
          Edit
        </button>
      </div>
      {row.transportNotes && <p className="mt-2 border-t border-gold/15 pt-2 text-xs text-ink-soft">📝 {row.transportNotes}</p>}
    </li>
  );
}

function EditJourneyModal({ row, tz, onClose }: { row: ArrivalRowDTO; tz: string; onClose: () => void }) {
  const toLocal = (iso: string | null) => (iso ? toLocalDateTimeInput(iso, tz) : '');
  const [form, setForm] = useState({
    ...toInput(row),
    arrivalAt: toLocal(row.arrivalAt),
    departureAt: toLocal(row.departureAt),
  });
  const save = useAdminMutation(
    () =>
      api.put(`/api/admin/arrivals/${row.rsvpId}`, {
        ...form,
        arrivalMode: form.arrivalMode || null,
        departureMode: form.departureMode || null,
        arrivalAt: form.arrivalAt ? parseLocalDateTime(form.arrivalAt, tz).toISOString() : null,
        departureAt: form.departureAt ? parseLocalDateTime(form.departureAt, tz).toISOString() : null,
      }),
    { invalidate: [staffKeys.arrivalsAll], success: 'Journey saved', onSuccess: onClose },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const leg = (prefix: 'arrival' | 'departure') => {
    const isA = prefix === 'arrival';
    return (
      <fieldset className="space-y-3 border border-gold/25 p-4">
        <legend className="px-1 font-display text-lg text-maroon">{isA ? 'Arrival' : 'Departure'}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Mode" htmlFor={`${prefix}-m`}>
            <Select id={`${prefix}-m`} value={(isA ? form.arrivalMode : form.departureMode) ?? ''} onChange={(e) => set(isA ? { arrivalMode: (e.target.value || null) as TravelMode | null } : { departureMode: (e.target.value || null) as TravelMode | null })}>
              <option value="">—</option>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {TRAVEL_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="Date & time" htmlFor={`${prefix}-t`}>
            <TextInput id={`${prefix}-t`} type="datetime-local" value={(isA ? form.arrivalAt : form.departureAt) ?? ''} onChange={(e) => set(isA ? { arrivalAt: e.target.value } : { departureAt: e.target.value })} />
          </FieldRow>
        </div>
        <FieldRow label="Details (train / flight / station)" htmlFor={`${prefix}-d`}>
          <TextInput id={`${prefix}-d`} maxLength={300} value={(isA ? form.arrivalDetails : form.departureDetails) ?? ''} onChange={(e) => set(isA ? { arrivalDetails: e.target.value } : { departureDetails: e.target.value })} />
        </FieldRow>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle label={isA ? 'Pickup needed' : 'Drop needed'} checked={!!(isA ? form.pickupNeeded : form.dropNeeded)} onChange={(v) => set(isA ? { pickupNeeded: v } : { dropNeeded: v })} />
          <Select aria-label="Status" className="w-auto" value={isA ? form.pickupStatus : form.dropStatus} onChange={(e) => set(isA ? { pickupStatus: e.target.value as TransportStatus } : { dropStatus: e.target.value as TransportStatus })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {TRANSPORT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </fieldset>
    );
  };

  return (
    <Modal open onClose={onClose} title={row.guestName} wide>
      <form onSubmit={submit} className="space-y-4">
        {leg('arrival')}
        {leg('departure')}
        <FieldRow label="Hospitality notes (driver, vehicle — not shown to the guest)" htmlFor="t-notes">
          <TextArea id="t-notes" rows={3} maxLength={1000} value={form.transportNotes ?? ''} onChange={(e) => set({ transportNotes: e.target.value })} />
        </FieldRow>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
