import type { ContactDTO } from '@wedding/shared';

const digits = (s: string) => s.replace(/[^\d]/g, '');

/** One-tap call / WhatsApp / email for event managers and the hospitality team. */
export function ContactCards({ contacts, compact = false }: { contacts: ContactDTO[]; compact?: boolean }) {
  if (!contacts.length) return null;
  return (
    <ul className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {contacts.map((c) => (
        <li key={c.id} className="min-w-0 border border-gold/30 bg-ivory-50/80 px-4 py-4">
          <p className="label-sm break-words">{c.role}</p>
          <p className="mt-1 break-words font-display text-xl text-maroon">{c.name}</p>
          {c.event && <p className="text-xs text-ink-muted">{c.event.name}</p>}
          {c.notes && <p className="mt-1 text-sm text-ink-soft">{c.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="btn-outline min-h-[44px] px-4 py-2" aria-label={`Call ${c.name}`}>
                Call
              </a>
            )}
            {c.whatsapp && (
              <a href={`https://wa.me/${digits(c.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="btn-outline min-h-[44px] px-4 py-2" aria-label={`WhatsApp ${c.name}`}>
                WhatsApp
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="btn-ghost min-h-[44px] px-3 py-2" aria-label={`Email ${c.name}`}>
                Email
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
