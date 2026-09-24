import { lazy, Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Concierge } from '../components/concierge/Concierge';
import { ErrorBoundary, LoadingBlock } from '../components/ui/primitives';
import { useSettings } from '../services/queries';
import { LiveProvider, useLiveConnection } from './LiveContext';
import { Footer, MobileNav, SiteHeader } from './Navigation';

// Development-only time simulator. `import.meta.env.DEV` is `false` in production builds,
// so this branch — and the dynamic import — are removed from the bundle entirely.
const Simulator = import.meta.env.DEV ? lazy(() => import('../dev/Simulator')) : null;

function ConnectionNotice() {
  const state = useLiveConnection();
  const show = state === 'reconnecting';
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-[9.5rem] left-1/2 z-40 -translate-x-1/2 border border-gold/40 bg-ivory px-4 py-2 text-xs text-ink-soft shadow-paper md:bottom-24"
        >
          Live connection lost — reconnecting…
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function GuestLayout() {
  const { data: settings } = useSettings();
  const location = useLocation();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (settings?.siteTitle) document.title = settings.siteTitle;
  }, [settings?.siteTitle]);

  return (
    <LiveProvider>
      <ScrollToTop />
      <SiteHeader />
      <ErrorBoundary>
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="main"
            key={location.pathname}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="min-h-[70vh]"
          >
            <Suspense
              fallback={
                <div className="container-page py-24">
                  <LoadingBlock lines={4} />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </ErrorBoundary>
      <Footer />
      {settings?.sections.concierge !== false && <Concierge />}
      <MobileNav />
      <ConnectionNotice />
      {Simulator && (
        <Suspense fallback={null}>
          <Simulator />
        </Suspense>
      )}
    </LiveProvider>
  );
}
