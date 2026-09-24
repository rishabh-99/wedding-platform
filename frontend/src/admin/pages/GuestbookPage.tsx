import { useState } from 'react';
import { formatDateTime, type GuestbookDTO, type GuestbookStatus } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { useAdminGuestbook, useAdminMutation, useWeddingTz } from '../adminApi';
import { btn, ConfirmButton, FieldRow, Modal, PageHeader, StatusPill, TextArea, TextInput } from '../components/ui';

const invalidate = [['admin', 'guestbook'], keys.guestbook];
const TABS: (GuestbookStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

export default function GuestbookPage() {
  const [tab, setTab] = useState<GuestbookStatus | 'ALL'>('PENDING');
  const { data, isLoading } = useAdminGuestbook(tab === 'ALL' ? undefined : tab);
  const tz = useWeddingTz();
  const [editing, setEditing] = useState<GuestbookDTO | null>(null);
  const update = useAdminMutation(({ id, ...body }: { id: string; status?: GuestbookStatus; guestName?: string; message?: string }) => api.patch(`/api/admin/guestbook/${id}`, body), {
    invalidate,
    success: 'Guestbook updated',
  });
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/guestbook/${id}`), { invalidate, success: 'Message deleted' });

  return (
    <div>
      <PageHeader title="Guestbook" description="Blessings are only shown on the website after you approve them." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? btn.primary : btn.secondary} onClick={() => setTab(t)}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {isLoading ? (
        <LoadingBlock lines={4} />
      ) : !data?.length ? (
        <p className="py-10 text-center text-sm text-ink-muted">Nothing here.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((g) => (
            <li key={g.id} className="border border-gold/25 bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{g.guestName}</p>
                  <p className="text-xs text-ink-muted">{formatDateTime(g.createdAt, tz)}</p>
                </div>
                <StatusPill status={g.status} />
              </div>
              {g.media && <img src={g.media.urls.thumb} alt="" className="mt-3 max-h-48 w-full object-cover" loading="lazy" />}
              <p className="mt-3 whitespace-pre-line text-sm">{g.message}</p>
              <div className="mt-4 flex flex-wrap gap-1">
                {g.status !== 'APPROVED' && <button type="button" className={`${btn.small} bg-maroon text-ivory`} onClick={() => update.mutate({ id: g.id, status: 'APPROVED' })}>Approve</button>}
                {g.status !== 'REJECTED' && <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => update.mutate({ id: g.id, status: 'REJECTED' })}>Reject</button>}
                <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => setEditing(g)}>Edit</button>
                <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Sure?" onConfirm={() => remove.mutate(g.id)}>Delete</ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EditMessage
          message={editing}
          onClose={() => setEditing(null)}
          onSave={(guestName, message) => update.mutate({ id: editing.id, guestName, message }, { onSuccess: () => setEditing(null) })}
        />
      )}
    </div>
  );
}

function EditMessage({ message, onClose, onSave }: { message: GuestbookDTO; onClose: () => void; onSave: (name: string, message: string) => void }) {
  const [name, setName] = useState(message.guestName);
  const [text, setText] = useState(message.message);
  return (
    <Modal open onClose={onClose} title="Edit blessing">
      <div className="space-y-4">
        <FieldRow label="Name" htmlFor="gb-e-name"><TextInput id="gb-e-name" value={name} onChange={(e) => setName(e.target.value)} /></FieldRow>
        <FieldRow label="Message" htmlFor="gb-e-msg"><TextArea id="gb-e-msg" rows={6} value={text} onChange={(e) => setText(e.target.value)} /></FieldRow>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="button" className={btn.primary} onClick={() => onSave(name, text)}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
