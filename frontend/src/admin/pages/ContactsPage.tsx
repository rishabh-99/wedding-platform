import { useState, type FormEvent } from 'react';
import { contactInputSchema, type ContactDTO } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminContacts, useAdminEvents, useAdminMutation } from '../adminApi';
import { btn, ConfirmButton, EmptyRow, FieldRow, Modal, PageHeader, Select, StatusPill, TextArea, TextInput, Toggle, fieldErrors, tableCls } from '../components/ui';

const invalidate = [adminKeys.contacts, keys.contacts];

/** Event managers, hospitality desk, transport, vendors… Public contacts appear to guests. */
export default function ContactsPage() {
  const { data, isLoading } = useAdminContacts();
  const [editing, setEditing] = useState<ContactDTO | 'new' | null>(null);
  const remove = useAdminMutation((id: string) => api.del(`/api/admin/contacts/${id}`), { invalidate, success: 'Contact deleted' });
  const list = [...(data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Event managers and helpers. Public contacts are shown to guests in “Need a hand?” and on the relevant event page; private ones are for the team only."
        actions={<button type="button" className={btn.primary} onClick={() => setEditing('new')}>Add contact</button>}
      />
      {isLoading ? (
        <LoadingBlock lines={5} />
      ) : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead>
              <tr>
                {['Name', 'Role', 'Celebration', 'Phone / WhatsApp', 'Email', 'Visibility', ''].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {!list.length && <EmptyRow colSpan={7}>No contacts yet — add your event managers.</EmptyRow>}
              {list.map((c) => (
                <tr key={c.id}>
                  <td className={`${tableCls.td} font-semibold`}>{c.name}</td>
                  <td className={tableCls.td}>{c.role}</td>
                  <td className={tableCls.td}>{c.event?.name ?? <span className="text-ink-muted">All celebrations</span>}</td>
                  <td className={`${tableCls.td} whitespace-nowrap text-xs`}>
                    {c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="block">{c.phone}</a>}
                    {c.whatsapp && <span className="block text-ink-muted">WA {c.whatsapp}</span>}
                  </td>
                  <td className={`${tableCls.td} text-xs`}>{c.email ?? '—'}</td>
                  <td className={tableCls.td}><StatusPill status={c.isPublic ? 'PUBLISHED' : 'HIDDEN'} /></td>
                  <td className={tableCls.td}>
                    <div className="flex gap-1">
                      <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => setEditing(c)}>Edit</button>
                      <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Sure?" onConfirm={() => remove.mutate(c.id)}>Delete</ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ContactForm contact={editing === 'new' ? null : editing} nextOrder={list.length + 1} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ContactForm({ contact, nextOrder, onClose }: { contact: ContactDTO | null; nextOrder: number; onClose: () => void }) {
  const { data: events } = useAdminEvents();
  const [form, setForm] = useState({
    name: contact?.name ?? '',
    role: contact?.role ?? 'Event Manager',
    phone: contact?.phone ?? '',
    whatsapp: contact?.whatsapp ?? '',
    email: contact?.email ?? '',
    notes: contact?.notes ?? '',
    eventId: contact?.eventId ?? '',
    isPublic: contact?.isPublic ?? true,
    displayOrder: contact?.displayOrder ?? nextOrder,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation(
    (body: typeof form) => (contact ? api.put(`/api/admin/contacts/${contact.id}`, body) : api.post('/api/admin/contacts', body)),
    { invalidate, success: 'Contact saved', onSuccess: onClose },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = contactInputSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    save.mutate(form, { onError: (err) => setErrors(fieldErrors(err)) });
  };
  const text = (k: 'name' | 'role' | 'phone' | 'whatsapp' | 'email', label: string, type = 'text') => (
    <FieldRow label={label} htmlFor={`c-${k}`} error={errors[k]}>
      <TextInput id={`c-${k}`} type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </FieldRow>
  );
  return (
    <Modal open onClose={onClose} title={contact ? `Edit ${contact.name}` : 'Add contact'} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {text('name', 'Name')}
        {text('role', 'Role (e.g. Event Manager — Sangeet)')}
        {text('phone', 'Phone', 'tel')}
        {text('whatsapp', 'WhatsApp number', 'tel')}
        {text('email', 'Email', 'email')}
        <FieldRow label="Celebration" htmlFor="c-event" hint="Shown on that event’s page">
          <Select id="c-event" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}>
            <option value="">All celebrations</option>
            {(events ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </Select>
        </FieldRow>
        <div className="sm:col-span-2">
          <FieldRow label="Notes" htmlFor="c-notes">
            <TextArea id="c-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FieldRow>
        </div>
        <div className="sm:col-span-2">
          <Toggle id="c-public" checked={form.isPublic} onChange={(v) => setForm({ ...form, isPublic: v })} label="Show to guests (otherwise team-only)" />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>Save contact</button>
        </div>
      </form>
    </Modal>
  );
}
