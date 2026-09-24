/**
 * Upload policy shared by the browser (pre-flight checks so users are not
 * uploading huge/invalid files) and the server (authoritative validation).
 */

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

export const EXTENSION_MIME: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  heic: ['image/heic', 'image/heif'],
  heif: ['image/heif', 'image/heic'],
  avif: ['image/avif'],
  mp4: ['video/mp4'],
  m4v: ['video/mp4'],
  mov: ['video/quicktime'],
  webm: ['video/webm'],
  pdf: ['application/pdf'],
};

export const UPLOAD_LIMITS = {
  imageMaxBytes: 25 * 1024 * 1024,
  videoMaxBytes: 200 * 1024 * 1024,
  documentMaxBytes: 20 * 1024 * 1024,
  guestImageMaxBytes: 10 * 1024 * 1024,
  imageMaxPixels: 12000 * 12000,
  imageMinDimension: 200,
  videoMaxDurationSeconds: 10 * 60,
  maxFilesPerRequest: 20,
} as const;

export type UploadKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : '';
}

export function kindForMime(mime: string): UploadKind | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return 'IMAGE';
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mime)) return 'VIDEO';
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(mime)) return 'DOCUMENT';
  return null;
}

export function maxBytesFor(kind: UploadKind, guest = false): number {
  if (guest) return UPLOAD_LIMITS.guestImageMaxBytes;
  return kind === 'IMAGE'
    ? UPLOAD_LIMITS.imageMaxBytes
    : kind === 'VIDEO'
      ? UPLOAD_LIMITS.videoMaxBytes
      : UPLOAD_LIMITS.documentMaxBytes;
}

export interface PreflightResult {
  ok: boolean;
  kind: UploadKind | null;
  error?: string;
}

/** Cheap client+server check on name/declared type/size. The server additionally sniffs magic bytes. */
export function preflightUpload(
  file: { name: string; type: string; size: number },
  options: { allowVideo?: boolean; allowDocument?: boolean; guest?: boolean } = {},
): PreflightResult {
  const ext = fileExtension(file.name);
  const allowedForExt = EXTENSION_MIME[ext];
  if (!allowedForExt) return { ok: false, kind: null, error: `“.${ext || '?'}” files are not supported` };
  const mime = file.type || allowedForExt[0]!;
  const kind = kindForMime(mime);
  if (!kind || !allowedForExt.includes(mime)) {
    return { ok: false, kind: null, error: 'File type does not match its extension' };
  }
  if (kind === 'VIDEO' && options.allowVideo === false) return { ok: false, kind, error: 'Videos are not allowed here' };
  if (kind === 'DOCUMENT' && !options.allowDocument) return { ok: false, kind, error: 'Documents are not allowed here' };
  const max = maxBytesFor(kind, options.guest);
  if (file.size > max) {
    return { ok: false, kind, error: `File is too large (max ${Math.round(max / 1024 / 1024)} MB)` };
  }
  if (file.size === 0) return { ok: false, kind, error: 'File is empty' };
  return { ok: true, kind };
}
