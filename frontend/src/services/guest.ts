import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GuestPortalDTO, GuestTravelInput } from '@wedding/shared';
import { useOptionalClock } from '../hooks/useClock';
import { api, ApiError, qs, uploadWithProgress } from './api';

/**
 * The guest pass: families sign in with the phone number they RSVP'd with
 * (no password — nothing on it is private). The session is an httpOnly cookie.
 */
export const guestKey = ['guest'] as const;

/** While time-travelling in development, the pass shows what it would at that moment (e.g. post-wedding photos). */
function useNowParam(): string | undefined {
  const { now, isTimeTravel } = useOptionalClock();
  if (!isTimeTravel) return undefined;
  return new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString();
}

export function useGuest() {
  const now = useNowParam();
  return useQuery({
    queryKey: [...guestKey, now ?? 'live'],
    queryFn: async () => {
      try {
        return await api.get<GuestPortalDTO>(`/api/guest/me${qs({ now })}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 30_000,
  });
}

/** Cheap "is a family signed in on this device?" check for the menus. */
export function useGuestSignedIn(): boolean {
  const { data } = useQuery({
    queryKey: [...guestKey, 'session'],
    queryFn: () => api.get<{ signedIn: boolean }>('/api/guest/session'),
    staleTime: 5 * 60_000,
  });
  return !!data?.signedIn;
}

export function useGuestLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) => api.post<GuestPortalDTO>('/api/guest/login', { phone }),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKey }),
  });
}

export function useGuestLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/guest/logout'),
    onSuccess: () => {
      qc.setQueriesData({ queryKey: guestKey }, null);
      void qc.invalidateQueries({ queryKey: guestKey });
    },
  });
}

export function useUpdateTravel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GuestTravelInput) => api.put<GuestPortalDTO>('/api/guest/travel', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKey }),
  });
}

export interface UploadResult {
  results: { filename: string; ok: boolean; error?: string }[];
}

export function useGuestPhotoUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ files, onProgress }: { files: File[]; onProgress?: (f: number) => void }) => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      return uploadWithProgress<UploadResult>('/api/guest/photos', form, onProgress);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKey }),
  });
}
