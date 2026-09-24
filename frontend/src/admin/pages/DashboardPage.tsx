import { Link } from 'react-router-dom';
import { SIDE_LABELS, formatDateTime, ATTENDANCE_LABELS } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { useDashboard, useWeddingTz } from '../adminApi';
import { Card, PageHeader, Stat, StatusPill, btn } from '../components/ui';

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const tz = useWeddingTz();
  if (isLoading) return <LoadingBlock lines={6} />;
  if (isError || !data) {
    return (
      <div>
        <p className="text-maroon">The dashboard could not be loaded.</p>
        <button type="button" className={btn.secondary} onClick={() => refetch()}>Retry</button>
      </div>
    );
  }
  const c = data.counts;
  const maxGuests = Math.max(1, ...data.attendancePerEvent.map((a) => a.guests));

  return (
    <div>
      <PageHeader
        title="Wedding admin"
        description={`Phase: ${data.phase === 'pre' ? 'before the celebrations' : data.phase === 'archive' ? 'archive' : 'live celebrations'}`}
        actions={
          <>
            <Link to="/admin/live" className={btn.primary}>Post live update</Link>
            <Link to="/admin/gallery" className={btn.secondary}>Upload photos</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat accent={!!data.liveNow} label={data.liveNow ? 'Live now' : 'Next up'} value={data.liveNow?.name ?? data.nextEvent?.name ?? '—'} hint={data.liveNow ? 'Happening now' : undefined} />
        <Stat label="Events" value={c.events} />
        <Stat label="RSVPs" value={c.rsvps} hint={`${c.confirmedResponses} attending · ${c.maybeResponses} maybe · ${c.declined} declined`} />
        <Stat label="Confirmed guests" value={c.confirmedGuests} hint={`+${c.maybeGuests} maybe`} />
        <Stat label="Photos" value={c.photos} />
        <Stat label="Videos" value={c.videos} />
        <Stat label="Live posts" value={c.livePosts} />
        <Stat label="Pending guestbook" value={c.pendingGuestbook} hint={`${c.guestbookTotal} messages in total`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Attendance per celebration (attending + maybe)">
          <ul className="space-y-3">
            {data.attendancePerEvent.map((a) => (
              <li key={a.eventId}>
                <div className="flex justify-between text-sm">
                  <span>{a.name}</span>
                  <span className="tabular-nums text-ink-muted">
                    {a.guests} guests · {a.responses} RSVPs
                  </span>
                </div>
                <div className="mt-1 h-2 bg-gold/15" aria-hidden="true">
                  <div className="h-full bg-maroon" style={{ width: `${(a.guests / maxGuests) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Guests by side (attending + maybe)">
          <ul className="divide-y divide-gold/15 text-sm">
            {(['BRIDE', 'GROOM', null] as const).map((s) => {
              const row = data.sides.find((x) => x.side === s);
              if (s === null && !row) return null;
              return (
                <li key={s ?? 'none'} className="flex justify-between py-2">
                  <span>{s ? SIDE_LABELS[s] : 'Not specified'}</span>
                  <span className="tabular-nums">
                    {row?.guests ?? 0} guests · {row?.responses ?? 0} RSVPs
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="lg:col-span-2" title="Rooms" actions={<Link to="/admin/rsvps?tab=rooms" className="text-sm text-maroon underline">Room allotment</Link>}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Rooms allotted" value={data.rooms.assigned} />
            <Stat label="Parties needing rooms" value={data.rooms.partiesNeedingRooms} accent={data.rooms.partiesNeedingRooms > 0} />
          </div>
        </Card>
      </div>

      <Card className="mt-6" title="Latest RSVPs" actions={<Link to="/admin/rsvps" className="text-sm text-maroon underline">All RSVPs</Link>}>
        <ul className="divide-y divide-gold/15 text-sm">
          {data.recentRsvps.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">{r.guestName}</span> · {r.numberOfGuests} guest{r.numberOfGuests === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                <StatusPill status={r.attendanceStatus} />
                <span className="sr-only">{ATTENDANCE_LABELS[r.attendanceStatus]}</span>
                {formatDateTime(r.submittedAt, tz)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
