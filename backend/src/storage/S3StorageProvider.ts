import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { assertSafeKey, type StorageProvider, type StoredObject } from './StorageProvider';

export interface S3ProviderOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  /** Optional key prefix, e.g. "prod/". */
  prefix?: string;
  presignTtlSeconds?: number;
  /** If set (e.g. a CloudFront distribution), URLs are built from it instead of presigning. */
  publicBaseUrl?: string;
  client?: S3Client;
}

/**
 * Stores objects in a private S3 bucket. Credentials come from the default AWS
 * provider chain (EC2 instance role recommended) and never reach the browser —
 * guests receive short-lived presigned GET URLs.
 */
export class S3StorageProvider implements StorageProvider {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>();
  private readonly ttl: number;

  constructor(private readonly opts: S3ProviderOptions) {
    const config: S3ClientConfig = { region: opts.region };
    if (opts.endpoint) config.endpoint = opts.endpoint;
    if (opts.forcePathStyle) config.forcePathStyle = true;
    this.client = opts.client ?? new S3Client(config);
    this.ttl = opts.presignTtlSeconds ?? 6 * 3600;
  }

  private fullKey(key: string): string {
    assertSafeKey(key);
    return `${this.opts.prefix ?? ''}${key}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.opts.bucket,
        Key: this.fullKey(key),
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async getStream(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: this.fullKey(key) }));
    return {
      stream: res.Body as Readable,
      contentType: res.ContentType,
      size: res.ContentLength,
    };
  }

  async delete(key: string): Promise<void> {
    this.urlCache.delete(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: this.fullKey(key) }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.opts.bucket, Key: this.fullKey(key) }));
      return true;
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (err as Error).name === 'NotFound') return false;
      throw err;
    }
  }

  async getUrl(key: string): Promise<string> {
    if (this.opts.publicBaseUrl) {
      return `${this.opts.publicBaseUrl.replace(/\/$/, '')}/${this.fullKey(key)}`;
    }
    const cached = this.urlCache.get(key);
    const now = Date.now();
    // Re-sign well before expiry so URLs handed to browsers stay valid for a while.
    if (cached && cached.expiresAt - now > (this.ttl * 1000) / 2) return cached.url;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.opts.bucket, Key: this.fullKey(key) }),
      { expiresIn: this.ttl },
    );
    this.urlCache.set(key, { url, expiresAt: now + this.ttl * 1000 });
    if (this.urlCache.size > 20000) this.urlCache.clear();
    return url;
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const out: StoredObject[] = [];
    let token: string | undefined;
    const base = this.opts.prefix ?? '';
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.opts.bucket, Prefix: `${base}${prefix}`, ContinuationToken: token }),
      );
      for (const obj of res.Contents ?? []) {
        if (!obj.Key) continue;
        out.push({ key: obj.Key.slice(base.length), size: obj.Size ?? 0, lastModified: obj.LastModified ?? new Date(0) });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  describe(key: string): string {
    return `s3://${this.opts.bucket}/${this.fullKey(key)}`;
  }
}
