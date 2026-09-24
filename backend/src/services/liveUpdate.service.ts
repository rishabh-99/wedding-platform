import type { LiveUpdateType, Prisma } from '@prisma/client';
import type { LiveUpdateDTO, LiveUpdateStatus, liveUpdateInputSchema } from '@wedding/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { broker } from '../realtime/sseBroker';
import { toLiveUpdateDTO } from './mappers';

type LiveInput = z.output<typeof liveUpdateInputSchema>;

const include = {
  event: { select: { id: true, name: true, slug: true } },
  mediaAsset: true,
} satisfies Prisma.LiveUpdateInclude;

async function resolveMediaType(input: LiveInput): Promise<LiveUpdateType> {
  if (!input.mediaAssetId) return input.type;
  const media = await prisma.mediaAsset.findUnique({ where: { id: input.mediaAssetId } });
  if (!media) throw badRequest('Attached media no longer exists');
  if (input.type === 'TEXT') return media.type === 'VIDEO' ? 'VIDEO' : 'PHOTO';
  return input.type;
}

function publicationFields(input: LiveInput, existing?: { published: boolean; publishedAt: Date | null }) {
  switch (input.action) {
    case 'publish':
      return {
        published: true,
        publishedAt: existing?.published && existing.publishedAt ? existing.publishedAt : new Date(),
        scheduledFor: null,
      };
    case 'schedule': {
      const when = new Date(input.scheduledFor!);
      if (when.getTime() <= Date.now()) return { published: true, publishedAt: new Date(), scheduledFor: null };
      return { published: false, publishedAt: null, scheduledFor: when };
    }
    default:
      return { published: false, publishedAt: null, scheduledFor: null };
  }
}

export const liveUpdateService = {
  async listPublic(opts: { eventId?: string; since?: Date; limit?: number; before?: Date } = {}): Promise<LiveUpdateDTO[]> {
    const where: Prisma.LiveUpdateWhereInput = { published: true };
    if (opts.eventId) where.eventId = opts.eventId;
    if (opts.since || opts.before) {
      where.publishedAt = {
        ...(opts.since ? { gt: opts.since } : {}),
        ...(opts.before ? { lt: opts.before } : {}),
      };
    }
    const rows = await prisma.liveUpdate.findMany({
      where,
      include,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(opts.limit ?? 50, 200),
    });
    return Promise.all(rows.map(toLiveUpdateDTO));
  },

  async getPublic(id: string): Promise<LiveUpdateDTO> {
    const row = await prisma.liveUpdate.findUnique({ where: { id }, include });
    if (!row || !row.published) throw notFound('Update');
    return toLiveUpdateDTO(row);
  },

  async listAdmin(status?: LiveUpdateStatus): Promise<LiveUpdateDTO[]> {
    const where: Prisma.LiveUpdateWhereInput =
      status === 'PUBLISHED'
        ? { published: true }
        : status === 'SCHEDULED'
          ? { published: false, scheduledFor: { not: null } }
          : status === 'DRAFT'
            ? { published: false, scheduledFor: null }
            : {};
    const rows = await prisma.liveUpdate.findMany({
      where,
      include,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });
    return Promise.all(rows.map(toLiveUpdateDTO));
  },

  async create(input: LiveInput): Promise<LiveUpdateDTO> {
    const type = await resolveMediaType(input);
    const row = await prisma.liveUpdate.create({
      data: {
        eventId: input.eventId,
        type,
        title: input.title,
        content: input.content,
        mediaAssetId: input.mediaAssetId,
        ...publicationFields(input),
      },
      include,
    });
    const dto = await toLiveUpdateDTO(row);
    if (row.published) broker.publish('LIVE_UPDATE_CREATED', { eventId: row.eventId, postId: row.id, post: dto });
    return dto;
  },

  async update(id: string, input: LiveInput): Promise<LiveUpdateDTO> {
    const existing = await prisma.liveUpdate.findUnique({ where: { id } });
    if (!existing) throw notFound('Update');
    const type = await resolveMediaType(input);
    const row = await prisma.liveUpdate.update({
      where: { id },
      data: {
        eventId: input.eventId,
        type,
        title: input.title,
        content: input.content,
        mediaAssetId: input.mediaAssetId,
        ...publicationFields(input, existing),
      },
      include,
    });
    const dto = await toLiveUpdateDTO(row);
    this.broadcastTransition(existing.published, dto);
    return dto;
  },

  async setPublished(id: string, published: boolean): Promise<LiveUpdateDTO> {
    const existing = await prisma.liveUpdate.findUnique({ where: { id } });
    if (!existing) throw notFound('Update');
    const row = await prisma.liveUpdate.update({
      where: { id },
      data: published
        ? { published: true, publishedAt: existing.publishedAt ?? new Date(), scheduledFor: null }
        : { published: false, scheduledFor: null },
      include,
    });
    const dto = await toLiveUpdateDTO(row);
    this.broadcastTransition(existing.published, dto);
    return dto;
  },

  async remove(id: string): Promise<void> {
    const existing = await prisma.liveUpdate.findUnique({ where: { id } });
    if (!existing) throw notFound('Update');
    await prisma.liveUpdate.delete({ where: { id } });
    if (existing.published) broker.publish('LIVE_UPDATE_DELETED', { eventId: existing.eventId, postId: id });
  },

  /** Publishes scheduled posts whose time has come. Called by the scheduler. */
  async publishDue(now: Date = new Date()): Promise<number> {
    const due = await prisma.liveUpdate.findMany({
      where: { published: false, scheduledFor: { lte: now } },
      select: { id: true, eventId: true, scheduledFor: true },
    });
    for (const post of due) {
      // Conditional update guards against double-publishing if two ticks overlap.
      const { count } = await prisma.liveUpdate.updateMany({
        where: { id: post.id, published: false },
        data: { published: true, publishedAt: post.scheduledFor ?? now, scheduledFor: null },
      });
      if (!count) continue;
      const row = await prisma.liveUpdate.findUnique({ where: { id: post.id }, include });
      const dto = row ? await toLiveUpdateDTO(row) : undefined;
      broker.publish('LIVE_UPDATE_CREATED', { eventId: post.eventId, postId: post.id, post: dto });
    }
    return due.length;
  },

  broadcastTransition(wasPublished: boolean, post: LiveUpdateDTO) {
    const base = { eventId: post.eventId, postId: post.id };
    if (!wasPublished && post.published) broker.publish('LIVE_UPDATE_CREATED', { ...base, post });
    else if (wasPublished && !post.published) broker.publish('LIVE_UPDATE_DELETED', base);
    else if (post.published) broker.publish('LIVE_UPDATE_UPDATED', { ...base, post });
  },
};
