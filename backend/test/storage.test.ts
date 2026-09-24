import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';
import { LocalStorageProvider, S3StorageProvider, createStorageProvider } from '../src/storage';

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString();
}

describe('LocalStorageProvider', () => {
  const dir = path.join(os.tmpdir(), `wedding-storage-test-${Date.now()}`);
  const provider = new LocalStorageProvider(dir, '/media');

  afterAll(() => fs.rm(dir, { recursive: true, force: true }));

  it('puts, reads, lists and deletes objects', async () => {
    await provider.put('wedding/gallery/sangeet/a/original.jpg', Buffer.from('hello'), 'image/jpeg');
    expect(await provider.exists('wedding/gallery/sangeet/a/original.jpg')).toBe(true);
    const { stream, size } = await provider.getStream('wedding/gallery/sangeet/a/original.jpg');
    expect(size).toBe(5);
    expect(await streamToString(stream as Readable)).toBe('hello');
    expect(await provider.getUrl('wedding/gallery/sangeet/a/original.jpg')).toBe('/media/wedding/gallery/sangeet/a/original.jpg');
    const listed = await provider.list('wedding/gallery');
    expect(listed.map((o) => o.key)).toEqual(['wedding/gallery/sangeet/a/original.jpg']);
    await provider.delete('wedding/gallery/sangeet/a/original.jpg');
    expect(await provider.exists('wedding/gallery/sangeet/a/original.jpg')).toBe(false);
  });

  it('refuses path traversal and unsafe keys', async () => {
    await expect(provider.put('../escape.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow(/Unsafe/);
    await expect(provider.put('/abs/path.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow(/Unsafe/);
    await expect(provider.put('wedding/a/../../b.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow(/Unsafe/);
    await expect(provider.put('wedding/a b.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow(/Unsafe/);
  });
});

describe('S3StorageProvider', () => {
  const s3Mock = mockClient(S3Client);
  const client = new S3Client({ region: 'ap-south-1', credentials: { accessKeyId: 'AKIDTEST', secretAccessKey: 'secret' } });
  const provider = new S3StorageProvider({ bucket: 'wedding-bucket', region: 'ap-south-1', prefix: 'prod/', client, presignTtlSeconds: 3600 });

  beforeEach(() => s3Mock.reset());

  it('uploads with bucket, prefixed key, content type and encryption', async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    await provider.put('wedding/live/x/original.jpg', Buffer.from('img'), 'image/jpeg');
    const call = s3Mock.commandCalls(PutObjectCommand)[0]!.args[0].input;
    expect(call).toMatchObject({ Bucket: 'wedding-bucket', Key: 'prod/wedding/live/x/original.jpg', ContentType: 'image/jpeg', ServerSideEncryption: 'AES256' });
  });

  it('creates presigned GET URLs (no credentials exposed) and caches them', async () => {
    const url = await provider.getUrl('wedding/gallery/a/thumb.webp');
    expect(url).toContain('wedding-bucket');
    expect(url).toContain('prod/wedding/gallery/a/thumb.webp');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).not.toContain('secret');
    expect(await provider.getUrl('wedding/gallery/a/thumb.webp')).toBe(url);
  });

  it('uses a public base URL (CloudFront) when configured', async () => {
    const cdn = new S3StorageProvider({ bucket: 'b', region: 'ap-south-1', client, publicBaseUrl: 'https://cdn.example.com/' });
    expect(await cdn.getUrl('wedding/a.jpg')).toBe('https://cdn.example.com/wedding/a.jpg');
  });

  it('streams, lists (stripping the prefix) and deletes', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Readable.from([Buffer.from('data')]) as never, ContentType: 'image/webp', ContentLength: 4 });
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'prod/private/backups/a.sql.gz', Size: 10, LastModified: new Date() }] });
    s3Mock.on(DeleteObjectCommand).resolves({});
    const { stream, contentType } = await provider.getStream('wedding/a.webp');
    expect(contentType).toBe('image/webp');
    expect(await streamToString(stream)).toBe('data');
    expect((await provider.list('private/backups/'))[0]!.key).toBe('private/backups/a.sql.gz');
    await provider.delete('wedding/a.webp');
    expect(s3Mock.commandCalls(DeleteObjectCommand)[0]!.args[0].input).toMatchObject({ Key: 'prod/wedding/a.webp' });
  });

  it('describes storage locations for the media library', () => {
    expect(provider.describe('wedding/a.jpg')).toBe('s3://wedding-bucket/prod/wedding/a.jpg');
  });
});

describe('storage selection by configuration', () => {
  it('uses local storage by default and S3 when configured', () => {
    expect(createStorageProvider(loadEnv({ NODE_ENV: 'test' })).driver).toBe('local');
    expect(createStorageProvider(loadEnv({ NODE_ENV: 'test', STORAGE_DRIVER: 's3', S3_BUCKET: 'b', S3_REGION: 'ap-south-1' })).driver).toBe('s3');
  });

  it('refuses insecure production configuration', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64), STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
    expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: '', STORAGE_DRIVER: 'local' })).toThrow(/JWT_SECRET/);
  });
});
