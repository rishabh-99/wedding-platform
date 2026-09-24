import { Prisma } from '@prisma/client';
import type { AlbumDTO, MediaDTO, Paginated, albumInputSchema } from '@wedding/shared';
import type { z } from 'zod';
import { conflict, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { toAlbumDTO, toMediaDTO } from './mappers';

const publicMedia = { isPublished: true, purpose: 'GALLERY' as const };

export const galleryService = {
  async listAlbums(includeHidden = false): Promise<AlbumDTO[]> {
    const albums = await prisma.album.findMany({
      where: includeHidden ? {} : { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { media: includeHidden ? true : { where: publicMedia } } },
        media: {
          where: { ...publicMedia, type: 'IMAGE' },
          orderBy: { displayOrder: 'asc' },
          take: 1,
        },
      },
    });
    return Promise.all(albums.map(toAlbumDTO));
  },

  /** Published gallery media, optionally by album slug or event id. Paged. */
  async listMedia(opts: { album?: string; eventId?: string; type?: 'IMAGE' | 'VIDEO'; page?: number; pageSize?: number }): Promise<Paginated<MediaDTO>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(Math.max(1, opts.pageSize ?? 40), 100);
    const where: Prisma.MediaAssetWhereInput = { ...publicMedia, type: opts.type ?? { in: ['IMAGE', 'VIDEO'] } };
    if (opts.album) {
      const album = await prisma.album.findUnique({ where: { slug: opts.album } });
      if (!album || !album.isPublished) throw notFound('Album');
      where.albumId = album.id;
    } else {
      where.OR = [{ albumId: null }, { album: { isPublished: true } }];
    }
    if (opts.eventId) where.eventId = opts.eventId;
    const [total, rows] = await Promise.all([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        include: { event: { select: { id: true, name: true, slug: true } } },
        orderBy: opts.album ? [{ displayOrder: 'asc' }, { createdAt: 'asc' }] : [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: await Promise.all(rows.map((r) => toMediaDTO(r))), total, page, pageSize };
  },

  async createAlbum(input: z.output<typeof albumInputSchema>): Promise<AlbumDTO> {
    try {
      return toAlbumDTO(await prisma.album.create({ data: input }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict('An album with this slug already exists');
      throw err;
    }
  },

  async updateAlbum(id: string, input: z.output<typeof albumInputSchema>): Promise<AlbumDTO> {
    if (!(await prisma.album.findUnique({ where: { id } }))) throw notFound('Album');
    try {
      return toAlbumDTO(await prisma.album.update({ where: { id }, data: input }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict('An album with this slug already exists');
      throw err;
    }
  },

  async deleteAlbum(id: string): Promise<void> {
    if (!(await prisma.album.findUnique({ where: { id } }))) throw notFound('Album');
    // Media are kept (albumId set null) so nothing is lost by deleting an album.
    await prisma.album.delete({ where: { id } });
  },

  async reorderAlbums(ids: string[]): Promise<void> {
    await prisma.$transaction(ids.map((id, i) => prisma.album.update({ where: { id }, data: { displayOrder: i + 1 } })));
  },
};
