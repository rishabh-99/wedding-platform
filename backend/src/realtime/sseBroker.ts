import type { Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import type { RealtimeEventType, RealtimeMessage } from '@wedding/shared';
import { logger } from '../lib/logger';

interface Client {
  id: number;
  res: Response;
}

/**
 * Server-Sent Events broker.
 *  - monotonic message ids + a replay buffer so reconnecting browsers (Last-Event-ID)
 *    receive anything they missed during a short disconnect;
 *  - heartbeat comments keep proxies/load balancers from closing idle connections;
 *  - `retry:` tells EventSource how quickly to reconnect after a server restart.
 * A single-process in-memory broker is right for a single small EC2 instance.
 */
export class SseBroker extends EventEmitter {
  private clients = new Map<number, Client>();
  private nextClientId = 1;
  private seq = Date.now();
  private buffer: RealtimeMessage[] = [];
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    private readonly options: { heartbeatMs?: number; bufferSize?: number; retryMs?: number } = {},
  ) {
    super();
  }

  get clientCount(): number {
    return this.clients.size;
  }

  start(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      // A named event (not a comment) so browsers can run a staleness watchdog.
      const ping = `event: ping\ndata: ${Date.now()}\n\n`;
      for (const client of this.clients.values()) this.write(client, ping);
    }, this.options.heartbeatMs ?? 25_000);
    this.heartbeat.unref();
  }

  /** Express handler for GET /api/live/stream */
  handle = (req: Request, res: Response): void => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders?.();

    const client: Client = { id: this.nextClientId++, res };
    this.clients.set(client.id, client);
    this.write(client, `retry: ${this.options.retryMs ?? 5000}\n`);
    this.write(client, `event: hello\ndata: ${JSON.stringify({ serverTime: new Date().toISOString(), lastId: this.seq })}\n\n`);

    const lastIdHeader = req.header('Last-Event-ID') ?? (req.query.lastEventId as string | undefined);
    const lastId = lastIdHeader ? Number(lastIdHeader) : NaN;
    if (Number.isFinite(lastId)) {
      const missed = this.buffer.filter((m) => m.id > lastId);
      if (missed.length === 0 && this.buffer.length && this.buffer[0]!.id > lastId + 1) {
        // Gap larger than our buffer (e.g. server restarted) — ask the client to resync everything.
        this.write(client, `event: resync\ndata: {}\n\n`);
      }
      for (const m of missed) this.send(client, m);
    }

    const cleanup = () => {
      this.clients.delete(client.id);
    };
    req.on('close', cleanup);
    res.on('error', cleanup);
  };

  publish(type: RealtimeEventType, payload: { eventId?: string | null; postId?: string | null } = {}): RealtimeMessage {
    const message: RealtimeMessage = {
      id: ++this.seq,
      type,
      eventId: payload.eventId ?? null,
      postId: payload.postId ?? null,
      timestamp: new Date().toISOString(),
    };
    this.buffer.push(message);
    const max = this.options.bufferSize ?? 200;
    if (this.buffer.length > max) this.buffer.splice(0, this.buffer.length - max);
    for (const client of this.clients.values()) this.send(client, message);
    this.emit('message', message);
    logger.debug({ type, clients: this.clients.size }, 'sse broadcast');
    return message;
  }

  private send(client: Client, message: RealtimeMessage): void {
    this.write(client, `id: ${message.id}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`);
  }

  private write(client: Client, chunk: string): void {
    try {
      client.res.write(chunk);
    } catch {
      this.clients.delete(client.id);
    }
  }

  /** Graceful shutdown: tell clients to reconnect later and end all streams. */
  close(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    for (const client of this.clients.values()) {
      try {
        client.res.write(`event: shutdown\ndata: {}\n\n`);
        client.res.end();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
  }
}

export const broker = new SseBroker();
