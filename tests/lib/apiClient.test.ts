import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ApiError,
  getMyBirthday,
  getMyGiftActivity,
  getMe,
  createGiftIntent,
} from "@/lib/apiClient";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response);
}

afterEach(() => vi.unstubAllGlobals());

describe("apiClient — unauthenticated reads degrade to null", () => {
  // Regression: a 401 from /api/birthdays/me used to throw out of the /create
  // mount effect, leaving the page stuck on its loading skeleton.
  it("getMyBirthday returns null on 401 instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(401, { ok: false, error: { code: "unauthorized", message: "Sign in" } }),
    );
    await expect(getMyBirthday()).resolves.toBeNull();
  });

  it("getMyGiftActivity returns null on 401 instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(401, { ok: false, error: { code: "unauthorized", message: "Sign in" } }),
    );
    await expect(getMyGiftActivity()).resolves.toBeNull();
  });

  it("getMe returns null when there is no session", async () => {
    vi.stubGlobal("fetch", mockFetch(401, { ok: false, error: { code: "unauthorized", message: "x" } }));
    await expect(getMe()).resolves.toBeNull();
  });
});

describe("apiClient — real failures still surface", () => {
  it("getMyBirthday rethrows a 500", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(500, { ok: false, error: { code: "server_error", message: "boom" } }),
    );
    await expect(getMyBirthday()).rejects.toBeInstanceOf(ApiError);
  });

  it("surfaces the server's message and code", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(404, { ok: false, error: { code: "not_found", message: "That wish doesn't exist" } }),
    );
    const err = await createGiftIntent({
      slug: "s",
      wishId: "w",
      amountNim: "1",
      anonymous: false,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("That wish doesn't exist");
  });

  it("unwraps a successful envelope", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, { ok: true, data: { birthday: { id: "b1", slug: "s" } } }),
    );
    await expect(getMyBirthday()).resolves.toMatchObject({ id: "b1" });
  });
});
