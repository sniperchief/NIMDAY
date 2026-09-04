import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import {
  ACCEPTED_IMAGE_TYPES,
  EXT_TO_TYPE,
  MAX_IMAGE_BYTES,
  type StorageDriver,
  type StoredFile,
} from "@/lib/storage/types";
import {
  SupabaseStorageDriver,
  readSupabaseConfig,
} from "@/lib/storage/supabase";

export {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type StorageDriver,
  type StoredFile,
};

/**
 * Dev/local driver: writes to ./storage-uploads and serves via /api/uploads/<id>.
 * Not durable on ephemeral/serverless hosts (Vercel's filesystem is read-only,
 * and a container's disk is lost on redeploy) — use STORAGE_DRIVER="supabase"
 * there.
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

/**
 * The configured driver.
 *
 * An unrecognised STORAGE_DRIVER now **throws** instead of silently falling back
 * to local disk: a typo used to mean uploads quietly went to a container's
 * ephemeral filesystem and vanished on the next deploy.
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  const driver = env.storageDriver();
  switch (driver) {
    case "local":
      cached = new LocalStorageDriver();
      break;
    case "supabase":
      cached = new SupabaseStorageDriver(readSupabaseConfig());
      break;
    default:
      throw new Error(
        `STORAGE_DRIVER="${driver}" is not a storage driver. Use "local" or "supabase".`,
      );
  }
  return cached;
}

/** Test-only: drop the memoised driver so config changes take effect. */
export function __resetStorage(): void {
  cached = null;
}
