import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export interface StoredFile {
  id: string;
  url: string;
}

export interface StorageDriver {
  put(bytes: Buffer, opts: { contentType: string }): Promise<StoredFile>;
  get(id: string): Promise<{ bytes: Buffer; contentType: string } | null>;
}

export const ACCEPTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ACCEPTED_IMAGE_TYPES).map(([type, ext]) => [ext, type]),
);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Dev/local driver: writes to ./storage-uploads and serves via /api/uploads/<id>.
 * Not durable on ephemeral/serverless hosts — swap for an S3/R2 driver in prod
 * by implementing StorageDriver and branching in getStorage().
 */
class LocalStorageDriver implements StorageDriver {
  private dir = path.join(process.cwd(), "storage-uploads");

  private async ensureDir() {
    await mkdir(this.dir, { recursive: true });
  }

  async put(bytes: Buffer, opts: { contentType: string }): Promise<StoredFile> {
    await this.ensureDir();
    const ext = ACCEPTED_IMAGE_TYPES[opts.contentType] ?? "bin";
    const id = `${randomUUID()}.${ext}`;
    await writeFile(path.join(this.dir, id), bytes);
    return { id, url: `/api/uploads/${id}` };
  }

  async get(id: string) {
    if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(id)) return null;
    const ext = id.split(".").pop() ?? "";
    const contentType = EXT_TO_TYPE[ext] ?? "application/octet-stream";
    try {
      const bytes = await readFile(path.join(this.dir, id));
      return { bytes, contentType };
    } catch {
      return null;
    }
  }
}

let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (cached) return cached;
  switch (env.storageDriver()) {
    case "local":
    default:
      cached = new LocalStorageDriver();
  }
  return cached;
}
