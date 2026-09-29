import { lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from 'framer-motion';
import { SectionHeading } from '../ui/primitives';

const FamilyPortraits = lazy(() => import('../../film/FamilyPortraits'));

/** Home page band: the family as drawn in the invitation film, linking to the family page. */
export function FamilyTeaser() {
  const box = useRef<HTMLDivElement>(null);
  // Load the artwork only as the band approaches, so the home page stays light.
  const near = useInView(box, { once: true, margin: '300px 0px' });
  return (
    <section className="section" aria-labelledby="family-title">
      <div className="container-page text-center">
        <SectionHeading id="family-title" eyebrow="With the blessings of" title="Our families" />
        <div ref={box} className="min-h-[7rem] sm:min-h-[12rem]">
          {near && (
            <Suspense fallback={null}>
              <FamilyPortraits variant="teaser" />
            </Suspense>
          )}
        </div>
        <Link to="/family" className="btn-outline mt-10">
          Meet the family
        </Link>
      </div>
    </section>
  );
}
