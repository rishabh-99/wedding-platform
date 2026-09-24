import { useEffect, useMemo } from 'react';
import { computeSchedule, DEFAULT_TIMEZONE, type EventDTO, type ScheduleResult } from '@wedding/shared';
import { useEvents, useServerSchedule, useSettings } from '../services/queries';
import { useClock } from './useClock';

export interface ScheduleState extends ScheduleResult<EventDTO> {
  events: EventDTO[];
  timezone: string;
  isLoading: boolean;
  isError: boolean;
}

/**
 * "What is happening now?" — the frontend asks the backend for the events and
 * the settings, then runs the same shared schedule engine every second so the
 * countdown, LIVE state and archive transition happen on time without reloads.
 */
export function useSchedule(): ScheduleState {
  const { now, setServerTime } = useClock();
  const events = useEvents();
  const settings = useSettings();
  const server = useServerSchedule();

  useEffect(() => {
    if (server.data?.serverTime) setServerTime(server.data.serverTime);
  }, [server.data?.serverTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const timezone = settings.data?.timezone ?? DEFAULT_TIMEZONE;
  const liveMode = settings.data?.liveMode ?? 'AUTO';
  const list = useMemo(() => (events.data ?? []).filter((e) => e.status !== 'CANCELLED'), [events.data]);

  // Recompute at most once per second (the clock's resolution).
  const second = Math.floor(now.getTime() / 1000);
  const result = useMemo(
    () => computeSchedule(list, second * 1000, { timeZone: timezone, liveMode }),
    [list, second, timezone, liveMode],
  );

  return {
    ...result,
    events: list,
    timezone,
    isLoading: events.isLoading || settings.isLoading,
    isError: events.isError,
  };
}
