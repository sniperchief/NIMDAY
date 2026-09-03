import { describe, it, expect, vi, beforeEach } from "vitest";

/** Ownership checks without a database — prisma is mocked. */

const { findBirthday, findWish } = vi.hoisted(() => ({
  findBirthday: vi.fn(),
  findWish: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    birthday: { findUnique: findBirthday },
    wish: { findUnique: findWish },
  },
}));

import { requireOwnedBirthday, requireOwnedWish } from "@/lib/birthday";

beforeEach(() => {
  findBirthday.mockReset();
  findWish.mockReset();
});

describe("requireOwnedBirthday", () => {
  it("returns the birthday for its creator", async () => {
    findBirthday.mockResolvedValue({ id: "b1", creatorId: "u1", wishes: [] });
    await expect(requireOwnedBirthday("u1", "b1")).resolves.toMatchObject({
      id: "b1",
    });
  });

  it("rejects a different user with a 403 Response", async () => {
    findBirthday.mockResolvedValue({ id: "b1", creatorId: "u1", wishes: [] });
    const err = await requireOwnedBirthday("u2", "b1").catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(403);
  });

  it("rejects a missing birthday with a 404 Response", async () => {
    findBirthday.mockResolvedValue(null);
    const err = await requireOwnedBirthday("u1", "missing").catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(404);
  });
});

describe("requireOwnedWish", () => {
  it("rejects when the wish belongs to another creator's birthday", async () => {
    findWish.mockResolvedValue({
      id: "w1",
      birthdayId: "b1",
      birthday: { id: "b1", creatorId: "u1" },
    });
    const err = await requireOwnedWish("u2", "w1").catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(403);
  });

  it("returns the wish for the owner", async () => {
    findWish.mockResolvedValue({
      id: "w1",
      birthdayId: "b1",
      birthday: { id: "b1", creatorId: "u1" },
    });
    await expect(requireOwnedWish("u1", "w1")).resolves.toMatchObject({
      id: "w1",
    });
  });
});
