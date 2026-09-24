import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  AccommodationDTO,
  AlbumDTO,
  BackupDTO,
  ContactDTO,
  RoomBoardDTO,
  DashboardDTO,
  EventDTO,
  FaqDTO,
  GuestbookDTO,
  LiveUpdateDTO,
  MediaDTO,
  Paginated,
  RsvpDTO,
  SessionUser,
  SettingsDTO,
  StorySectionDTO,
  TravelSectionDTO,
  VenueDTO,
} from '@wedding/shared';
import { DEFAULT_TIMEZONE } from '@wedding/shared';
import { api, qs } from '../services/api';
import { useSettings } from '../services/queries';
import { useToast } from './components/Toast';

export const adminKeys = {
  me: ['admin', 'me'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  events: ['admin', 'events'] as const,
  venues: ['admin', 'venues'] as const,
  live: (status?: string) => ['admin', 'live', status ?? 'all'] as const,
  media: (params: Record<string, unknown>) => ['admin', 'media', params] as const,
  albums: ['admin', 'albums'] as const,
  rsvps: (params: Record<string, unknown>) => ['admin', 'rsvps', params] as const,
  guestbook: (status?: string) => ['admin', 'guestbook', status ?? 'all'] as const,
  story: ['admin', 'story'] as const,
  travel: ['admin', 'travel'] as const,
  faq: ['admin', 'faq'] as const,
  settings: ['admin', 'settings'] as const,
  backups: ['admin', 'backups'] as const,
  accommodations: ['admin', 'accommodations'] as const,
  rooms: ['admin', 'rooms'] as const,
  contacts: ['admin', 'contacts'] as const,
};

export const useMe = () =>
  useQuery({
    queryKey: adminKeys.me,
    queryFn: () => api.get<{ user: SessionUser; csrfToken: string }>('/api/admin/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });

/** The wedding's display timezone (all admin dates are entered and shown in it). */
export function useWeddingTz(): string {
  const { data } = useSettings();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

export const useDashboard = () =>
  useQuery({ queryKey: adminKeys.dashboard, queryFn: () => api.get<DashboardDTO>('/api/admin/dashboard'), refetchInterval: 30_000 });
export const useAdminEvents = () => useQuery({ queryKey: adminKeys.events, queryFn: () => api.get<EventDTO[]>('/api/admin/events') });
export const useAdminVenues = () => useQuery({ queryKey: adminKeys.venues, queryFn: () => api.get<VenueDTO[]>('/api/admin/venues') });
export const useAdminLive = (status?: string) =>
  useQuery({ queryKey: adminKeys.live(status), queryFn: () => api.get<LiveUpdateDTO[]>(`/api/admin/live${qs({ status })}`) });
export const useAdminMedia = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: adminKeys.media(params), queryFn: () => api.get<Paginated<MediaDTO>>(`/api/admin/media${qs(params)}`) });
export const useAdminAlbums = () => useQuery({ queryKey: adminKeys.albums, queryFn: () => api.get<AlbumDTO[]>('/api/admin/albums') });
export const useAdminRsvps = (params: Record<string, string | number | undefined>) =>
  useQuery({
    queryKey: adminKeys.rsvps(params),
    queryFn: () => api.get<Paginated<RsvpDTO>>(`/api/admin/rsvps${qs(params)}`),
    placeholderData: (prev) => prev,
  });
export const useAdminGuestbook = (status?: string) =>
  useQuery({ queryKey: adminKeys.guestbook(status), queryFn: () => api.get<GuestbookDTO[]>(`/api/admin/guestbook${qs({ status })}`) });
export const useAdminStory = () => useQuery({ queryKey: adminKeys.story, queryFn: () => api.get<StorySectionDTO[]>('/api/admin/story') });
export const useAdminTravel = () => useQuery({ queryKey: adminKeys.travel, queryFn: () => api.get<TravelSectionDTO[]>('/api/admin/travel') });
export const useAdminFaq = () => useQuery({ queryKey: adminKeys.faq, queryFn: () => api.get<FaqDTO[]>('/api/admin/faq') });
export const useAdminSettings = () => useQuery({ queryKey: adminKeys.settings, queryFn: () => api.get<SettingsDTO>('/api/admin/settings') });
export const useAccommodations = () =>
  useQuery({ queryKey: adminKeys.accommodations, queryFn: () => api.get<AccommodationDTO[]>('/api/admin/accommodations') });
export const useRoomBoard = () => useQuery({ queryKey: adminKeys.rooms, queryFn: () => api.get<RoomBoardDTO>('/api/admin/rooms') });
export const useAdminContacts = () => useQuery({ queryKey: adminKeys.contacts, queryFn: () => api.get<ContactDTO[]>('/api/admin/contacts') });

export const useBackups = () => useQuery({ queryKey: adminKeys.backups, queryFn: () => api.get<BackupDTO[]>('/api/admin/backups') });

/**
 * Mutation helper: runs the request, invalidates the given admin + public
 * query prefixes, and shows a toast for success/failure.
 */
export function useAdminMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { invalidate?: QueryKey[]; success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      for (const key of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: adminKeys.dashboard });
      if (opts.success) toast.show(typeof opts.success === 'function' ? opts.success(result) : opts.success, 'success');
      opts.onSuccess?.(result);
    },
    onError: (err: Error) => toast.show(err.message || 'Something went wrong', 'error'),
  });
}
