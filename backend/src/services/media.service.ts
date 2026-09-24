import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { MediaAsset, MediaPurpose, Prisma } from '@prisma/client';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import {
  EXTENSION_MIME,
  UPLOAD_LIMITS,
  fileExtension,
  kindForMime,
  maxBytesFor,
  type MediaDTO,
  type Paginated,
  type mediaListQuerySchema,
  type mediaUpdateSchema,
} from '@wedding/shared';
import type { z } from 'zod';
import { env } from '../config/env';
import { AppError, badRequest, notFound, tooLarge, unsupported } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { broker } from '../realtime/sseBroker';
import { StorageKeys, storage } from '../storage';
import { toMediaDTO, type Variants } from './mappers';

const execFileAsync = promisify(execFile);

/** Aliases returned by magic-byte sniffing that we treat as an allowed canonical type. */
const SNIFF_ALIASES: Record<string, string> = {
  'video/x-m4v': 'video/mp4',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heif',
};

export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface UploadOptions {
  purpose: MediaPurpose;
  albumId?: string | null;
  eventId?: string | null;
  caption?: string | null;
  isPublished?: boolean;
  guest?: boolean;
  allowVideo?: boolean;
  allowDocument?: boolean;
  uploadedById?: string | null;
}

interface ValidatedFile {
  mime: string;
  ext: string;
  kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

/**
 * Authoritative validation: extension allow-list, magic-byte sniffing (the
 * declared Content-Type is never trusted), per-type size limits. Anything that
 * sniffs as an executable, script, SVG, HTML, archive etc. is rejected because
 * it cannot map to an allowed type.
 */
export async function validateFile(file: IncomingFile, opts: Pick<UploadOptions, 'guest' | 'allowVideo' | 'allowDocument'>): Promise<ValidatedFile> {
  const ext = fileExtension(file.originalname);
  const allowedForExt = EXTENSION_MIME[ext];
  if (!allowedForExt) throw unsupported(`“.${ext || 'unknown'}” files are not supported`);

  const sniffed = await fileTypeFromBuffer(file.buffer);
  if (!sniffed) throw unsupported('We could not recognise this file');
  const mime = SNIFF_ALIASES[sniffed.mime] ?? sniffed.mime;
  if (!allowedForExt.includes(mime)) throw unsupported('The file contents do not match its extension');

  const kind = kindForMime(mime);
  if (!kind) throw unsupported('This file type is not allowed');
  if (kind === 'VIDEO' && (opts.allowVideo === false || opts.guest)) throw unsupported('Videos are not allowed here');
  if (kind === 'DOCUMENT' && !opts.allowDocument) throw unsupported('Documents are not allowed here');

  const max = maxBytesFor(kind, opts.guest);
  if (file.size > max || file.buffer.length > max) {
    throw tooLarge(`File is too large (max ${Math.round(max / 1024 / 1024)} MB)`);
  }
  return { mime, ext, kind };
}

function keyDirFor(purpose: MediaPurpose, albumSlug: string | null, id: string): string {
  switch (purpose) {
    case 'GALLERY':
      return StorageKeys.gallery(albumSlug ?? 'unsorted', id);
    case 'LIVE':
      return StorageKeys.live(id);
    case 'GUESTBOOK':
      return StorageKeys.guestbook(id);
    case 'BRANDING':
      return StorageKeys.branding(id);
    case 'DRESSCODE':
      return StorageKeys.dresscode(id);
    case 'STORY':
      return StorageKeys.story(id);
  }
}

async function processImage(buffer: Buffer, dir: string) {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer, { limitInputPixels: UPLOAD_LIMITS.imageMaxPixels }).metadata();
  } catch {
    throw unsupported('We could not read this image. Please upload a JPEG, PNG or WebP.');
  }
  if (!meta.width || !meta.height) throw unsupported('We could not read this image');
  if (meta.width * meta.height > UPLOAD_LIMITS.imageMaxPixels) throw tooLarge('Image dimensions are too large');
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  if (Math.min(width, height) < UPLOAD_LIMITS.imageMinDimension) {
    throw badRequest(`Image is too small (minimum ${UPLOAD_LIMITS.imageMinDimension}px)`);
  }

  const base = () => sharp(buffer, { limitInputPixels: UPLOAD_LIMITS.imageMaxPixels }).rotate();
  const render = async (name: 'thumb' | 'medium', targetWidth: number, quality: number) => {
    const { data, info } = await base()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer({ resolveWithObject: true });
    const key = `${dir}/${name}.webp`;
    await storage().put(key, data, 'image/webp');
    return { key, width: info.width, height: info.height, mime: 'image/webp' };
  };
  const variants: Variants = {
    thumb: await render('thumb', 640, 72),
    medium: await render('medium', 1800, 80),
  };
  const tiny = await base().resize({ width: 24 }).blur(1).webp({ quality: 40 }).toBuffer();
  return {
    width,
    height,
    variants,
    placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
  };
}

async function probeVideo(buffer: Buffer, ext: string, dir: string) {
  const tmp = path.join(os.tmpdir(), `upload-${randomUUID()}.${ext}`);
  await fs.writeFile(tmp, buffer);
  try {
    let duration: number | null = null;
    let width: number | null = null;
    let height: number | null = null;
    try {
      const { stdout } = await execFileAsync(env.FFPROBE_PATH, [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:format=duration',
        '-of', 'json',
        tmp,
      ], { timeout: 30_000 });
      const info = JSON.parse(stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
      duration = info.format?.duration ? Number(info.format.duration) : null;
      width = info.streams?.[0]?.width ?? null;
      height = info.streams?.[0]?.height ?? null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('ffprobe not available — skipping video duration validation');
      } else {
        throw unsupported('We could not read this video');
      }
    }
    if (duration !== null && duration > UPLOAD_LIMITS.videoMaxDurationSeconds) {
      throw badRequest(`Videos must be shorter than ${UPLOAD_LIMITS.videoMaxDurationSeconds / 60} minutes`);
    }

    // Poster frame (best effort) so galleries never load the video just to show a thumbnail.
    let variants: Variants = {};
    let placeholder: string | null = null;
    try {
      const posterPath = `${tmp}.jpg`;
      await execFileAsync(env.FFPROBE_PATH.replace(/ffprobe$/, 'ffmpeg'), [
        '-y', '-ss', duration && duration > 2 ? '1' : '0', '-i', tmp, '-frames:v', '1', '-q:v', '3', posterPath,
      ], { timeout: 30_000 });
      const poster = await fs.readFile(posterPath);
      await fs.rm(posterPath, { force: true });
      const { data, info } = await sharp(poster).resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
      const key = `${dir}/poster.webp`;
      await storage().put(key, data, 'image/webp');
      variants = { poster: { key, width: info.width, height: info.height, mime: 'image/webp' } };
      const tiny = await sharp(poster).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
      placeholder = `data:image/webp;base64,${tiny.toString('base64')}`;
    } catch {
      logger.debug('video poster generation skipped');
    }
    return { duration, width, height, variants, placeholder };
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

const listInclude = { event: { select: { id: true, name: true, slug: true } } } satisfies Prisma.MediaAssetInclude;

export const mediaService = {
  async upload(file: IncomingFile, opts: UploadOptions): Promise<MediaAsset> {
    const { mime, ext, kind } = await validateFile(file, opts);

    let albumSlug: string | null = null;
    let eventId = opts.eventId ?? null;
    if (opts.albumId) {
      const album = await prisma.album.findUnique({ where: { id: opts.albumId } });
      if (!album) throw badRequest('Album not found');
      albumSlug = album.slug;
      eventId = eventId ?? album.eventId;
    } else if (eventId && opts.purpose === 'GALLERY') {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      albumSlug = event?.slug ?? null;
    }

    const id = randomUUID();
    const dir = keyDirFor(opts.purpose, albumSlug, id);
    const storageKey = `${dir}/original.${ext === 'jpeg' ? 'jpg' : ext}`;

    let processed: { width: number | null; height: number | null; duration?: number | null; variants: Variants; placeholder: string | null } = {
      width: null,
      height: null,
      variants: {},
      placeholder: null,
    };
    const writtenKeys: string[] = [];
    try {
      if (kind === 'IMAGE') processed = await processImage(file.buffer, dir);
      else if (kind === 'VIDEO') processed = await probeVideo(file.buffer, ext, dir);
      Object.values(processed.variants).forEach((v) => v && writtenKeys.push(v.key));

      await storage().put(storageKey, file.buffer, mime);
      writtenKeys.push(storageKey);

      const maxOrder = await prisma.mediaAsset.aggregate({
        where: { albumId: opts.albumId ?? undefined, purpose: opts.purpose },
        _max: { displayOrder: true },
      });

      return await prisma.mediaAsset.create({
        data: {
          storageKey,
          storageDriver: storage().driver,
          variants: processed.variants as Prisma.InputJsonValue,
          placeholder: processed.placeholder,
          originalFilename: file.originalname.slice(0, 255),
          mimeType: mime,
          size: file.size,
          width: processed.width,
          height: processed.height,
          duration: processed.duration ?? null,
          type: kind,
          purpose: opts.purpose,
          eventId,
          albumId: opts.albumId ?? null,
          caption: opts.caption ?? null,
          isPublished: opts.isPublished ?? true,
          displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
          uploadedById: opts.uploadedById ?? null,
        },
      });
    } catch (err) {
      await Promise.all(writtenKeys.map((k) => storage().delete(k).catch(() => undefined)));
      if (err instanceof AppError) throw err;
      logger.error({ err }, 'media upload failed');
      throw new AppError(500, 'UPLOAD_FAILED', 'The upload could not be completed. Please try again.');
    }
  },

  async list(query: z.output<typeof mediaListQuerySchema>, admin = true): Promise<Paginated<MediaDTO>> {
    const where: Prisma.MediaAssetWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.eventId) where.eventId = query.eventId;
    if (query.albumId) where.albumId = query.albumId;
    if (query.purpose) where.purpose = query.purpose;
    if (query.q) {
      where.OR = [
        { originalFilename: { contains: query.q, mode: 'insensitive' } },
        { caption: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: await Promise.all(rows.map((r) => toMediaDTO(r, { admin }))),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async get(id: string) {
    const row = await prisma.mediaAsset.findUnique({ where: { id }, include: listInclude });
    if (!row) throw notFound('Media');
    return row;
  },

  async update(id: string, input: z.output<typeof mediaUpdateSchema>): Promise<MediaDTO> {
    const existing = await this.get(id);
    const row = await prisma.mediaAsset.update({ where: { id }, data: input, include: listInclude });
    if (!existing.isPublished && row.isPublished && row.purpose === 'GALLERY') {
      broker.publish('MEDIA_PUBLISHED', { eventId: row.eventId, postId: row.id });
    }
    return toMediaDTO(row, { admin: true });
  },

  async reorder(ids: string[]): Promise<void> {
    await prisma.$transaction(ids.map((id, i) => prisma.mediaAsset.update({ where: { id }, data: { displayOrder: i + 1 } })));
  },

  async remove(id: string): Promise<void> {
    const asset = await this.get(id);
    const variants = (asset.variants ?? {}) as Variants;
    await prisma.mediaAsset.delete({ where: { id } });
    const keys = [asset.storageKey, ...Object.values(variants).map((v) => v?.key)].filter(Boolean) as string[];
    await Promise.all(
      keys.map((k) => storage().delete(k).catch((err) => logger.warn({ err, key: k }, 'failed to delete media object'))),
    );
  },
};
