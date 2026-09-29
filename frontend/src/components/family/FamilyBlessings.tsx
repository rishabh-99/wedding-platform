import { Fragment } from 'react';
import credits from '../../film/vendor/data/credits.generated.json';
import { Reveal } from '../../animations/Reveal';
import { FramedCorners } from '../ornaments/Ornaments';

export interface CreditGroup {
  heading: string;
  names: { name: string; role: string }[];
}

/** The family roll from the invitation film's closing credits (motion-film/family.txt). */
export const FAMILY_CREDITS: CreditGroup[] = credits;

/** The bride and groom's own entry: every name in it is the Dulha or the Dulhan. */
const isCouple = (g: CreditGroup) => g.names.length > 0 && g.names.every((n) => /^dulhan?$/i.test(n.role.trim()));

export function FamilyBlessings({ groups = FAMILY_CREDITS }: { groups?: CreditGroup[] }) {
  const couple = groups.find(isCouple);
  const rest = groups.filter((g) => g !== couple);
  return (
    <>
      {couple && (
        <Reveal className="mx-auto mb-14 max-w-2xl">
          <section className="card-paper relative px-6 py-10 text-center sm:px-12 sm:py-12" aria-labelledby="couple-credit-title" data-testid="couple-credit">
            <FramedCorners size="h-8 w-8 sm:h-10 sm:w-10" />
            <h3 id="couple-credit-title" className="label mb-6">{couple.heading}</h3>
            <ul className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8">
              {couple.names.map((n, i) => (
                <Fragment key={n.name}>
                  {i > 0 && (
                    <li aria-hidden="true" className="font-display text-3xl italic text-gold">
                      &amp;
                    </li>
                  )}
                  <li>
                    <p className="font-display text-3xl font-medium leading-tight text-maroon sm:text-4xl">{n.name}</p>
                    <p className="label-sm mt-2">{n.role}</p>
                  </li>
                </Fragment>
              ))}
            </ul>
          </section>
        </Reveal>
      )}
      <div className="mx-auto max-w-5xl columns-1 gap-12 sm:columns-2 lg:columns-3">
        {rest.map((group) => (
          <Reveal key={group.heading} className="mb-10 break-inside-avoid text-center">
            <h3 className="label mb-4">{group.heading}</h3>
            <ul className="space-y-3">
              {group.names.map((n) => (
                <li key={n.name}>
                  <p className="font-display text-xl leading-tight text-ink">{n.name}</p>
                  {n.role && <p className="text-sm text-ink-muted">{n.role}</p>}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </>
  );
}
