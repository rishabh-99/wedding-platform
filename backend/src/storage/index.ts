import { env, type Env } from '../config/env';
import { LocalStorageProvider } from './LocalStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';
import type { StorageProvider } from './StorageProvider';

export * from './StorageProvider';
export { LocalStorageProvider } from './LocalStorageProvider';
export { S3StorageProvider } from './S3StorageProvider';

/** Picks the storage provider from configuration (STORAGE_DRIVER=local|s3). */
export function createStorageProvider(config: Env = env): StorageProvider {
  if (config.STORAGE_DRIVER === 's3') {
    return new S3StorageProvider({
      bucket: config.S3_BUCKET!,
      region: config.S3_REGION!,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      prefix: config.S3_PREFIX,
      presignTtlSeconds: config.S3_PRESIGN_TTL_SECONDS,
      publicBaseUrl: config.S3_PUBLIC_BASE_URL,
    });
  }
  return new LocalStorageProvider(config.LOCAL_STORAGE_DIR, config.MEDIA_PUBLIC_PATH);
}

let instance: StorageProvider | null = null;

/** The application-wide storage service. Swappable in tests via setStorage(). */
export function storage(): StorageProvider {
  if (!instance) instance = createStorageProvider();
  return instance;
}

export function setStorage(provider: StorageProvider): void {
  instance = provider;
}

/** Standard key layout: wedding/gallery/<album>/…, wedding/live/…, wedding/guestbook/… */
export const StorageKeys = {
  gallery: (albumSlug: string, name: string) => `wedding/gallery/${albumSlug}/${name}`,
  live: (name: string) => `wedding/live/${name}`,
  guestbook: (name: string) => `wedding/guestbook/${name}`,
  branding: (name: string) => `wedding/branding/${name}`,
  dresscode: (name: string) => `wedding/dresscode/${name}`,
  story: (name: string) => `wedding/story/${name}`,
  portrait: (name: string) => `wedding/portraits/${name}`,
  misc: (name: string) => `wedding/misc/${name}`,
  backup: (name: string) => `private/backups/${name}`,
};
