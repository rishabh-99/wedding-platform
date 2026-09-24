import { logger } from '../lib/logger';
import { liveUpdateService } from '../services/liveUpdate.service';
import { broker } from './sseBroker';
import { eventService } from '../services/event.service';

/**
 * Background ticker:
 *  - publishes scheduled live updates when their time arrives;
 *  - announces schedule phase changes (event starts/ends) so open browsers
 *    refresh "What's Happening Now" exactly on time.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastPhaseKey: string | null = null;

  constructor(private readonly intervalMs = 20_000) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const published = await liveUpdateService.publishDue();
      if (published) logger.info({ published }, 'published scheduled live updates');

      const schedule = await eventService.schedule();
      const key = `${schedule.phase}:${schedule.current?.id ?? '-'}:${schedule.next?.id ?? '-'}`;
      if (this.lastPhaseKey !== null && this.lastPhaseKey !== key) {
        broker.publish('SCHEDULE_CHANGED', { eventId: schedule.current?.id ?? null });
      }
      this.lastPhaseKey = key;
    } catch (err) {
      logger.error({ err }, 'scheduler tick failed');
    } finally {
      this.running = false;
    }
  }
}

export const scheduler = new Scheduler();
