/**
 * Birthday messages + the creator dashboard, against a real database
 * (needs DATABASE_URL). Drives the actual HTTP handlers.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { __resetRateLimits } from "@/lib/rateLimit";

const HAS_DB = !!process.env.DATABASE_URL;

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@/lib/auth/currentUser", () => ({ getCurrentUser: currentUser }));

const RECIPIENT = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";
const GIVER = "NQ55 GIVE R000 0000 0000 0000 0000 0000 0001";

let ipCounter = 0;
/** A fresh client identity per call, so the rate limiter isn't the thing under test. */
function post(body: unknown, ip?: string) {
  return new Request("http://localhost/api/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip ?? `10.0.0.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!HAS_DB)("birthday messages", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let messagesRoute: typeof import("@/app/api/messages/route");
  let messageRoute: typeof import("@/app/api/messages/[id]/route");
  let dashboardRoute: typeof import("@/app/api/birthdays/me/dashboard/route");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    messagesRoute = await import("@/app/api/messages/route");
    messageRoute = await import("@/app/api/messages/[id]/route");
    dashboardRoute = await import("@/app/api/birthdays/me/dashboard/route");
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  let slug = "";
  let birthdayId = "";
  let wishId = "";
  let userId = "";

  beforeEach(async () => {
    currentUser.mockReset();
    __resetRateLimits();
    await prisma.message.deleteMany();
    await prisma.processedTransaction.deleteMany();
    await prisma.gift.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.wish.deleteMany();
    await prisma.birthday.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({ data: { walletAddress: RECIPIENT } });
    userId = user.id;
    slug = `m-${Math.random().toString(36).slice(2, 8)}`;
    const b = await prisma.birthday.create({
      data: {
        creatorId: user.id,
        slug,
        name: "Sarah Chen",
        birthday: new Date("2001-04-10"),
        published: true,
        publishedAt: new Date(),
        wishes: { create: [{ title: "Headphones", targetAmount: 10, sortOrder: 0 }] },
      },
      include: { wishes: true },
    });
    birthdayId = b.id;
    wishId = b.wishes[0].id;
  });

  /** A confirmed gift + its intent, straight into the ledger. */
  async function seedGift(opts: { amountLuna: bigint; anonymous: boolean; tx: string }) {
    const intent = await prisma.paymentIntent.create({
      data: {
        birthdayId,
        wishId,
        recipientAddress: RECIPIENT,
        expectedAmountLuna: opts.amountLuna,
        minAmountLuna: opts.amountLuna,
        shortId: `s${opts.tx.slice(0, 12)}`,
        memo: `nimday:s${opts.tx.slice(0, 12)}`,
        anonymous: opts.anonymous,
        status: "CONFIRMED",
        txHash: opts.tx,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const gift = await prisma.gift.create({
      data: {
        paymentIntentId: intent.id,
        birthdayId,
        wishId,
        senderAddress: GIVER,
        recipientAddress: RECIPIENT,
        amountLuna: opts.amountLuna,
        txHash: opts.tx,
        shortId: intent.shortId,
        anonymous: opts.anonymous,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
    await prisma.wish.update({
      where: { id: wishId },
      data: { raisedLuna: { increment: opts.amountLuna } },
    });
    return { intent, gift };
  }

  /* ---------------- creating ---------------- */

  it("lets a visitor leave a message with no wallet and no account", async () => {
    const res = await messagesRoute.POST(
      post({
        slug,
        body: "Happy birthday Sarah! Hope you have an amazing day 🎉",
        senderName: "Alex",
        anonymous: false,
      }),
    );
    expect(res.status).toBe(201);
    const message = (await res.json()).data.message;
    expect(message.body).toBe("Happy birthday Sarah! Hope you have an amazing day 🎉");
    expect(message.author).toBe("Alex");
    expect(message.anonymous).toBe(false);
    expect(message.gift).toBeNull();

    const list = await messagesRoute.GET(
      new Request(`http://localhost/api/messages?slug=${slug}`),
    );
    const data = (await list.json()).data;
    expect(data.total).toBe(1);
    expect(data.messages[0].id).toBe(message.id);
  });

  it("shows a named-but-unnamed sender as 'A friend'", async () => {
    const res = await messagesRoute.POST(post({ slug, body: "Have a great one!" }));
    expect((await res.json()).data.message.author).toBe("A friend");
  });

  it("hides the sender of an anonymous message everywhere", async () => {
    const res = await messagesRoute.POST(
      post({
        slug,
        body: "Wishing you the best 🎂",
        senderName: "Alex",
        anonymous: true,
        senderAddress: GIVER,
      }),
    );
    const message = (await res.json()).data.message;
    expect(message.author).toBe("Someone");
    expect(JSON.stringify(message)).not.toContain("Alex");
    expect(JSON.stringify(message)).not.toContain("NQ55");

    // the row keeps what we know — anonymity is a display rule, not a gap
    const row = await prisma.message.findUniqueOrThrow({ where: { id: message.id } });
    expect(row.senderName).toBeNull(); // a name was never stored for an anonymous send
    expect(row.senderAddress).toBe(GIVER);
    expect(row.anonymous).toBe(true);

    // and it isn't exposed by the list endpoint either
    const list = await messagesRoute.GET(
      new Request(`http://localhost/api/messages?slug=${slug}`),
    );
    expect(JSON.stringify((await list.json()).data)).not.toContain("NQ55");
  });

  it("normalises the body before storing it", async () => {
    const res = await messagesRoute.POST(
      post({ slug, body: "  Happy    birthday!\n\n\n\nSee you soon  " }),
    );
    expect((await res.json()).data.message.body).toBe("Happy birthday!\n\nSee you soon");
  });

  /* ---------------- validation ---------------- */

  it("rejects an empty message", async () => {
    const res = await messagesRoute.POST(post({ slug, body: "     " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/short birthday message/i);
  });

  it("rejects an over-long message", async () => {
    const res = await messagesRoute.POST(post({ slug, body: "a".repeat(241) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/under 240 characters/i);
  });

  it("rejects links", async () => {
    const res = await messagesRoute.POST(
      post({ slug, body: "happy birthday https://spam.example/cheap" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/links aren't allowed/i);
  });

  it("rejects an over-long sender name", async () => {
    const res = await messagesRoute.POST(
      post({ slug, body: "Happy birthday!", senderName: "a".repeat(40) }),
    );
    expect(res.status).toBe(400);
  });

  it("won't post to an unpublished NIMday", async () => {
    await prisma.birthday.update({ where: { id: birthdayId }, data: { published: false } });
    const res = await messagesRoute.POST(post({ slug, body: "Happy birthday!" }));
    expect(res.status).toBe(404);
    const list = await messagesRoute.GET(
      new Request(`http://localhost/api/messages?slug=${slug}`),
    );
    expect(list.status).toBe(404);
  });

  it("404s for a slug that doesn't exist", async () => {
    const res = await messagesRoute.POST(post({ slug: "nope", body: "Hi!" }));
    expect(res.status).toBe(404);
  });

  it("rate limits a burst from one client, and blocks the same message twice", async () => {
    const ip = "203.0.113.9";
    for (let i = 0; i < 5; i++) {
      const res = await messagesRoute.POST(post({ slug, body: `Message ${i}` }, ip));
      expect(res.status).toBe(201);
    }
    const blocked = await messagesRoute.POST(post({ slug, body: "One more" }, ip));
    expect(blocked.status).toBe(429);

    __resetRateLimits();
    const first = await messagesRoute.POST(post({ slug, body: "Happy birthday!" }, ip));
    expect(first.status).toBe(201);
    const dupe = await messagesRoute.POST(post({ slug, body: "Happy birthday!" }, ip));
    expect(dupe.status).toBe(400);
  });

  /* ---------------- gift association ---------------- */

  it("links a message to the giver's own confirmed gift", async () => {
    const { intent } = await seedGift({
      amountLuna: 400_000n,
      anonymous: false,
      tx: "a".repeat(64),
    });
    const res = await messagesRoute.POST(
      post({ slug, body: "Enjoy the headphones!", senderName: "Alex", intentId: intent.id }),
    );
    const message = (await res.json()).data.message;
    expect(message.gift).toEqual({ amountNim: "4", wishTitle: "Headphones" });
  });

  it("never links an anonymous gift — that would unmask the giver", async () => {
    const { intent } = await seedGift({
      amountLuna: 400_000n,
      anonymous: true,
      tx: "b".repeat(64),
    });
    const res = await messagesRoute.POST(
      post({ slug, body: "Happy birthday!", senderName: "Alex", intentId: intent.id }),
    );
    expect((await res.json()).data.message.gift).toBeNull();
  });

  it("ignores an intent that isn't confirmed, isn't this NIMday's, or doesn't exist", async () => {
    const unconfirmed = await prisma.paymentIntent.create({
      data: {
        birthdayId,
        wishId,
        recipientAddress: RECIPIENT,
        expectedAmountLuna: 100_000n,
        minAmountLuna: 100_000n,
        shortId: "pending123456",
        memo: "nimday:pending123456",
        status: "SUBMITTED",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const a = await messagesRoute.POST(
      post({ slug, body: "Happy birthday one!", intentId: unconfirmed.id }),
    );
    expect((await a.json()).data.message.gift).toBeNull();

    const b = await messagesRoute.POST(
      post({ slug, body: "Happy birthday two!", intentId: "does-not-exist" }),
    );
    expect(b.status).toBe(201);
    expect((await b.json()).data.message.gift).toBeNull();
  });

  it("only badges one message per gift", async () => {
    const { intent } = await seedGift({
      amountLuna: 400_000n,
      anonymous: false,
      tx: "c".repeat(64),
    });
    const first = await messagesRoute.POST(
      post({ slug, body: "First message!", intentId: intent.id }),
    );
    expect((await first.json()).data.message.gift).not.toBeNull();
    const second = await messagesRoute.POST(
      post({ slug, body: "Second message!", intentId: intent.id }),
    );
    expect((await second.json()).data.message.gift).toBeNull();
  });

  /* ---------------- dashboard ---------------- */

  it("builds the creator dashboard from the verified gift ledger", async () => {
    await seedGift({ amountLuna: 400_000n, anonymous: false, tx: "d".repeat(64) });
    await seedGift({ amountLuna: 600_000n, anonymous: true, tx: "e".repeat(64) });
    await messagesRoute.POST(post({ slug, body: "Happy birthday!", senderName: "Alex" }));
    await messagesRoute.POST(post({ slug, body: "Have a lovely day 🎂", anonymous: true }));

    currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });
    const res = await dashboardRoute.GET(new Request("http://localhost/api"));
    expect(res.status).toBe(200);
    const d = (await res.json()).data.dashboard;

    expect(d.overview.name).toBe("Sarah Chen");
    expect(d.overview.published).toBe(true);
    expect(d.overview.url).toMatch(new RegExp(`/b/${slug}$`));
    expect(d.overview.countdown.daysUntil).toBeGreaterThanOrEqual(0);

    expect(d.summary.giftCount).toBe(2);
    expect(d.summary.totalNim).toBe("10");
    expect(d.summary.messageCount).toBe(2);
    expect(d.summary.wishCount).toBe(1);
    expect(d.summary.wishesFulfilled).toBe(1);
    expect(d.summary.wishes[0]).toMatchObject({
      title: "Headphones",
      raisedNim: "10",
      targetNim: "10",
      fulfilled: true,
      progressPct: 100,
    });

    const kinds = d.activity.map((a: { kind: string }) => a.kind);
    expect(kinds).toContain("gift");
    expect(kinds).toContain("message");
    expect(kinds).toContain("fulfilled");

    // anonymity holds in the feed, and no raw address ever appears
    const gifts = d.activity.filter((a: { kind: string }) => a.kind === "gift");
    expect(gifts.find((g: { amountNim: string }) => g.amountNim === "6").actor).toBeNull();
    expect(gifts.find((g: { amountNim: string }) => g.amountNim === "4").actor).toMatch(
      /^NQ55…/,
    );
    const anonMessage = d.activity.find(
      (a: { kind: string; excerpt?: string }) =>
        a.kind === "message" && a.excerpt?.includes("lovely"),
    );
    expect(anonMessage.actor).toBeNull();
    expect(JSON.stringify(d)).not.toContain(GIVER);

    // newest first
    const times = d.activity.map((a: { at: string }) => Date.parse(a.at));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it("counts only confirmed gifts toward the totals", async () => {
    await seedGift({ amountLuna: 400_000n, anonymous: false, tx: "f".repeat(64) });
    const reversed = await seedGift({
      amountLuna: 500_000n,
      anonymous: false,
      tx: "1".repeat(64),
    });
    await prisma.gift.update({
      where: { id: reversed.gift.id },
      data: { status: "REVERSED" },
    });
    await prisma.wish.update({
      where: { id: wishId },
      data: { raisedLuna: { decrement: 500_000n } },
    });

    currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });
    const d = (await (await dashboardRoute.GET(new Request("http://localhost/api"))).json())
      .data.dashboard;
    expect(d.summary.giftCount).toBe(1);
    expect(d.summary.totalNim).toBe("4");
    expect(d.summary.wishesFulfilled).toBe(0);
    // the reversed gift is still visible, but flagged
    const rev = d.activity.find((a: { reversed?: boolean }) => a.reversed);
    expect(rev.amountNim).toBe("5");
  });

  it("requires authentication and never leaks another creator's NIMday", async () => {
    currentUser.mockResolvedValue(null);
    expect((await dashboardRoute.GET(new Request("http://localhost/api"))).status).toBe(
      401,
    );

    const other = await prisma.user.create({
      data: { walletAddress: "NQ11 1111 1111 1111 1111 1111 1111 1111 1111" },
    });
    currentUser.mockResolvedValue({ id: other.id, walletAddress: other.walletAddress });
    const res = await dashboardRoute.GET(new Request("http://localhost/api"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.dashboard).toBeNull();
  });
  /* ---------------- creator deletion ---------------- */

  describe("deleting a message", () => {
    /** Leave a message and hand back its id. */
    async function leave(body: string, extra: Record<string, unknown> = {}) {
      const res = await messagesRoute.POST(post({ slug, body, ...extra }));
      expect(res.status).toBe(201);
      return (await res.json()).data.message.id as string;
    }

    function del(id: string) {
      return messageRoute.DELETE(
        new Request(`http://localhost/api/messages/${id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id }) },
      );
    }

    async function feed() {
      const res = await messagesRoute.GET(
        new Request(`http://localhost/api/messages?slug=${slug}`),
      );
      return (await res.json()).data as {
        messages: { id: string }[];
        total: number;
      };
    }

    it("lets the creator delete a message from their own NIMday", async () => {
      const id = await leave("Happy birthday Sarah!");
      currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });

      const res = await del(id);
      expect(res.status).toBe(200);
      expect((await res.json()).data.deleted.id).toBe(id);
      expect(await prisma.message.count({ where: { id } })).toBe(0);
    });

    it("does not let another creator delete it", async () => {
      const id = await leave("Happy birthday Sarah!");
      const other = await prisma.user.create({
        data: { walletAddress: "NQ22 2222 2222 2222 2222 2222 2222 2222 2222" },
      });
      currentUser.mockResolvedValue({
        id: other.id,
        walletAddress: other.walletAddress,
      });

      const res = await del(id);
      expect(res.status).toBe(403);
      // and the message is still there
      expect(await prisma.message.count({ where: { id } })).toBe(1);
    });

    it("does not let an unauthenticated visitor delete it", async () => {
      const id = await leave("Happy birthday Sarah!");
      currentUser.mockResolvedValue(null);

      const res = await del(id);
      expect(res.status).toBe(401);
      expect(await prisma.message.count({ where: { id } })).toBe(1);
    });

    it("removes it from the public feed and the creator's own list", async () => {
      const keep = await leave("This one stays");
      const drop = await leave("This one goes");

      currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });
      expect((await del(drop)).status).toBe(200);

      const after = await feed();
      expect(after.total).toBe(1);
      expect(after.messages.map((m) => m.id)).toEqual([keep]);

      const d = (
        await (await dashboardRoute.GET(new Request("http://localhost/api"))).json()
      ).data.dashboard;
      expect(d.summary.messageCount).toBe(1);
      expect(d.messages.map((m: { id: string }) => m.id)).toEqual([keep]);
      expect(
        d.activity.some((a: { id: string }) => a.id === `message:${drop}`),
      ).toBe(false);
    });

    it("leaves the gift, its payment records and wish progress untouched", async () => {
      const { intent, gift } = await seedGift({
        amountLuna: 400_000n,
        anonymous: false,
        tx: "d".repeat(64),
      });
      await prisma.processedTransaction.create({
        data: { txHash: gift.txHash, paymentIntentId: intent.id, giftId: gift.id },
      });

      const id = await leave("Enjoy the headphones!", {
        senderName: "Alex",
        intentId: intent.id,
      });
      // the message really did carry the gift badge
      expect(await prisma.message.findUnique({ where: { id } })).toMatchObject({
        giftId: gift.id,
      });

      const wishBefore = await prisma.wish.findUniqueOrThrow({ where: { id: wishId } });

      currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });
      expect((await del(id)).status).toBe(200);

      // the gift ledger is exactly as it was
      expect(await prisma.gift.findUnique({ where: { id: gift.id } })).toMatchObject({
        status: "CONFIRMED",
        amountLuna: 400_000n,
        txHash: gift.txHash,
      });
      expect(
        await prisma.paymentIntent.findUnique({ where: { id: intent.id } }),
      ).toMatchObject({ status: "CONFIRMED" });
      expect(
        await prisma.processedTransaction.count({ where: { txHash: gift.txHash } }),
      ).toBe(1);
      expect(
        (await prisma.wish.findUniqueOrThrow({ where: { id: wishId } })).raisedLuna,
      ).toBe(wishBefore.raisedLuna);

      // and the creator's totals still show the gift
      const d = (
        await (await dashboardRoute.GET(new Request("http://localhost/api"))).json()
      ).data.dashboard;
      expect(d.summary.giftCount).toBe(1);
      expect(d.summary.totalNim).toBe("4");
      expect(d.summary.messageCount).toBe(0);
    });

    it("404s on a message that is already gone, without saying more", async () => {
      const id = await leave("Happy birthday!");
      currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });
      expect((await del(id)).status).toBe(200);

      const res = await del(id);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.message).not.toMatch(/prisma|sql|stack/i);
    });

    it("never returns a sender's name or address when deleting an anonymous message", async () => {
      const id = await leave("Have a lovely day", {
        senderName: "Alex",
        anonymous: true,
        senderAddress: GIVER,
      });
      currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });

      const res = await del(id);
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain("Alex");
      expect(text).not.toContain("NQ");
    });
  });
});
