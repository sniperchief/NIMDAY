import "server-only";
import { randomUUID } from "node:crypto";
import type { StorageDriver, StoredFile } from "@/lib/storage/types";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/storage/types";

/**
 * Supabase Storage driver.
 *
 * Talks to the Storage REST API with `fetch` rather than pulling in
 * `@supabase/supabase-js` — this needs two calls, and the SDK would be a large
 * dependency for them. nimDay stores nothing else in Supabase Storage: images
 * only, uploaded by an authenticated creator, size- and type-checked by the
 * upload route before they reach here.
 *
 * The bucket is expected to be **public-read**, so `put` returns the CDN URL and
 * the browser fetches images straight from Supabase — no nimDay function
 * invocation per image. `get` is kept for interface parity (and for a private
 * bucket) but nothing calls it in that configuration.
 *
 * The service-role key is used server-side only and must never be exposed to the
 * client: it is deliberately *not* a NEXT_PUBLIC_ variable, and this module is
 * `server-only`.
 */

export interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

/** Read + validate the Supabase settings. Throws with a fixable message. */
export function readSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseStorageConfig {
  const url = (env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const bucket = (env.SUPABASE_STORAGE_BUCKET ?? "nimday-uploads").trim();

  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER="supabase" needs ${missing.join(" and ")}. ` +
        "Set them, or use STORAGE_DRIVER=\"local\".",
    );
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `SUPABASE_URL must be the full project URL, e.g. https://<ref>.supabase.co — got "${url}".`,
    );
  }
  // The wrong value here fails as an opaque 401 on the first upload, so check
  // the shape now. Supabase issues two formats: a legacy JWT (three
  // dot-separated parts) or a prefixed key (sb_secret_… / sb_publishable_…).
  const isJwt = serviceRoleKey.split(".").length === 3;
  const isPrefixed = /^sb_(secret|publishable)_/.test(serviceRoleKey);

  if (!isJwt && !isPrefixed) {
    // Most often the JWT Secret from the same settings page — a ~40-character
    // signing secret, which is not an API key at all.
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY doesn't look like a Supabase API key. " +
        "It should start with \"eyJ\" (legacy JWT) or \"sb_secret_\". " +
        "Copy it from Settings → API → Project API keys → service_role — " +
        "not the JWT Secret under JWT Settings.",
    );
  }
  if (
    serviceRoleKey.startsWith("sb_publishable_") ||
    /"role"\s*:\s*"anon"/.test(safeJwtBody(serviceRoleKey))
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is the anon/publishable key. " +
        "Uploads need the service-role key (Settings → API → service_role). " +
        "Never expose it to the browser.",
    );
  }
  return { url, serviceRoleKey, bucket };
}

/** Decode a JWT payload for the anon-key check. Returns "" for anything else. */
function safeJwtBody(token: string): string {
  const part = token.split(".")[1];
  if (!part) return "";
  try {
    return Buffer.from(part, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export class SupabaseStorageDriver implements StorageDriver {
  constructor(private readonly config: SupabaseStorageConfig) {}

  private objectUrl(id: string): string {
    return `${this.config.url}/storage/v1/object/${encodeURIComponent(
      this.config.bucket,
    )}/${id}`;
  }

  /** The public CDN URL a browser loads the image from. */
  publicUrl(id: string): string {
    return `${this.config.url}/storage/v1/object/public/${encodeURIComponent(
      this.config.bucket,
    )}/${id}`;
  }

  async put(bytes: Buffer, opts: { contentType: string }): Promise<StoredFile> {
    const ext = ACCEPTED_IMAGE_TYPES[opts.contentType] ?? "bin";
    const id = `${randomUUID()}.${ext}`;

    const res = await fetch(this.objectUrl(id), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.serviceRoleKey}`,
        "content-type": opts.contentType,
        // Images are immutable — the id is a fresh uuid on every upload.
        "cache-control": "public, max-age=31536000, immutable",
        // Never overwrite: a uuid collision should surface, not silently replace.
        "x-upsert": "false",
      },
      body: new Uint8Array(bytes),
    });

    if (!res.ok) {
      // The route turns any throw into a generic 500 for the user; the detail
      // here is for the server log, and deliberately omits the key.
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Supabase Storage upload failed (${res.status} ${res.statusText}) ` +
          `for bucket "${this.config.bucket}": ${detail.slice(0, 300)}`,
      );
    }

    return { id, url: this.publicUrl(id) };
  }

  async get(id: string): Promise<{ bytes: Buffer; contentType: string } | null> {
    if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(id)) return null;
    const res = await fetch(this.objectUrl(id), {
      headers: { authorization: `Bearer ${this.config.serviceRoleKey}` },
    });
    if (!res.ok) return null;
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  }
}
