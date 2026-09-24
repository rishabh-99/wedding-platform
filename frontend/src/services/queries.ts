import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  AlbumDTO,
  ContactDTO,
  EventDTO,
  FaqDTO,
  GuestbookDTO,
  LiveUpdateDTO,
  MediaDTO,
  Paginated,
  ScheduleDTO,
  SettingsDTO,
  StorySectionDTO,
  TravelSectionDTO,
  VenueDTO,
} from '@wedding/shared';
import { useMemo } from 'react';
import { useOptionalClock } from '../hooks/useClock';
import { api, qs } from './api';

/** Query keys in one place so realtime events can invalidate precisely. */
export const keys = {
  settings: ['settings'] as const,
  schedule: ['schedule'] as const,
  events: ['events'] as const,
  event: (slug: string) => ['event', slug] as const,
  venues: ['venues'] as const,
  live: (eventId?: string) => ['live', eventId ?? 'all'] as const,
  liveAll: ['live'] as const,
  albums: ['albums'] as const,
  gallery: (album?: string) => ['gallery', album ?? 'all'] as const,
  galleryAll: ['gallery'] as const,
  guestbook: ['guestbook'] as const,
  story: ['story'] as const,
  travel: ['travel'] as const,
  faq: ['faq'] as const,
  contacts: ['contacts'] as const,
};

export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api.get<SettingsDTO>('/api/settings'), staleTime: 60_000 });

export const useServerSchedule = () =>
  useQuery({ queryKey: keys.schedule, queryFn: () => api.get<ScheduleDTO>('/api/schedule'), staleTime: 60_000 });

export const useEvents = () =>
  useQuery({ queryKey: keys.events, queryFn: () => api.get<EventDTO[]>('/api/events'), staleTime: 60_000 });

export const useEvent = (slug: string) =>
  useQuery({ queryKey: keys.event(slug), queryFn: () => api.get<EventDTO>(`/api/events/${encodeURIComponent(slug)}`) });

export const useVenues = () =>
  useQuery({ queryKey: keys.venues, queryFn: () => api.get<VenueDTO[]>('/api/venues'), staleTime: 5 * 60_000 });

export function useLiveUpdates(eventId?: string, limit = 50) {
  const query = useQuery({
    queryKey: keys.live(eventId),
    queryFn: () => api.get<LiveUpdateDTO[]>(`/api/live${qs({ eventId, limit })}`),
    staleTime: 30_000,
  });
  // While simulating a moment in development, hide posts "from the future" so the feed looks as it would then.
  const { now, isTimeTravel } = useOptionalClock();
  const minute = isTimeTravel ? Math.floor(now.getTime() / 60_000) : 0;
  const data = useMemo(
    () => (isTimeTravel && query.data ? query.data.filter((u) => Date.parse(u.publishedAt ?? u.createdAt) <= (minute + 1) * 60_000) : query.data),
    [query.data, isTimeTravel, minute],
  );
  return { ...query, data };
}

export const useAlbums = () =>
  useQuery({ queryKey: keys.albums, queryFn: () => api.get<AlbumDTO[]>('/api/albums'), staleTime: 60_000 });

export const useGallery = (album?: string, pageSize = 30) =>
  useInfiniteQuery({
    queryKey: keys.gallery(album),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<Paginated<MediaDTO>>(`/api/gallery${qs({ album, page: pageParam, pageSize })}`),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    staleTime: 60_000,
  });

export const useGuestbook = () =>
  useQuery({ queryKey: keys.guestbook, queryFn: () => api.get<Paginated<GuestbookDTO>>('/api/guestbook'), staleTime: 60_000 });

export const useStory = () =>
  useQuery({ queryKey: keys.story, queryFn: () => api.get<StorySectionDTO[]>('/api/story'), staleTime: 5 * 60_000 });

export const useTravel = () =>
  useQuery({ queryKey: keys.travel, queryFn: () => api.get<TravelSectionDTO[]>('/api/travel'), staleTime: 5 * 60_000 });

export const useContacts = () =>
  useQuery({ queryKey: keys.contacts, queryFn: () => api.get<ContactDTO[]>('/api/contacts'), staleTime: 5 * 60_000 });

export const useFaq = () =>
  useQuery({ queryKey: keys.faq, queryFn: () => api.get<FaqDTO[]>('/api/faq'), staleTime: 5 * 60_000 });
