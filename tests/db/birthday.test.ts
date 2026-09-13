/**
 * Integration tests — require a real PostgreSQL database.
 * Run with:  DATABASE_URL=... npm test   (after `prisma db push`)
 * Skipped automatically when DATABASE_URL is not set.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("birthday persistence", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let svc: typeof import("@/lib/birthday");
  let slug: typeof import("@/lib/slug");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    svc = await import("@/lib/birthday");
    slug = await import("@/lib/slug");
  });

  beforeEach(async () => {
    await prisma.wish.deleteMany();
    await prisma.birthday.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeUser(addr: string) {
    return prisma.user.create({ data: { walletAddress: addr } });
  }

  /**
   * Assert a write is rejected by a database constraint.
   *
   * The assertion is the plain one — the write must reject. The `$disconnect`
   * afterwards is purely a driver accommodation: the bundled PGlite dev
   * database drops the socket on a constraint violation instead of returning
   * the error on a live connection, so without this the *next* test's cleanup
   * fails on a dead connection. Prisma reconnects lazily on the next query, and
   * on real PostgreSQL this is just an extra reconnect.
   */
  async function expectRejectedByConstraint(write: Promise<unknown>) {
    await expect(write).rejects.toThrow();
    await prisma.$disconnect();
  }

  it("enforces one nimDay per creator", async () => {
    const u = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0001");
    await prisma.birthday.create({
      data: { creatorId: u.id, slug: "a-1", name: "A", birthday: new Date("2000-01-01") },
    });
    await expectRejectedByConstraint(
      prisma.birthday.create({
        data: { creatorId: u.id, slug: "a-2", name: "A", birthday: new Date("2000-01-01") },
      }),
    );
  });

  it("enforces unique slugs", async () => {
    const u1 = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0002");
    const u2 = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0003");
    await prisma.birthday.create({
      data: { creatorId: u1.id, slug: "dup", name: "A", birthday: new Date("2000-01-01") },
    });
    await expectRejectedByConstraint(
      prisma.birthday.create({
        data: { creatorId: u2.id, slug: "dup", name: "B", birthday: new Date("2000-01-01") },
      }),
    );
  });

  it("generateUniqueSlug avoids existing slugs", async () => {
    const u = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0004");
    await prisma.birthday.create({
      data: { creatorId: u.id, slug: "sarah-fixed", name: "Sarah", birthday: new Date("2000-01-01") },
    });
    const generated = await slug.generateUniqueSlug(
      "Sarah",
      async (s) => (await prisma.birthday.count({ where: { slug: s } })) > 0,
    );
    expect(generated).not.toBe("sarah-fixed");
  });

  it("does not expose an unpublished birthday by slug", async () => {
    const u = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0005");
    await prisma.birthday.create({
      data: { creatorId: u.id, slug: "hidden", name: "H", birthday: new Date("2000-01-01"), published: false },
    });
    expect(await svc.getPublishedBirthdayBySlug("hidden")).toBeNull();
  });

  it("exposes a published birthday by slug", async () => {
    const u = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0006");
    await prisma.birthday.create({
      data: {
        creatorId: u.id,
        slug: "shown",
        name: "Shown",
        birthday: new Date("2000-01-01"),
        published: true,
        publishedAt: new Date(),
      },
    });
    const pub = await svc.getPublishedBirthdayBySlug("shown");
    expect(pub?.name).toBe("Shown");
  });

  it("requireOwnedBirthday rejects a non-owner", async () => {
    const owner = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0007");
    const stranger = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0008");
    const b = await prisma.birthday.create({
      data: { creatorId: owner.id, slug: "owned", name: "O", birthday: new Date("2000-01-01") },
    });
    await expect(svc.requireOwnedBirthday(stranger.id, b.id)).rejects.toBeInstanceOf(
      Response,
    );
    await expect(
      svc.requireOwnedBirthday(owner.id, b.id),
    ).resolves.toMatchObject({ id: b.id });
  });

  it("publishProblems flags an over-limit / invalid wishlist", async () => {
    const u = await makeUser("NQ01 TEST 0000 0000 0000 0000 0000 0000 0009");
    const b = await prisma.birthday.create({
      data: {
        creatorId: u.id,
        slug: "probs",
        name: "P",
        birthday: new Date("2000-01-01"),
        wishes: {
          create: Array.from({ length: 6 }, (_, i) => ({
            title: i === 0 ? "" : `w${i}`,
            targetAmount: i === 1 ? 0 : 10,
            sortOrder: i,
          })),
        },
      },
      include: { wishes: true },
    });
    const problems = svc.publishProblems(b);
    expect(problems.length).toBeGreaterThan(0);
  });
});
