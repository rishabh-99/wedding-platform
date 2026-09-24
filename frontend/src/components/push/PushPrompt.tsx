import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { usePush, type PushState } from '../../hooks/usePush';

const PROMPT_KEY = 'wedding.pushPrompt';
const INTRO_KEY = 'wedding.introSeen';

const store = {
  get(key: string, session = false): string | null {
    try {
      return (session ? sessionStorage : localStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode — the prompt may show again, which is fine */
    }
  },
};

function BellIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** iPhone/iPad: push only works once the site is on the Home Screen. */
function InstallSteps() {
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
      <li>
        Tap the <strong>Share</strong> button in Safari
      </li>
      <li>
        Choose <strong>Add to Home Screen</strong>
      </li>
      <li>Open the site from your Home Screen and turn on live updates</li>
    </ol>
  );
}

/**
 * First-visit suggestion to turn on live-update notifications. It appears once
 * (after the intro doors), and never again after "Turn on" or "Not now".
 */
export function PushPrompt() {
  const { state, enable, error } = usePush();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (store.get(PROMPT_KEY) || pathname.startsWith('/q/')) return;
    if (state !== 'default' && state !== 'needs-install') return;
    // Wait until the intro doors have opened (they set a session flag), then a short pause.
    const timer = window.setInterval(() => {
      if (pathname !== '/' || store.get(INTRO_KEY, true) === '1') {
        window.clearInterval(timer);
        window.setTimeout(() => setOpen(true), 2500);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [state, pathname]);

  const close = (value: string) => {
    store.set(PROMPT_KEY, value);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-labelledby="push-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-3 bottom-[4.75rem] z-[60] mx-auto max-w-md border border-gold/50 bg-ivory px-5 py-5 shadow-paper sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0"
        >
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon text-ivory">
              <BellIcon />
            </span>
            <div className="min-w-0">
              <p id="push-title" className="font-display text-xl text-maroon">
                Get live updates on your phone
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                We’ll send a gentle notification when something happens — the baraat is arriving, the pheras are starting, new photos are up.
              </p>
              {state === 'needs-install' && <InstallSteps />}
              {error && <p className="mt-2 text-sm text-maroon">{error}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {state === 'needs-install' ? (
                  <button type="button" className="btn-primary px-5 py-2" onClick={() => close('install')}>
                    Got it
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary px-5 py-2"
                    onClick={async () => {
                      await enable();
                      close('asked');
                    }}
                  >
                    Turn on live updates
                  </button>
                )}
                <button type="button" className="btn-ghost px-3 py-2" onClick={() => close('dismissed')}>
                  Not now
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

const STATE_TEXT: Record<PushState, string> = {
  loading: '',
  unsupported: 'This browser can’t show notifications. Keep this page open, or join the WhatsApp group for updates.',
  'needs-install': 'On iPhone, add this site to your Home Screen first, then turn on live updates from there.',
  default: 'Get a notification on this phone whenever there’s a live update.',
  denied: 'Notifications are blocked for this site. You can allow them in your browser’s site settings.',
  subscribed: 'Live updates are on for this device.',
};

/** Compact on/off control for the guest pass and the “Now” page. */
export function NotificationToggle({ className = '' }: { className?: string }) {
  const { state, enable, disable, error } = usePush();
  const [busy, setBusy] = useState(false);
  if (state === 'loading') return null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`flex flex-col gap-3 border border-gold/30 bg-ivory-50/80 px-4 py-4 sm:flex-row sm:items-center ${className}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state === 'subscribed' ? 'bg-maroon text-ivory' : 'bg-ivory-200 text-maroon'}`}>
        <BellIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg text-maroon">Live-update notifications</p>
        <p className="text-sm text-ink-soft">{STATE_TEXT[state]}</p>
        {state === 'needs-install' && <InstallSteps />}
        {error && <p className="mt-1 text-sm text-maroon">{error}</p>}
      </div>
      {state === 'default' && (
        <button type="button" disabled={busy} className="btn-primary shrink-0 px-5 py-2" onClick={() => run(enable)}>
          Turn on
        </button>
      )}
      {state === 'subscribed' && (
        <button type="button" disabled={busy} className="btn-outline shrink-0 px-5 py-2" onClick={() => run(disable)}>
          Turn off
        </button>
      )}
    </div>
  );
}
