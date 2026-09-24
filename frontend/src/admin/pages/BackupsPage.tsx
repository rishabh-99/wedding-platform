import { formatDateTime } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { adminKeys, useAdminMutation, useBackups, useWeddingTz } from '../adminApi';
import { btn, Card, EmptyRow, formatBytes, PageHeader, tableCls } from '../components/ui';

export default function BackupsPage() {
  const tz = useWeddingTz();
  const { data, isLoading } = useBackups();
  const create = useAdminMutation(() => api.post('/api/admin/backups'), { invalidate: [adminKeys.backups], success: 'Database backup created' });

  return (
    <div>
      <PageHeader
        title="Backups"
        description="Creates a compressed PostgreSQL dump and stores it privately (local disk in development, S3 in production)."
        actions={
          <button type="button" className={btn.primary} onClick={() => create.mutate(undefined)} disabled={create.isPending}>
            {create.isPending ? 'Backing up…' : 'Backup database'}
          </button>
        }
      />
      <Card className="mb-6" title="Backup strategy">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>Use this button before major changes (e.g. editing events on the wedding day).</li>
          <li>Automated nightly dumps run from the server’s cron via <code>docker/backup.sh</code> (see README).</li>
          <li>Photographs live in S3 with versioning; enable cross-region replication or AWS Backup for a second copy.</li>
          <li>EBS snapshots of the server volume are recommended daily via Data Lifecycle Manager.</li>
        </ul>
      </Card>
      {isLoading ? (
        <LoadingBlock lines={4} />
      ) : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead>
              <tr>
                <th className={tableCls.th}>File</th>
                <th className={tableCls.th}>Size</th>
                <th className={tableCls.th}>Created</th>
                <th className={tableCls.th}></th>
              </tr>
            </thead>
            <tbody>
              {!data?.length && <EmptyRow colSpan={4}>No backups yet.</EmptyRow>}
              {data?.map((b) => (
                <tr key={b.key}>
                  <td className={`${tableCls.td} font-mono text-xs`}>{b.filename}</td>
                  <td className={tableCls.td}>{formatBytes(b.size)}</td>
                  <td className={tableCls.td}>{formatDateTime(b.createdAt, tz)}</td>
                  <td className={tableCls.td}>
                    <a className={`${btn.small} border border-gold/40`} href={`/api/admin/backups/${encodeURIComponent(b.filename)}`} download>
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
