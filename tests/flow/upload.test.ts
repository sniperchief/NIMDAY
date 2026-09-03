import { describe, it, expect, vi, beforeEach } from "vitest";

const { currentUser, put } = vi.hoisted(() => ({
  currentUser: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/lib/auth/currentUser", () => ({ getCurrentUser: currentUser }));
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>();
  return { ...actual, getStorage: () => ({ put, get: vi.fn() }) };
});

import { POST as upload } from "@/app/api/upload/route";

function req(form: FormData) {
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}

beforeEach(() => {
  currentUser.mockReset();
  put.mockReset().mockResolvedValue({ id: "abc.png", url: "/api/uploads/abc.png" });
});

describe("POST /api/upload", () => {
  it("stores a valid image and returns its url", async () => {
    currentUser.mockResolvedValue({ id: "u1", walletAddress: "NQ" });
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array([1, 2, 3])], "p.png", { type: "image/png" }));
    const res = await upload(req(fd));
    expect(res.status).toBe(200);
    expect((await res.json()).data.url).toBe("/api/uploads/abc.png");
    expect(put).toHaveBeenCalledOnce();
  });

  it("requires authentication", async () => {
    currentUser.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array([1])], "p.png", { type: "image/png" }));
    expect((await upload(req(fd))).status).toBe(401);
  });

  it("rejects a non-image type", async () => {
    currentUser.mockResolvedValue({ id: "u1", walletAddress: "NQ" });
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array([1])], "x.txt", { type: "text/plain" }));
    expect((await upload(req(fd))).status).toBe(400);
  });

  it("rejects an oversized image", async () => {
    currentUser.mockResolvedValue({ id: "u1", walletAddress: "NQ" });
    const fd = new FormData();
    fd.append(
      "file",
      new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" }),
    );
    expect((await upload(req(fd))).status).toBe(400);
  });

  it("rejects a missing file", async () => {
    currentUser.mockResolvedValue({ id: "u1", walletAddress: "NQ" });
    expect((await upload(req(new FormData()))).status).toBe(400);
  });
});
