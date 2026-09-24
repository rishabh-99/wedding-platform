import type { GuestbookStatus, Prisma } from '@prisma/client';
import type { GuestbookDTO, Paginated, guestbookAdminUpdateSchema } from '@wedding/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { toGuestbookDTO } from './mappers';
import { mediaService, type IncomingFile } from './media.service';

const include = { mediaAsset: true } satisfies Prisma.GuestbookMessageInclude;

export const guestbookService = {
  async listApproved(page = 1, pageSize = 30): Promise<Paginated<GuestbookDTO>> {
    const where = { status: 'APPROVED' as const };
    const [total, rows] = await Promise.all([
      prisma.guestbookMessage.count({ where }),
      prisma.guestbookMessage.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items: await Promise.all(rows.map(toGuestbookDTO)), total, page, pageSize };
  },

  async listAdmin(status?: GuestbookStatus): Promise<GuestbookDTO[]> {
    const rows = await prisma.guestbookMessage.findMany({
      where: status ? { status } : {},
      include,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return Promise.all(rows.map(toGuestbookDTO));
  },

  /** Guest submission — always PENDING until an admin approves it. */
  async submit(input: { guestName: string; message: string }, photo?: IncomingFile): Promise<GuestbookDTO> {
    let mediaAssetId: string | null = null;
    if (photo) {
      const asset = await mediaService.upload(photo, { purpose: 'GUESTBOOK', guest: true, allowVideo: false });
      if (asset.type !== 'IMAGE') throw badRequest('Only photographs can be attached');
      mediaAssetId = asset.id;
    }
    const row = await prisma.guestbookMessage.create({
      data: { guestName: input.guestName, message: input.message, mediaAssetId, status: 'PENDING' },
      include,
    });
    return toGuestbookDTO(row);
  },

  async update(id: string, input: z.output<typeof guestbookAdminUpdateSchema>): Promise<GuestbookDTO> {
    if (!(await prisma.guestbookMessage.findUnique({ where: { id } }))) throw notFound('Message');
    return toGuestbookDTO(await prisma.guestbookMessage.update({ where: { id }, data: input, include }));
  },

  async remove(id: string): Promise<void> {
    const row = await prisma.guestbookMessage.findUnique({ where: { id } });
    if (!row) throw notFound('Message');
    await prisma.guestbookMessage.delete({ where: { id } });
    if (row.mediaAssetId) await mediaService.remove(row.mediaAssetId).catch(() => undefined);
  },
};
