import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertSafeKey, type StorageProvider, type StoredObject } from './StorageProvider';

/** Stores objects on the local filesystem. Used in development and tests (Docker volume). */
export class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local' as const;
  private readonly root: string;

  constructor(
    rootDir: string,
    private readonly publicPath: string = '/media',
  ) {
    this.root = path.resolve(rootDir);
  }

  get rootDir(): string {
    return this.root;
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Key escapes storage root: ${key}`);
    return full;
  }

  // Content type is not needed on disk; express.static derives it from the extension.
  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, body);
    await fs.rename(tmp, full);
  }

  async getStream(key: string) {
    const full = this.resolve(key);
    const stat = await fs.stat(full);
    return { stream: createReadStream(full), size: stat.size };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(key: string): Promise<string> {
    assertSafeKey(key);
    return `${this.publicPath}/${key}`;
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const dir = path.resolve(this.root, prefix);
    if (!dir.startsWith(this.root)) return [];
    const out: StoredObject[] = [];
    const walk = async (d: string) => {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (!entry.name.endsWith('.tmp')) {
          const stat = await fs.stat(full);
          out.push({
            key: path.relative(this.root, full).split(path.sep).join('/'),
            size: stat.size,
            lastModified: stat.mtime,
          });
        }
      }
    };
    await walk(dir);
    return out;
  }

  describe(key: string): string {
    return `local:${key}`;
  }
}
