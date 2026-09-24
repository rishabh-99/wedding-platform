import { useEffect, useState, type FormEvent } from 'react';
import { settingsInputSchema, type SectionToggles, type SessionUser, type SettingsDTO, type SettingsInput } from '@wedding/shared';
import { LoadingBlock } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { keys } from '../../services/queries';
import { adminKeys, useAdminMutation, useAdminSettings } from '../adminApi';
import { Uploader } from '../components/Uploader';
import { useQrCode } from '../../components/sections/WhatsAppGroup';
import { btn, Card, FieldRow, PageHeader, Select, TextArea, TextInput, Toggle, fieldErrors } from '../components/ui';

const SECTION_LABELS: Record<keyof SectionToggles, string> = {
  story: 'Our story',
  rsvp: 'RSVP',
  gallery: 'Gallery',
  guestbook: 'Guestbook',
  travel: 'Travel & stay',
  faq: 'FAQ',
  dressCode: 'Dress code',
  concierge: 'Wedding concierge',
};

export default function SettingsPage({ user }: { user: SessionUser }) {
  const { data, isLoading } = useAdminSettings();
  if (isLoading || !data) return <LoadingBlock lines={8} />;
  return (
    <div>
      <PageHeader title="Settings" description="Couple, branding, contact details, site sections and live mode." />
      <SettingsForm settings={data} readOnly={user.role !== 'ADMIN'} />
      <PasswordCard />
    </div>
  );
}

function SettingsForm({ settings, readOnly }: { settings: SettingsDTO; readOnly: boolean }) {
  const toForm = (s: SettingsDTO): SettingsInput => ({
    coupleName1: s.coupleName1,
    coupleName2: s.coupleName2,
    familiesLine: s.familiesLine,
    inviteLine: s.inviteLine,
    welcomeMessage: s.welcomeMessage,
    weddingDatesLabel: s.weddingDatesLabel,
    weddingHashtag: s.weddingHashtag ?? '',
    timezone: s.timezone,
    contactPhone: s.contactPhone ?? '',
    contactWhatsapp: s.contactWhatsapp ?? '',
    contactEmail: s.contactEmail ?? '',
    whatsappGroupUrl: s.whatsappGroupUrl ?? '',
    siteTitle: s.siteTitle,
    siteDescription: s.siteDescription,
    sections: s.sections,
    liveMode: s.liveMode,
    liveBannerText: s.liveBannerText,
    archiveHeadline: s.archiveHeadline,
    archiveSubheadline: s.archiveSubheadline,
    logoAssetId: s.logoAssetId,
    ogImageAssetId: s.ogImageAssetId,
  });
  const [form, setForm] = useState<SettingsInput>(() => toForm(settings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [ogUrl, setOgUrl] = useState(settings.ogImageUrl);
  useEffect(() => setForm(toForm(settings)), [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useAdminMutation((input: SettingsInput) => api.put<SettingsDTO>('/api/admin/settings', input), {
    invalidate: [adminKeys.settings, keys.settings],
    success: 'Settings saved',
  });
  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof SettingsInput, label: string, hint?: string, multiline = false) => (
    <FieldRow label={label} error={errors[k]} hint={hint} htmlFor={`s-${k}`}>
      {multiline ? (
        <TextArea id={`s-${k}`} rows={3} value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} disabled={readOnly} />
      ) : (
        <TextInput id={`s-${k}`} value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} disabled={readOnly} />
      )}
    </FieldRow>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = settingsInputSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    save.mutate(form, { onError: (err) => setErrors(fieldErrors(err)) });
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card title="Couple">
        <div className="grid gap-4 sm:grid-cols-2">
          {text('coupleName1', 'First name (appears first)')}
          {text('coupleName2', 'Second name')}
          {text('familiesLine', 'Families line', 'e.g. Together with their families')}
          {text('inviteLine', 'Invitation line', 'e.g. invite you to celebrate their wedding')}
          {text('weddingDatesLabel', 'Wedding dates (as displayed)')}
          {text('timezone', 'Timezone', 'IANA name, e.g. Asia/Kolkata')}
          <div className="sm:col-span-2">{text('welcomeMessage', 'Welcome message', undefined, true)}</div>
        </div>
      </Card>

      <Card title="Branding & sharing">
        <div className="grid gap-4 sm:grid-cols-2">
          {text('weddingHashtag', 'Wedding hashtag')}
          {text('siteTitle', 'Page title (browser tab & link previews)')}
          <div className="sm:col-span-2">{text('siteDescription', 'Link preview description', 'Shown when the URL is shared on WhatsApp', true)}</div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">Logo / monogram</p>
            {logoUrl && <img src={logoUrl} alt="Current logo" className="mb-2 h-20 w-20 border border-gold/30 object-contain" />}
            {!readOnly && (
              <>
                <Uploader purpose="BRANDING" multiple={false} allowVideo={false} label="Upload logo" onUploaded={(m) => { set('logoAssetId', m[0]?.id ?? null); setLogoUrl(m[0]?.urls.thumb ?? null); }} />
                {form.logoAssetId && <button type="button" className={`${btn.ghost} mt-1`} onClick={() => { set('logoAssetId', null); setLogoUrl(null); }}>Remove logo</button>}
              </>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">Social sharing image (1200×630 recommended)</p>
            <img src={ogUrl ?? '/og-image.jpg'} alt="Current social image" className="mb-2 aspect-[1200/630] w-full border border-gold/30 object-cover" />
            {!readOnly && (
              <>
                <Uploader purpose="BRANDING" multiple={false} allowVideo={false} label="Upload sharing image" onUploaded={(m) => { set('ogImageAssetId', m[0]?.id ?? null); setOgUrl(m[0]?.urls.medium ?? null); }} />
                {form.ogImageAssetId && <button type="button" className={`${btn.ghost} mt-1`} onClick={() => { set('ogImageAssetId', null); setOgUrl(null); }}>Use default image</button>}
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid gap-4 sm:grid-cols-3">
          {text('contactPhone', 'Phone')}
          {text('contactWhatsapp', 'WhatsApp')}
          {text('contactEmail', 'Email')}
        </div>
      </Card>

      <Card title="WhatsApp group">
        <WhatsAppGroupSettings
          value={String(form.whatsappGroupUrl ?? '')}
          onChange={(v) => set('whatsappGroupUrl', v)}
          error={errors.whatsappGroupUrl}
          readOnly={readOnly}
        />
      </Card>

      <Card title="Site sections">
        <div className="grid gap-1 sm:grid-cols-2">
          {(Object.keys(SECTION_LABELS) as (keyof SectionToggles)[]).map((k) => (
            <Toggle key={k} id={`sec-${k}`} checked={form.sections[k]} onChange={(v) => set('sections', { ...form.sections, [k]: v })} label={SECTION_LABELS[k]} />
          ))}
        </div>
      </Card>

      <Card title="Live mode & archive">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Live mode" htmlFor="s-liveMode" hint="Automatic turns live mode on during event days.">
            <Select id="s-liveMode" value={form.liveMode} onChange={(e) => set('liveMode', e.target.value as SettingsInput['liveMode'])} disabled={readOnly}>
              <option value="AUTO">Automatic (recommended)</option>
              <option value="ON">Always on</option>
              <option value="OFF">Off</option>
            </Select>
          </FieldRow>
          {text('liveBannerText', 'Live banner text')}
          {text('archiveHeadline', 'Archive headline')}
          {text('archiveSubheadline', 'Archive sub-headline')}
        </div>
      </Card>

      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-gold/25 bg-ivory/95 px-4 py-3 backdrop-blur sm:mx-0">
          <button type="submit" className={btn.primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</button>
        </div>
      )}
    </form>
  );
}

/** Invite link field with a live QR preview — the QR regenerates as soon as the link changes. */
function WhatsAppGroupSettings({ value, onChange, error, readOnly }: { value: string; onChange: (v: string) => void; error?: string; readOnly: boolean }) {
  const valid = /^https?:\/\/\S+$/i.test(value.trim());
  const { dataUrl, error: qrError } = useQrCode(valid ? value.trim() : null, 1024);
  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
      <div>
        <FieldRow
          label="Group invite link"
          htmlFor="s-whatsappGroupUrl"
          error={error}
          hint="WhatsApp → group → Invite via link → Copy link (looks like https://chat.whatsapp.com/…). Leave empty to hide the QR on the site."
        >
          <TextInput
            id="s-whatsappGroupUrl"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://chat.whatsapp.com/…"
            disabled={readOnly}
          />
        </FieldRow>
        {value && !valid && <p className="mt-1 text-xs text-maroon">Enter the full link starting with https://</p>}
        {qrError && <p className="mt-1 text-xs text-maroon">The QR code could not be generated for this link.</p>}
        <p className="mt-3 text-xs text-ink-muted">Guests see this QR on the home page and in “Need a hand? → Need help?”. Save settings to publish a new link.</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        {dataUrl ? (
          <>
            <img src={dataUrl} alt="WhatsApp group QR code preview" className="h-40 w-40 border border-gold/40" />
            <a href={dataUrl} download="wedding-whatsapp-group-qr.png" className={btn.secondary}>Download QR (PNG)</a>
          </>
        ) : (
          <div className="flex h-40 w-40 items-center justify-center border border-dashed border-gold/40 p-3 text-center text-xs text-ink-muted">
            QR appears here once a link is entered
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = useAdminMutation((body: { currentPassword: string; newPassword: string }) => api.post('/api/admin/auth/password', body), {
    success: 'Password changed — please sign in again',
    onSuccess: () => window.setTimeout(() => (window.location.href = '/admin/login'), 1200),
  });
  return (
    <Card title="Change password" className="mt-6">
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (next.length < 12) return setErrors({ newPassword: 'Use at least 12 characters' });
          setErrors({});
          change.mutate({ currentPassword: current, newPassword: next }, { onError: (err) => setErrors(fieldErrors(err)) });
        }}
      >
        <FieldRow label="Current password" htmlFor="pw-cur" error={errors.currentPassword}>
          <TextInput id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </FieldRow>
        <FieldRow label="New password (12+ characters)" htmlFor="pw-new" error={errors.newPassword}>
          <TextInput id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </FieldRow>
        <button type="submit" className={btn.secondary} disabled={change.isPending}>Change password</button>
      </form>
    </Card>
  );
}
