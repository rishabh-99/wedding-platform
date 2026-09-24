import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * A shared clock corrected by the server's time (guests' phones are often a
 * few minutes off) and, in development, shiftable to any moment of the wedding
 * via the Simulator panel or `?now=2026-12-03T21:30+05:30`, so every phase can
 * be previewed without touching data.
 */
export interface ClockValue {
  now: Date;
  offsetMs: number;
  setServerTime: (iso: string) => void;
  isTimeTravel: boolean;
  /** Development only: jump to a moment (null = back to real time). Ignored in production builds. */
  setSimulatedTime: (target: Date | null) => void;
}

export const ClockContext = createContext<ClockValue | null>(null);

const TIME_TRAVEL_KEY = 'wedding.timeTravel';
const timeTravelAllowed = () => import.meta.env.DEV || import.meta.env.MODE === 'test';

export function readTimeTravelOffset(): number | null {
  if (!timeTravelAllowed()) return null;
  try {
    const param = new URLSearchParams(window.location.search).get('now');
    if (param === 'reset') {
      sessionStorage.removeItem(TIME_TRAVEL_KEY);
      return null;
    }
    if (param) {
      const target = Date.parse(param);
      if (!Number.isNaN(target)) {
        const offset = target - Date.now();
        sessionStorage.setItem(TIME_TRAVEL_KEY, String(offset));
        return offset;
      }
    }
    const stored = sessionStorage.getItem(TIME_TRAVEL_KEY);
    return stored ? Number(stored) : null;
  } catch {
    return null;
  }
}

export function useClockState(tickMs = 1000): ClockValue {
  const [timeTravel, setTimeTravel] = useState(readTimeTravelOffset);
  const [serverOffset, setServerOffset] = useState(0);
  const offsetMs = timeTravel ?? serverOffset;
  const [now, setNow] = useState(() => new Date(Date.now() + offsetMs));

  useEffect(() => {
    const tick = () => setNow(new Date(Date.now() + offsetMs));
    tick();
    const id = window.setInterval(tick, tickMs);
    return () => window.clearInterval(id);
  }, [offsetMs, tickMs]);

  const setSimulatedTime = useCallback((target: Date | null) => {
    if (!timeTravelAllowed()) return;
    try {
      if (target) sessionStorage.setItem(TIME_TRAVEL_KEY, String(target.getTime() - Date.now()));
      else sessionStorage.removeItem(TIME_TRAVEL_KEY);
    } catch {
      /* private mode — still works for this tab */
    }
    setTimeTravel(target ? target.getTime() - Date.now() : null);
  }, []);

  return {
    now,
    offsetMs,
    isTimeTravel: timeTravel !== null,
    setSimulatedTime,
    setServerTime: (iso: string) => {
      const server = Date.parse(iso);
      if (Number.isNaN(server)) return;
      const diff = server - Date.now();
      // Ignore sub-2s differences (network latency noise).
      setServerOffset((prev) => (Math.abs(prev - diff) > 2000 ? diff : prev));
    },
  };
}

const realClock: ClockValue = {
  get now() {
    return new Date();
  },
  offsetMs: 0,
  isTimeTravel: false,
  setServerTime: () => undefined,
  setSimulatedTime: () => undefined,
};

export function useClock(): ClockValue {
  const ctx = useContext(ClockContext);
  if (!ctx) throw new Error('useClock must be used inside <ClockProvider>');
  return ctx;
}

/** Like useClock, but falls back to real time outside a provider (for shared hooks and tests). */
export function useOptionalClock(): ClockValue {
  return useContext(ClockContext) ?? realClock;
}
