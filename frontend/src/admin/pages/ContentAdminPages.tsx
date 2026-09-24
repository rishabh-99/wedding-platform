import { useState, type FormEvent } from 'react';
import type { ZodTypeAny } from 'zod';
import {
  faqInputSchema,
  storySectionInputSchema,
  travelSectionInputSchema,
  type FaqDTO,
  type LinkItem,
  type StorySectionDTO,
  type TravelSectionDTO,
} from '@wedding/shared';
import type { QueryKey, UseQueryResult } from '@tanstack/react-query';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminFaq, useAdminMutation, useAdminStory, useAdminTravel } from '../adminApi';
import { Uploader } from '../components/Uploader';
import { btn, ConfirmButton, FieldRow, Modal, PageHeader, StatusPill, TextArea, TextInput, Toggle, fieldErrors } from '../components/ui';

/**
 * Generic editor for ordered editorial content (Story, Travel & Stay, FAQ):
 * list + create/edit modal + reorder + publish toggle + delete.
 */
interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'links' | 'media';
  hint?: string;
}

interface Item {
  id: string;
  displayOrder: number;
  isPublished: boolean;
  [k: string]: unknown;
}

function ContentEditor<T extends Item>({
  title,
  description,
  endpoint,
  query,
  invalidate,
  schema,
  fields,
  summary,
  empty,
}: {
  title: string;
  description: string;
  endpoint: string;
  query: UseQueryResult<T[]>;
  invalidate: QueryKey[];
  schema: ZodTypeAny;
  fields: FieldDef[];
  summary: (item: T) => { heading: string; sub?: string };
  empty: Record<string, unknown>;
}) {
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const items = [...(query.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const toBody = (item: T, patch: Partial<T> = {}) => {
    const body: Record<string, unknown> = { displayOrder: item.displayOrder, isPublished: item.isPublished };
    for (const f of fields) body[f.key] = f.type === 'media' ? (item[f.key] as string | null) ?? null : item[f.key] ?? '';
    return { ...body, ...patch };
  };
  const update = useAdminMutation(({ id, body }: { id: string; body: unknown }) => api.put(`${endpoint}/${id}`, body), { invalidate });
  const remove = useAdminMutation((id: string) => api.del(`${endpoint}/${id}`), { invalidate, success: 'Deleted' });

  const move = async (i: number, d: number) => {
    const a = items[i]!;
    const b = items[i + d]!;
    await update.mutateAsync({ id: a.id, body: toBody(a, { displayOrder: b.displayOrder } as Partial<T>) });
    await update.mutateAsync({ id: b.id, body: toBody(b, { displayOrder: a.displayOrder === b.displayOrder ? a.displayOrder + d : a.displayOrder } as Partial<T>) });
  };

  return (
    <div>
      <PageHeader title={title} description={description} actions={<button type="button" className={btn.primary} onClick={() => setEditing('new')}>Add</button>} />
      {query.isLoading ? (
        <LoadingBlock lines={5} />
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const s = summary(item);
            return (
              <li key={item.id} className="flex flex-col gap-3 border border-gold/25 bg-white/70 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.heading}</p>
                  {s.sub && <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{s.sub}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {!item.isPublished && <StatusPill status="HIDDEN" />}
                  <button type="button" className={`${btn.small} border border-gold/40`} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button type="button" className={`${btn.small} border border-gold/40`} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => update.mutate({ id: item.id, body: toBody(item, { isPublished: !item.isPublished } as Partial<T>) })}>
                    {item.isPublished ? 'Hide' : 'Show'}
                  </button>
                  <button type="button" className={`${btn.small} border border-gold/40`} onClick={() => setEditing(item)}>Edit</button>
                  <ConfirmButton className={`${btn.small} border border-maroon/40 text-maroon`} confirmLabel="Sure?" onConfirm={() => remove.mutate(item.id)}>Delete</ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <ContentForm
          item={editing === 'new' ? null : editing}
          defaults={{ ...empty, displayOrder: (items.at(-1)?.displayOrder ?? 0) + 1, isPublished: true }}
          fields={fields}
          schema={schema}
          endpoint={endpoint}
          invalidate={invalidate}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ContentForm({ item, defaults, fields, schema, endpoint, invalidate, onClose }: {
  item: Item | null;
  defaults: Record<string, unknown>;
  fields: FieldDef[];
  schema: ZodTypeAny;
  endpoint: string;
  invalidate: QueryKey[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const base: Record<string, unknown> = { displayOrder: item?.displayOrder ?? defaults.displayOrder, isPublished: item?.isPublished ?? true };
    for (const f of fields) base[f.key] = item ? item[f.key] ?? (f.type === 'links' ? [] : f.type === 'media' ? null : '') : defaults[f.key];
    return base;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation((body: unknown) => (item ? api.put(`${endpoint}/${item.id}`, body) : api.post(endpoint, body)), {
    invalidate,
    success: 'Saved',
    onSuccess: onClose,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join('.')] ??= i.message;
      return setErrors(errs);
    }
    save.mutate(form, { onError: (err) => setErrors(fieldErrors(err)) });
  };
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} title={item ? 'Edit' : 'Add'} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {fields.map((f) => (
          <FieldRow key={f.key} label={f.label} error={errors[f.key]} hint={f.hint} htmlFor={`cf-${f.key}`}>
            {f.type === 'textarea' ? (
              <TextArea id={`cf-${f.key}`} rows={6} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'links' ? (
              <LinksEditor value={(form[f.key] as LinkItem[]) ?? []} onChange={(v) => set(f.key, v)} errors={errors} />
            ) : f.type === 'media' ? (
              form[f.key] ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink-muted">Image attached</span>
                  <button type="button" className={btn.ghost} onClick={() => set(f.key, null)}>Remove</button>
                </div>
              ) : (
                <Uploader purpose="STORY" multiple={false} allowVideo={false} label="Add an image (optional)" onUploaded={(m) => set(f.key, m[0]?.id ?? null)} />
              )
            ) : (
              <TextInput id={`cf-${f.key}`} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </FieldRow>
        ))}
        <Toggle checked={!!form.isPublished} onChange={(v) => set('isPublished', v)} label="Visible on the website" />
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function LinksEditor({ value, onChange, errors }: { value: LinkItem[]; onChange: (v: LinkItem[]) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <TextInput placeholder="Label" aria-label="Link label" value={l.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <TextInput placeholder="https://…" aria-label="Link URL" value={l.url} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <button type="button" className={btn.ghost} onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
          {(errors[`links.${i}.url`] || errors[`links.${i}.label`]) && <p className="text-xs text-maroon sm:col-span-3">{errors[`links.${i}.url`] ?? errors[`links.${i}.label`]}</p>}
        </div>
      ))}
      <button type="button" className={btn.secondary} onClick={() => onChange([...value, { label: '', url: '' }])}>Add link</button>
    </div>
  );
}

export function StoryAdminPage() {
  return (
    <ContentEditor<StorySectionDTO & Item>
      title="Wedding story"
      description="“A little bit of us” — how you met, your story, the engagement and the wedding journey."
      endpoint="/api/admin/story"
      query={useAdminStory() as UseQueryResult<(StorySectionDTO & Item)[]>}
      invalidate={[adminKeys.story, keys.story]}
      schema={storySectionInputSchema}
      fields={[
        { key: 'key', label: 'Key', hint: 'Short identifier, e.g. how-we-met' },
        { key: 'eyebrow', label: 'Small label', hint: 'e.g. Chapter One' },
        { key: 'title', label: 'Title' },
        { key: 'body', label: 'Text', type: 'textarea' },
        { key: 'mediaAssetId', label: 'Image', type: 'media' },
      ]}
      summary={(s) => ({ heading: s.title, sub: s.body })}
      empty={{ key: '', eyebrow: '', title: '', body: '', mediaAssetId: null }}
    />
  );
}

export function TravelAdminPage() {
  return (
    <ContentEditor<TravelSectionDTO & Item>
      title="Travel & stay"
      description="Getting to Kanpur, airports, railway, local transport, hotels, parking and contacts."
      endpoint="/api/admin/travel"
      query={useAdminTravel() as UseQueryResult<(TravelSectionDTO & Item)[]>}
      invalidate={[adminKeys.travel, keys.travel]}
      schema={travelSectionInputSchema}
      fields={[
        { key: 'category', label: 'Category', hint: 'getting-there, airport, railway, local-transport, stay, hotels, parking, contacts' },
        { key: 'title', label: 'Title' },
        { key: 'body', label: 'Text', type: 'textarea' },
        { key: 'links', label: 'Links', type: 'links' },
      ]}
      summary={(t) => ({ heading: t.title, sub: `${t.category} · ${t.body}` })}
      empty={{ category: '', title: '', body: '', links: [] }}
    />
  );
}

export function FaqAdminPage() {
  return (
    <ContentEditor<FaqDTO & Item>
      title="FAQ"
      description="Questions guests ask most often."
      endpoint="/api/admin/faq"
      query={useAdminFaq() as UseQueryResult<(FaqDTO & Item)[]>}
      invalidate={[adminKeys.faq, keys.faq]}
      schema={faqInputSchema}
      fields={[
        { key: 'question', label: 'Question' },
        { key: 'answer', label: 'Answer', type: 'textarea' },
      ]}
      summary={(f) => ({ heading: f.question, sub: f.answer })}
      empty={{ question: '', answer: '' }}
    />
  );
}
