/**
 * Supabase Storage driver. Pure config validation plus the two HTTP calls,
 * with `fetch` stubbed — nothing here touches a real bucket.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SupabaseStorageDriver,
  readSupabaseConfig,
} from "@/lib/storage/supabase";

const CONFIG = {
  url: "https://ldwrnufegsqitfrlyaki.supabase.co",
  serviceRoleKey: "service-role-key",
  bucket: "nimday-uploads",
};

/** A JWT-shaped token whose payload declares the given role. */
function jwtWithRole(role: string): string {
  const body = Buffer.from(JSON.stringify({ role })).toString("base64");
  return `header.${body}.signature`;
}

describe("readSupabaseConfig", () => {
  it("reads the settings and defaults the bucket", () => {
    const c = readSupabaseConfig({
      SUPABASE_URL: "https://ref.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc123def456",
    });
    expect(c.bucket).toBe("nimday-uploads");
    expect(c.url).toBe("https://ref.supabase.co");
  });

  it("strips a trailing slash so URLs never double up", () => {
    const c = readSupabaseConfig({
      SUPABASE_URL: "https://ref.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc123def456",
    });
    expect(c.url).toBe("https://ref.supabase.co");
  });

  it("names exactly what is missing", () => {
    expect(() =>
      readSupabaseConfig({ SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc123def456" }),
    ).toThrow(/SUPABASE_URL/);
    expect(() =>
      readSupabaseConfig({ SUPABASE_URL: "https://ref.supabase.co" }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("rejects a project ref that isn't a full URL", () => {
    expect(() =>
      readSupabaseConfig({
        SUPABASE_URL: "ldwrnufegsqitfrlyaki",
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc123def456",
      }),
    ).toThrow(/full project URL/);
  });

  it("rejects the JWT Secret, which sits on the same settings page", () => {
    // A ~40-char signing secret, not an API key. Left unchecked this fails as
    // an opaque 401 on the first upload.
    expect(() =>
      readSupabaseConfig({
        SUPABASE_URL: "https://ref.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "8etW_kQx3vLpZm2nR7yTbA9cDfGhJkMnPqSrTuVemX0",
      }),
    ).toThrow(/doesn't look like a Supabase API key/i);
  });

  it("accepts the new sb_secret_ key format", () => {
    expect(() =>
      readSupabaseConfig({
        SUPABASE_URL: "https://ref.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc123def456",
      }),
    ).not.toThrow();
  });

  it("catches the anon key in the service-role slot", () => {
    // Otherwise every upload fails with an opaque 401 from Supabase.
    expect(() =>
      readSupabaseConfig({
        SUPABASE_URL: "https://ref.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: jwtWithRole("anon"),
      }),
    ).toThrow(/service-role key/i);

    expect(() =>
      readSupabaseConfig({
        SUPABASE_URL: "https://ref.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc123",
      }),
    ).toThrow(/service-role key/i);

    // the real thing passes
    expect(() =>
      readSupabaseConfig({
        SUPABASE_URL: "https://ref.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: jwtWithRole("service_role"),
      }),
    ).not.toThrow();
  });
});

describe("SupabaseStorageDriver", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads to the bucket and returns the public CDN url", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
    const driver = new SupabaseStorageDriver(CONFIG);

    const stored = await driver.put(Buffer.from([1, 2, 3]), {
      contentType: "image/png",
    });

    expect(stored.id).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(stored.url).toBe(
      `${CONFIG.url}/storage/v1/object/public/${CONFIG.bucket}/${stored.id}`,
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${CONFIG.url}/storage/v1/object/${CONFIG.bucket}/${stored.id}`);
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe(`Bearer ${CONFIG.serviceRoleKey}`);
    expect(init.headers["content-type"]).toBe("image/png");
    // never silently replace an existing object
    expect(init.headers["x-upsert"]).toBe("false");
  });

  it("gives every upload a fresh id, so one can never overwrite another", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
    const driver = new SupabaseStorageDriver(CONFIG);
    const a = await driver.put(Buffer.from([1]), { contentType: "image/png" });
    const b = await driver.put(Buffer.from([1]), { contentType: "image/png" });
    expect(a.id).not.toBe(b.id);
  });

  it("maps each accepted type to its extension", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
    const driver = new SupabaseStorageDriver(CONFIG);
    for (const [type, ext] of Object.entries({
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    })) {
      const s = await driver.put(Buffer.from([1]), { contentType: type });
      expect(s.id.endsWith(`.${ext}`)).toBe(true);
    }
  });

  it("throws on a failed upload without leaking the service-role key", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => '{"error":"new row violates row-level security policy"}',
    });
    const driver = new SupabaseStorageDriver(CONFIG);

    await expect(
      driver.put(Buffer.from([1]), { contentType: "image/png" }),
    ).rejects.toThrow(/403 Forbidden/);

    await expect(
      driver.put(Buffer.from([1]), { contentType: "image/png" }),
    ).rejects.not.toThrow(new RegExp(CONFIG.serviceRoleKey));
  });

  it("refuses a malformed id on read rather than building a path from it", async () => {
    const driver = new SupabaseStorageDriver(CONFIG);
    expect(await driver.get("../../etc/passwd")).toBeNull();
    expect(await driver.get("no-extension")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when an object is missing", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    const driver = new SupabaseStorageDriver(CONFIG);
    expect(await driver.get("11111111-2222-3333-4444-555555555555.png")).toBeNull();
  });
});
