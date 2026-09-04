/**
 * Shared storage contract. Kept separate from `index.ts` so a driver can import
 * it without importing the factory that constructs drivers (which would be a
 * cycle). Everything here is pure data — no `server-only`, no I/O.
 */

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

export const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ACCEPTED_IMAGE_TYPES).map(([type, ext]) => [ext, type]),
);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
