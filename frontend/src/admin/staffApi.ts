import { useQuery } from '@tanstack/react-query';
import type { ArrivalRowDTO, CheckInBoardDTO, PortraitBoardDTO, StaffGuestCardDTO, TeamUserDTO } from '@wedding/shared';
import { api, qs } from '../services/api';

export const staffKeys = {
  team: ['admin', 'team'] as const,
  checkin: (eventId?: string) => ['admin', 'checkin', eventId ?? 'auto'] as const,
  checkinAll: ['admin', 'checkin'] as const,
  portraits: (day?: string) => ['admin', 'portraits', day ?? 'auto'] as const,
  portraitsAll: ['admin', 'portraits'] as const,
  arrivals: (params: Record<string, unknown>) => ['admin', 'arrivals', params] as const,
  arrivalsAll: ['admin', 'arrivals'] as const,
  pass: (token: string) => ['admin', 'pass', token] as const,
};

export const useTeam = () => useQuery({ queryKey: staffKeys.team, queryFn: () => api.get<TeamUserDTO[]>('/api/admin/team') });

/** Refreshes every 15 s so several coordinators at the gate see each other's check-ins. */
export const useCheckInBoard = (eventId?: string) =>
  useQuery({
    queryKey: staffKeys.checkin(eventId),
    queryFn: () => api.get<CheckInBoardDTO>(`/api/admin/checkin${qs({ eventId })}`),
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  });

export const usePortraitBoard = (day?: string) =>
  useQuery({
    queryKey: staffKeys.portraits(day),
    queryFn: () => api.get<PortraitBoardDTO>(`/api/admin/portraits${qs({ day })}`),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

export const useArrivals = (params: { q?: string; needsTransport?: boolean }) =>
  useQuery({
    queryKey: staffKeys.arrivals(params),
    queryFn: () => api.get<ArrivalRowDTO[]>(`/api/admin/arrivals${qs({ q: params.q, needsTransport: params.needsTransport ? 'true' : undefined })}`),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

export const fetchPass = (token: string) => api.get<StaffGuestCardDTO>(`/api/admin/pass/${encodeURIComponent(token)}`);

/** Pulls the pass token out of a scanned value (full `/q/<token>` URL or the bare token). */
export function tokenFromScan(value: string): string {
  const trimmed = value.trim();
  const m = trimmed.match(/\/q\/([^/?#\s]+)/);
  return m ? decodeURIComponent(m[1]!) : trimmed;
}

/** Wedding-local day key (YYYY-MM-DD) for "today". */
export function todayKey(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const waHref = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
};
