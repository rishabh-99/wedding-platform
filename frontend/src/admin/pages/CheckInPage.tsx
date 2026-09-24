import { useMemo, useState } from 'react';
import {
  FOLLOW_UP_LABELS,
  formatTime,
  SIDE_LABELS,
  type CheckInRowDTO,
  type FollowUpStatus,
  type StaffGuestCardDTO,
} from '@wedding/shared';
import { api } from '../../services/api';
import { useAdminEvents, useAdminMutation, useWeddingTz } from '../adminApi';
import { QrScannerModal } from '../components/QrScanner';
import { useToast } from '../components/Toast';
import { btn, Card, Modal, PageHeader, Select, Stat, StatusPill, TextInput } from '../components/ui';
import { fetchPass, staffKeys, telHref, tokenFromScan, useCheckInBoard, waHref } from '../staffApi';

type Filter = 'waiting' | 'call' | 'arrived' | 'all';

/** Still unaccounted for: not arrived and nobody has confirmed they're coming or not. */
const needsCall = (r: CheckInRowDTO) => !r.checkIn && (!r.followUp || r.followUp.status === 'NEEDS_CALL' || r.followUp.status === 'NOT_REACHABLE');

function Stepper({ value, onChange, max = 50 }: { value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="inline-flex items-center border border-gold/50 bg-white">
      <button type="button" className="h-10 w-10 text-lg text-maroon disabled:opacity-40" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="One fewer">
        −
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className="h-10 w-10 text-lg text-maroon disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One more">
        +
      </button>
    </div>
  );
}

export default function CheckInPage() {
  const tz = useWeddingTz();
  const events = useAdminEvents();
  const [eventId, setEventId] = useState<string | undefined>();
  const board = useCheckInBoard(eventId);
  const [filter, setFilter] = useState<Filter>('waiting');
  const [q, setQ] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<StaffGuestCardDTO | null>(null);
  const toast = useToast();

  const data = board.data;
  const activeEventId = data?.event.id;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (needle && !`${r.guestName} ${r.phone} ${r.rooms.map((x) => x.roomNumber).join(' ')}`.toLowerCase().includes(needle)) return false;
      if (filter === 'waiting') return !r.checkIn;
      if (filter === 'arrived') return !!r.checkIn;
      if (filter === 'call') return needsCall(r);
      return true;
    });
  }, [data, filter, q]);

  const counts = useMemo(
    () => ({
      waiting: data?.rows.filter((r) => !r.checkIn).length ?? 0,
      call: data?.rows.filter(needsCall).length ?? 0,
      arrived: data?.rows.filter((r) => r.checkIn).length ?? 0,
      all: data?.rows.length ?? 0,
    }),
    [data],
  );

  const onScan = async (value: string) => {
    try {
      const card = await fetchPass(tokenFromScan(value));
      setScanOpen(false);
      setScanned(card);
    } catch {
      toast.show('That QR code isn’t a guest pass for this wedding', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Check-in"
        description="Mark families as they arrive, and see who still needs a call."
        actions={
          <button type="button" className={btn.primary} onClick={() => setScanOpen(true)}>
            Scan pass
          </button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select aria-label="Celebration" value={activeEventId ?? ''} onChange={(e) => setEventId(e.target.value || undefined)}>
          {(events.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        {data && (
          <p className="self-center text-sm text-ink-muted">
            Starts {formatTime(data.event.startDateTime, tz)} · refreshes automatically
          </p>
        )}
      </div>

      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat accent label="Families arrived" value={`${data.arrivedParties} / ${data.expectedParties}`} />
          <Stat label="Guests arrived" value={`${data.arrivedGuests} / ${data.expectedGuests}`} />
          <Stat label="Not arrived yet" value={counts.waiting} />
          <Stat label="To call" value={counts.call} hint="Not arrived, not yet reached" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['waiting', 'Not arrived'],
            ['call', 'To call'],
            ['arrived', 'Arrived'],
            ['all', 'All'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`${btn.small} border ${filter === f ? 'border-maroon bg-maroon text-ivory' : 'border-gold/50 bg-white text-ink-soft'}`} aria-pressed={filter === f}>
            {label} · {counts[f]}
          </button>
        ))}
        <TextInput className="ml-auto max-w-xs" type="search" placeholder="Search name, phone, room" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search guests" />
      </div>

      {board.isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : !rows.length ? (
        <Card>
          <p className="py-6 text-center text-sm text-ink-muted">{filter === 'waiting' && counts.all ? 'Everyone has arrived 🎉' : 'No guests match.'}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => activeEventId && <GuestRow key={r.rsvpId} row={r} eventId={activeEventId} tz={tz} />)}
        </ul>
      )}

      <QrScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />
      {scanned && activeEventId && (
        <ScannedModal
          card={scanned}
          eventId={activeEventId}
          eventName={data?.event.name ?? ''}
          onClose={() => setScanned(null)}
          onNext={() => {
            setScanned(null);
            setScanOpen(true);
          }}
        />
      )}
    </>
  );
}

function GuestRow({ row, eventId, tz }: { row: CheckInRowDTO; eventId: string; tz: string }) {
  const [count, setCount] = useState(row.numberOfGuests);
  const [note, setNote] = useState(row.followUp?.note ?? '');
  const invalidate = [staffKeys.checkinAll];
  const checkIn = useAdminMutation(() => api.post('/api/admin/checkin', { rsvpId: row.rsvpId, eventId, count, method: 'MANUAL' }), {
    invalidate,
    success: `${row.guestName} checked in`,
  });
  const undo = useAdminMutation(() => api.del(`/api/admin/checkin/${row.rsvpId}/${eventId}`), { invalidate, success: 'Check-in removed' });
  const followUp = useAdminMutation((status: FollowUpStatus) => api.put('/api/admin/followup', { rsvpId: row.rsvpId, eventId, status, note }), {
    invalidate,
    success: 'Saved',
  });

  return (
    <li className={`border bg-white/80 px-4 py-4 ${row.checkIn ? 'border-emerald-200' : needsCall(row) ? 'border-amber-200' : 'border-gold/30'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-xl text-maroon">{row.guestName}</p>
          <p className="text-xs text-ink-muted">
            Party of {row.numberOfGuests}
            {row.side && <> · {SIDE_LABELS[row.side]}</>}
            {row.rooms.length > 0 && <> · Room {row.rooms.map((x) => x.roomNumber).join(', ')}</>}
          </p>
        </div>
        <div className="flex gap-1">
          <a href={telHref(row.phone)} className={`${btn.small} border border-gold/50`} aria-label={`Call ${row.guestName}`}>
            Call
          </a>
          <a href={waHref(row.phone)} target="_blank" rel="noopener noreferrer" className={`${btn.small} border border-gold/50`} aria-label={`WhatsApp ${row.guestName}`}>
            WhatsApp
          </a>
        </div>
      </div>

      {row.checkIn ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-emerald-800">
            ✓ {row.checkIn.count} arrived at {formatTime(row.checkIn.checkedInAt, tz)}
            {row.checkIn.by && <span className="text-ink-muted"> · {row.checkIn.by}</span>}
            {row.checkIn.method === 'QR' && <span className="text-ink-muted"> · QR</span>}
          </p>
          <button type="button" className={`${btn.small} text-ink-muted hover:text-maroon`} onClick={() => undo.mutate(undefined)} disabled={undo.isPending}>
            Undo
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Stepper value={count} onChange={setCount} />
            <button type="button" className={btn.primary} onClick={() => checkIn.mutate(undefined)} disabled={checkIn.isPending}>
              Check in {count}
            </button>
          </div>
          <div className="mt-3 grid gap-2 border-t border-gold/15 pt-3 sm:grid-cols-[auto_1fr]">
            <Select aria-label="Follow-up" value={row.followUp?.status ?? ''} onChange={(e) => e.target.value && followUp.mutate(e.target.value as FollowUpStatus)}>
              <option value="">Follow-up…</option>
              {(Object.keys(FOLLOW_UP_LABELS) as FollowUpStatus[]).map((s) => (
                <option key={s} value={s}>
                  {FOLLOW_UP_LABELS[s]}
                </option>
              ))}
            </Select>
            <TextInput
              aria-label="Note"
              placeholder="Note (e.g. 20 min away)"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => row.followUp && note !== (row.followUp.note ?? '') && followUp.mutate(row.followUp.status)}
            />
          </div>
          {row.followUp && (
            <p className="mt-2 text-xs text-ink-muted">
              <StatusPill status={FOLLOW_UP_LABELS[row.followUp.status].toUpperCase()} /> {row.followUp.by && `by ${row.followUp.by}`} at {formatTime(row.followUp.updatedAt, tz)}
            </p>
          )}
        </>
      )}
    </li>
  );
}

function ScannedModal({ card, eventId, eventName, onClose, onNext }: { card: StaffGuestCardDTO; eventId: string; eventName: string; onClose: () => void; onNext: () => void }) {
  const existing = card.events.find((e) => e.id === eventId)?.checkedIn ?? null;
  const invited = card.events.some((e) => e.id === eventId);
  const [count, setCount] = useState(existing ?? card.numberOfGuests);
  const [done, setDone] = useState(false);
  const save = useAdminMutation(() => api.post('/api/admin/checkin', { token: card.qrToken, eventId, count, method: 'QR' }), {
    invalidate: [staffKeys.checkinAll],
    success: `${card.guestName} checked in`,
    onSuccess: () => setDone(true),
  });
  return (
    <Modal open onClose={onClose} title={card.guestName}>
      <p className="text-sm text-ink-soft">
        Party of {card.numberOfGuests}
        {card.side && <> · {SIDE_LABELS[card.side]}</>}
        {card.rooms.length > 0 && <> · Room {card.rooms.map((r) => `${r.roomNumber} (${r.accommodationName})`).join(', ')}</>}
      </p>
      {!invited && <p className="mt-3 rounded-sm bg-amber-50 px-3 py-2 text-sm text-amber-900">Not on the RSVP list for {eventName} — you can still check them in.</p>}
      {existing && !done && <p className="mt-3 rounded-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Already checked in ({existing}). Saving again updates the count.</p>}
      {done ? (
        <p className="mt-4 text-lg text-emerald-800">✓ {count} checked in for {eventName}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-soft">How many arrived?</span>
          <Stepper value={count} onChange={setCount} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {done ? (
          <>
            <button type="button" className={btn.secondary} onClick={onClose}>
              Close
            </button>
            <button type="button" className={btn.primary} onClick={onNext}>
              Scan next
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btn.ghost} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={btn.primary} onClick={() => save.mutate(undefined)} disabled={save.isPending}>
              Check in {count}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
