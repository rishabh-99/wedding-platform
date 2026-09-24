import { useState, type FormEvent } from 'react';
import { formatDateTime, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role, type SessionUser, type TeamUserDTO } from '@wedding/shared';
import { api } from '../../services/api';
import { useAdminMutation, useWeddingTz } from '../adminApi';
import { btn, ConfirmButton, EmptyRow, FieldRow, fieldErrors, Modal, PageHeader, Select, tableCls, TextInput, Toggle } from '../components/ui';
import { staffKeys, useTeam } from '../staffApi';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export default function TeamPage({ user }: { user: SessionUser }) {
  const tz = useWeddingTz();
  const team = useTeam();
  const [editing, setEditing] = useState<TeamUserDTO | 'new' | null>(null);
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/team/${id}`), { invalidate: [staffKeys.team], success: 'Removed' });

  return (
    <>
      <PageHeader
        title="Team"
        description="Give coordinators, hospitality and photographers their own sign-in. Each role only sees the screens it needs."
        actions={
          <button type="button" className={btn.primary} onClick={() => setEditing('new')}>
            Add team member
          </button>
        }
      />

      <ul className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((r) => (
          <li key={r} className="border border-gold/25 bg-white/60 px-3 py-2">
            <p className="text-sm font-semibold text-maroon">{ROLE_LABELS[r]}</p>
            <p className="text-xs text-ink-muted">{ROLE_DESCRIPTIONS[r]}</p>
          </li>
        ))}
      </ul>

      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead>
            <tr>
              <th className={tableCls.th}>Name</th>
              <th className={tableCls.th}>Role</th>
              <th className={tableCls.th}>Phone</th>
              <th className={tableCls.th}>Last sign-in</th>
              <th className={tableCls.th}>Status</th>
              <th className={tableCls.th} />
            </tr>
          </thead>
          <tbody>
            {team.isLoading ? (
              <EmptyRow colSpan={6}>Loading…</EmptyRow>
            ) : !team.data?.length ? (
              <EmptyRow colSpan={6}>No team members yet.</EmptyRow>
            ) : (
              team.data.map((m) => (
                <tr key={m.id}>
                  <td className={tableCls.td}>
                    <p className="font-semibold">
                      {m.name} {m.id === user.id && <span className="text-xs font-normal text-ink-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-ink-muted">{m.email}</p>
                  </td>
                  <td className={tableCls.td}>{ROLE_LABELS[m.role]}</td>
                  <td className={tableCls.td}>{m.phone ?? '—'}</td>
                  <td className={tableCls.td}>{m.lastLoginAt ? formatDateTime(m.lastLoginAt, tz) : 'Never'}</td>
                  <td className={tableCls.td}>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider ${
                        m.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-100 text-stone-700'
                      }`}
                    >
                      {m.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className={`${tableCls.td} whitespace-nowrap text-right`}>
                    <button type="button" className={`${btn.small} border border-gold/50`} onClick={() => setEditing(m)}>
                      Edit
                    </button>{' '}
                    {m.id !== user.id && (
                      <ConfirmButton className={`${btn.small} text-maroon`} confirmLabel="Confirm" onConfirm={() => remove.mutate(m.id)}>
                        Remove
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Deactivating signs the person out everywhere but keeps their history.</p>

      {editing && <MemberModal member={editing === 'new' ? null : editing} isSelf={editing !== 'new' && editing.id === user.id} onClose={() => setEditing(null)} />}
    </>
  );
}

function MemberModal({ member, isSelf, onClose }: { member: TeamUserDTO | null; isSelf: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: member?.name ?? '',
    email: member?.email ?? '',
    role: (member?.role ?? 'COORDINATOR') as Role,
    phone: member?.phone ?? '',
    isActive: member?.isActive ?? true,
    password: '',
  });
  const save = useAdminMutation(
    () =>
      member
        ? api.put(`/api/admin/team/${member.id}`, { name: form.name, role: form.role, phone: form.phone, isActive: form.isActive, password: form.password })
        : api.post('/api/admin/team', { name: form.name, email: form.email, role: form.role, phone: form.phone, password: form.password }),
    { invalidate: [staffKeys.team], success: member ? 'Saved' : 'Team member added', onSuccess: onClose },
  );
  const errors = fieldErrors(save.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };
  const suggest = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    setForm({ ...form, password: [...bytes].map((b) => alphabet[b % alphabet.length]).join('') });
  };

  return (
    <Modal open onClose={onClose} title={member ? `Edit ${member.name}` : 'Add team member'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FieldRow label="Name" htmlFor="tm-name" error={errors.name}>
          <TextInput id="tm-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </FieldRow>
        <FieldRow label="Email (used to sign in)" htmlFor="tm-email" error={errors.email}>
          <TextInput id="tm-email" type="email" value={form.email} disabled={!!member} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </FieldRow>
        <FieldRow label="Role" htmlFor="tm-role" error={errors.role} hint={ROLE_DESCRIPTIONS[form.role]}>
          <Select id="tm-role" value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Phone (optional)" htmlFor="tm-phone" error={errors.phone}>
          <TextInput id="tm-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </FieldRow>
        <FieldRow label={member ? 'New password (leave blank to keep)' : 'Password'} htmlFor="tm-pw" error={errors.password} hint="At least 10 characters. Share it privately with the person.">
          <div className="flex gap-2">
            <TextInput id="tm-pw" type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" className={btn.secondary} onClick={suggest}>
              Generate
            </button>
          </div>
        </FieldRow>
        {member && !isSelf && <Toggle label="Active (can sign in)" checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />}
        {save.error && !Object.keys(errors).length && (
          <p role="alert" className="text-sm text-maroon">
            {save.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            {member ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
