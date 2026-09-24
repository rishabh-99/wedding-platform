import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { LiveUpdateDTO, RealtimeMessage } from '@wedding/shared';
import { api } from '../services/api';
import { keys } from '../services/queries';

export type LiveConnectionState = 'connecting' | 'open' | 'reconnecting' | 'polling';

export interface LiveStreamOptions {
  url?: string;
  /** Consecutive failures before falling back to polling. */
  maxFailures?: number;
  pollIntervalMs?: number;
  /** Reconnect if nothing (not even a heartbeat) arrives for this long. */
  staleAfterMs?: number;
  /** Injected for tests. */
  EventSourceImpl?: typeof EventSource | undefined;
}

/** Inserts or replaces a post in every cached live list it belongs to (newest first, no duplicates). */
export function mergeLiveUpdate(qc: QueryClient, post: LiveUpdateDTO) {
  const upsert = (list: LiveUpdateDTO[] | undefined) => {
    if (!list) return list;
    const without = list.filter((p) => p.id !== post.id);
    return [post, ...without].sort(
      (a, b) => Date.parse(b.publishedAt ?? b.createdAt) - Date.parse(a.publishedAt ?? a.createdAt),
    );
  };
  qc.setQueryData<LiveUpdateDTO[]>(keys.live(), upsert);
  if (post.eventId) qc.setQueryData<LiveUpdateDTO[]>(keys.live(post.eventId), upsert);
}

export function removeLiveUpdate(qc: QueryClient, postId: string) {
  qc.setQueriesData<LiveUpdateDTO[]>({ queryKey: keys.liveAll }, (list) => list?.filter((p) => p.id !== postId));
}

/**
 * Subscribes to /api/live/stream (Server-Sent Events).
 *  - de-duplicates messages by id (replays after reconnect are harmless);
 *  - reconnects with exponential backoff after errors or server restarts;
 *  - watchdog reconnects silently-dead connections (heartbeats every ~25s);
 *  - when the tab becomes visible again it refetches and reconnects;
 *  - falls back to polling when SSE is unavailable or keeps failing.
 */
export function useLiveStream(options: LiveStreamOptions = {}): LiveConnectionState {
  const {
    url = '/api/live/stream',
    maxFailures = 3,
    pollIntervalMs = 20_000,
    staleAfterMs = 70_000,
  } = options;
  const ESImpl = 'EventSourceImpl' in options ? options.EventSourceImpl : typeof EventSource !== 'undefined' ? EventSource : undefined;
  const qc = useQueryClient();
  const [state, setState] = useState<LiveConnectionState>(ESImpl ? 'connecting' : 'polling');
  const seen = useRef(new Set<number>());
  const lastId = useRef<number | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let failures = 0;
    let reconnectTimer: number | undefined;
    let pollTimer: number | undefined;
    let watchdog: number | undefined;
    let lastActivity = Date.now();
    let disposed = false;

    const refreshAll = () => {
      void qc.invalidateQueries({ queryKey: keys.liveAll });
      void qc.invalidateQueries({ queryKey: keys.schedule });
    };

    const handleMessage = async (msg: RealtimeMessage) => {
      if (seen.current.has(msg.id)) return;
      seen.current.add(msg.id);
      if (seen.current.size > 500) seen.current = new Set([...seen.current].slice(-200));
      lastId.current = msg.id;

      switch (msg.type) {
        case 'LIVE_UPDATE_CREATED':
        case 'LIVE_UPDATE_UPDATED':
          if (msg.postId) {
            try {
              mergeLiveUpdate(qc, await api.get<LiveUpdateDTO>(`/api/live/${msg.postId}`));
            } catch {
              void qc.invalidateQueries({ queryKey: keys.liveAll });
            }
          }
          break;
        case 'LIVE_UPDATE_DELETED':
          if (msg.postId) removeLiveUpdate(qc, msg.postId);
          break;
        case 'SCHEDULE_CHANGED':
          void qc.invalidateQueries({ queryKey: keys.events });
          void qc.invalidateQueries({ queryKey: keys.schedule });
          void qc.invalidateQueries({ queryKey: keys.venues });
          void qc.invalidateQueries({ queryKey: ['event'] });
          break;
        case 'MEDIA_PUBLISHED':
          void qc.invalidateQueries({ queryKey: keys.galleryAll });
          void qc.invalidateQueries({ queryKey: keys.albums });
          break;
        case 'SETTINGS_CHANGED':
          void qc.invalidateQueries({ queryKey: keys.settings });
          break;
      }
    };

    const startPolling = () => {
      setState('polling');
      window.clearInterval(pollTimer);
      pollTimer = window.setInterval(refreshAll, pollIntervalMs);
      // Periodically try SSE again in case the network/proxy recovered.
      window.clearTimeout(reconnectTimer);
      if (ESImpl) reconnectTimer = window.setTimeout(() => connect(), 120_000);
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      es?.close();
      es = null;
      failures += 1;
      if (failures >= maxFailures) return startPolling();
      setState('reconnecting');
      const delay = Math.min(30_000, 1000 * 2 ** failures) + Math.random() * 500;
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, delay);
    };

    function connect() {
      if (disposed || !ESImpl) return;
      es?.close();
      const target = lastId.current ? `${url}?lastEventId=${lastId.current}` : url;
      es = new ESImpl(target);
      lastActivity = Date.now();

      es.addEventListener('open', () => {
        lastActivity = Date.now();
        const wasDegraded = failures > 0;
        failures = 0;
        window.clearInterval(pollTimer);
        setState('open');
        if (wasDegraded) refreshAll(); // catch up on anything missed while offline
      });
      es.addEventListener('message', (e) => {
        lastActivity = Date.now();
        try {
          void handleMessage(JSON.parse((e as MessageEvent).data) as RealtimeMessage);
        } catch {
          /* malformed payload — ignore */
        }
      });
      es.addEventListener('ping', () => (lastActivity = Date.now()));
      es.addEventListener('hello', () => (lastActivity = Date.now()));
      es.addEventListener('resync', refreshAll);
      es.addEventListener('shutdown', () => {
        // Server is restarting — reconnect shortly (the replay buffer may be gone, so resync).
        es?.close();
        setState('reconnecting');
        window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => {
          connect();
          refreshAll();
        }, 3000);
      });
      es.addEventListener('error', () => {
        // readyState CONNECTING = the browser is auto-retrying; CLOSED = it gave up (e.g. HTTP error).
        if (es && es.readyState === 2) scheduleReconnect();
        else setState('reconnecting');
      });
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      refreshAll();
      if (ESImpl && (!es || es.readyState === 2 || Date.now() - lastActivity > staleAfterMs)) {
        failures = 0;
        connect();
      }
    };

    if (ESImpl) {
      connect();
      watchdog = window.setInterval(() => {
        if (es && document.visibilityState === 'visible' && Date.now() - lastActivity > staleAfterMs) {
          scheduleReconnect();
        }
      }, 15_000);
    } else {
      startPolling();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onVisibility);

    return () => {
      disposed = true;
      es?.close();
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pollTimer);
      window.clearInterval(watchdog);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onVisibility);
    };
  }, [qc, url, maxFailures, pollIntervalMs, staleAfterMs, ESImpl]);

  return state;
}
