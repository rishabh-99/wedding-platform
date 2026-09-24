import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatTime, SIDE_LABELS, type PortraitRowDTO, type StaffGuestCardDTO } from '@wedding/shared';
import { api, uploadWithProgress } from '../../services/api';
import { MediaImage } from '../../components/gallery/MediaImage';
import { useWeddingTz } from '../adminApi';
import { QrScannerModal } from '../components/QrScanner';
import { useToast } from '../components/Toast';
import { btn, Card, ConfirmButton, Modal, PageHeader, TextInput } from '../components/ui';
import { fetchPass, staffKeys, tokenFromScan, usePortraitBoard } from '../staffApi';

type Filter = 'missing' | 'done' | 'all';
type Target = { rsvpId?: string; token?: string; method: 'QR' | 'MANUAL' };

/** Save (or tick) a family's photo of the day, with an optional image file. */
function useSavePortrait(day: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (target: Target, name: string, file?: File) => {
    const key = target.rsvpId ?? target.token ?? '';
    setBusy(key);
    try {
      const form = new FormData();
      if (target.rsvpId) form.append('rsvpId', target.rsvpId);
      if (target.token) form.append('token', target.token);
      form.append('day', day);
      form.append('method', target.method);
      if (file) form.append('photo', file);
      await uploadWithProgress('/api/admin/portraits', form);
      toast.show(file ? `Photo saved for ${name}` : `${name} marked as covered`, 'success');
      await qc.invalidateQueries({ queryKey: staffKeys.portraitsAll });
      return true;
    } catch (err) {
      toast.show((err as Error).message, 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { save, busy };
}

/** A hidden camera input: on phones `capture` opens the rear camera straight away. */
function CameraButton({ onFile, label, className = btn.primary, disabled }: { onFile: (f: File) => void; label: string; className?: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <button type="button" className={className} onClick={() => ref.current?.click()} disabled={disabled}>
        {label}
      </button>
    </>
  );
}

export default function PortraitsPage() {
  const tz = useWeddingTz();
  const [day, setDay] = useState<string | undefined>();
  const board = usePortraitBoard(day);
  const data = board.data;
  const activeDay = data?.day ?? '';
  const [filter, setFilter] = useState<Filter>('missing');
  const [q, setQ] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<StaffGuestCardDTO | null>(null);
  const toast = useToast();
  const { save, busy } = useSavePortrait(activeDay);
  const qc = useQueryClient();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (needle && !`${r.guestName} ${r.phone}`.toLowerCase().includes(needle)) return false;
      if (filter === 'missing') return !r.portrait;
      if (filter === 'done') return !!r.portrait;
      return true;
    });
  }, [data, filter, q]);

  const pct = data && data.total ? Math.round((data.covered / data.total) * 100) : 0;

  const onScan = async (value: string) => {
    try {
      const card = await fetchPass(tokenFromScan(value));
      setScanOpen(false);
      setScanned(card);
    } catch {
      toast.show('That QR code isn’t a guest pass for this wedding', 'error');
    }
  };

  const remove = async (row: PortraitRowDTO) => {
    try {
      await api.del(`/api/admin/portraits/${row.rsvpId}/${activeDay}`);
      toast.show('Removed', 'success');
      await qc.invalidateQueries({ queryKey: staffKeys.portraitsAll });
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Photo of the day"
        description="One photograph of every family, each day. Scan their pass (or find them below), take the photo — they’ll see it on their guest pass after the wedding."
        actions={
          <button type="button" className={btn.primary} onClick={() => setScanOpen(true)}>
            Scan pass
          </button>
        }
      />

      {data && (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Day">
            {data.days.map((d) => (
              <button
                key={d.day}
                type="button"
                role="tab"
                aria-selected={d.day === activeDay}
                onClick={() => setDay(d.day)}
                className={`${btn.small} border px-3 ${d.day === activeDay ? 'border-maroon bg-maroon text-ivory' : 'border-gold/50 bg-white text-ink-soft'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Card className="mb-5">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-2xl text-maroon">
                {data.covered} of {data.total} families covered
              </p>
              <p className="text-sm text-ink-muted">{pct}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ivory-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-maroon transition-all" style={{ width: `${pct}%` }} />
            </div>
          </Card>
        </>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['missing', 'Still to photograph'],
            ['done', 'Done'],
            ['all', 'All'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`${btn.small} border ${filter === f ? 'border-maroon bg-maroon text-ivory' : 'border-gold/50 bg-white text-ink-soft'}`} aria-pressed={filter === f}>
            {label}
          </button>
        ))}
        <TextInput className="ml-auto max-w-xs" type="search" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search guests" />
      </div>

      {board.isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : !rows.length ? (
        <Card>
          <p className="py-6 text-center text-sm text-ink-muted">{filter === 'missing' && data?.total ? 'Every family has been photographed today 🎉' : 'No families match.'}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.rsvpId} className={`flex gap-3 border bg-white/80 p-3 ${r.portrait ? 'border-emerald-200' : 'border-gold/30'}`}>
              <div className="h-20 w-20 shrink-0 overflow-hidden bg-ivory-200">
                {r.portrait?.media ? (
                  <MediaImage media={r.portrait.media} sizes="80px" className="h-20 w-20" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-gold-deep" aria-hidden="true">
                    {r.portrait ? '✓' : '◌'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg text-maroon">{r.guestName}</p>
                <p className="text-xs text-ink-muted">
                  Party of {r.numberOfGuests}
                  {r.side && <> · {SIDE_LABELS[r.side]}</>}
                </p>
                {r.portrait ? (
                  <>
                    <p className="mt-1 text-xs text-emerald-800">
                      ✓ {r.portrait.media ? 'Photo' : 'Ticked'} at {formatTime(r.portrait.at, tz)}
                      {r.portrait.by && ` · ${r.portrait.by}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <CameraButton label={r.portrait.media ? 'Replace' : 'Add photo'} className={`${btn.small} border border-gold/50`} disabled={busy === r.rsvpId} onFile={(f) => save({ rsvpId: r.rsvpId, method: 'MANUAL' }, r.guestName, f)} />
                      <ConfirmButton className={`${btn.small} text-ink-muted`} confirmLabel="Confirm" onConfirm={() => remove(r)}>
                        Undo
                      </ConfirmButton>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <CameraButton label={busy === r.rsvpId ? 'Saving…' : 'Take photo'} className={`${btn.small} bg-maroon text-ivory`} disabled={busy === r.rsvpId} onFile={(f) => save({ rsvpId: r.rsvpId, method: 'MANUAL' }, r.guestName, f)} />
                    <button type="button" className={`${btn.small} border border-gold/50`} disabled={busy === r.rsvpId} onClick={() => save({ rsvpId: r.rsvpId, method: 'MANUAL' }, r.guestName)}>
                      Tick as covered
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <QrScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />
      {scanned && (
        <Modal open onClose={() => setScanned(null)} title={scanned.guestName}>
          <p className="text-sm text-ink-soft">
            Party of {scanned.numberOfGuests}
            {scanned.side && <> · {SIDE_LABELS[scanned.side]}</>}
          </p>
          {scanned.portraitDays.includes(activeDay) && <p className="mt-3 rounded-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Already covered today — a new photo will replace the old one.</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={btn.secondary}
              disabled={!!busy}
              onClick={async () => {
                if (await save({ token: scanned.qrToken, method: 'QR' }, scanned.guestName)) {
                  setScanned(null);
                  setScanOpen(true);
                }
              }}
            >
              Tick as covered
            </button>
            <CameraButton
              label={busy ? 'Saving…' : 'Take photo'}
              disabled={!!busy}
              onFile={async (f) => {
                if (await save({ token: scanned.qrToken, method: 'QR' }, scanned.guestName, f)) {
                  setScanned(null);
                  setScanOpen(true);
                }
              }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
