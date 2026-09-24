import type { Readable } from 'node:stream';

/**
 * Storage abstraction. Application code only ever deals in opaque object keys
 * such as `wedding/gallery/sangeet/abc123.webp`; the provider decides where the
 * bytes live (local disk in development, S3 in production).
 */
export interface StoredObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface StorageProvider {
  readonly driver: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  getStream(key: string): Promise<{ stream: Readable; contentType?: string; size?: number }>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** URL a browser can use to fetch the object (presigned for private S3 buckets). */
  getUrl(key: string): Promise<string>;
  list(prefix: string): Promise<StoredObject[]>;
  /** Human-readable storage location (shown in the admin media library). */
  describe(key: string): string;
}

/** Keys under this prefix are never served publicly (e.g. database backups). */
export const PRIVATE_PREFIX = 'private/';

export function assertSafeKey(key: string): void {
  if (
    !key ||
    key.length > 512 ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.split('/').some((seg) => seg === '..' || seg === '.' || seg === '') ||
    !/^[A-Za-z0-9._\-/]+$/.test(key)
  ) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}
