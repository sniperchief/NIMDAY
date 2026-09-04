/**
 * Route-level gift flow against a real database (needs DATABASE_URL).
 * Drives the actual HTTP handlers: intent → submit → (worker verifies) → status.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const HAS_DB = !!process.env.DATABASE_URL;

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@/lib/auth/currentUser", () => ({ getCurrentUser: currentUser }));

const RECIPIENT = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";

function json(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(!HAS_DB)("gift routes", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let intentRoute: typeof import("@/app/api/gifts/intent/route");
  let submitRoute: typeof import("@/app/api/gifts/intent/[id]/submit/route");
  let statusRoute: typeof import("@/app/api/gifts/intent/[id]/route");
  let activityRoute: typeof import("@/app/api/birthdays/me/gifts/route");
  let wishRoute: typeof import("@/app/api/wishes/[id]/route");
  let process: typeof import("@/lib/gifts/process");
  let verification: typeof import("@/lib/gifts/verification");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    intentRoute = await import("@/app/api/gifts/intent/route");
    submitRoute = await import("@/app/api/gifts/intent/[id]/submit/route");
    statusRoute = await import("@/app/api/gifts/intent/[id]/route");
    activityRoute = await import("@/app/api/birthdays/me/gifts/route");
    wishRoute = await import("@/app/api/wishes/[id]/route");
    process = await import("@/lib/gifts/process");
    verification = await import("@/lib/gifts/verification");
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  let wishId = "";
  let slug = "";
  let userId = "";

  beforeEach(async () => {
    currentUser.mockReset();
    await prisma.processedTransaction.deleteMany();
    await prisma.gift.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.wish.deleteMany();
    await prisma.birthday.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({ data: { walletAddress: RECIPIENT } });
    userId = user.id;
    slug = `g-${Math.random().toString(36).slice(2, 8)}`;
    const b = await prisma.birthday.create({
      data: {
        creatorId: user.id,
        slug,
        name: "Gemma",
        birthday: new Date("2001-04-10"),
        published: true,
        publishedAt: new Date(),
        wishes: { create: [{ title: "Helmet", targetAmount: 10, sortOrder: 0 }] },
      },
      include: { wishes: true },
    });
    wishId = b.wishes[0].id;
  });

  it("runs intent → submit → verify → confirmed, updating wish progress", async () => {
    // create intent (no auth)
    const created = await intentRoute.POST(
      json({ slug, wishId, amountNim: "4", anonymous: false }),
    );
    expect(created.status).toBe(201);
    const intent = (await created.json()).data.intent;
    expect(intent.amountLuna).toBe("400000");

    // submit a tx hash
    const txHash = "c".repeat(64);
    const submitted = await submitRoute.POST(
      json({ txHash, senderAddress: "NQ55 GIVE R000 0000 0000 0000 0000 0000 0001" }),
      ctx(intent.id),
    );
    expect((await submitted.json()).data.payment.status).toBe("SUBMITTED");

    // status is still not confirmed
    const s1 = await statusRoute.GET(new Request("http://x"), ctx(intent.id));
    expect((await s1.json()).data.payment.status).toBe("SUBMITTED");

    // worker sees a confirmed matching transaction
    const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: intent.id },
    });
    const tx: import("@/lib/gifts/verification").PlainTxDetails = {
      transactionHash: txHash,
      state: "confirmed",
      confirmations: 12,
      sender: "NQ55 GIVE R000 0000 0000 0000 0000 0000 0001",
      recipient: dbIntent.recipientAddress,
      value: Number(dbIntent.expectedAmountLuna),
      network: verification.EXPECTED_NETWORK,
      data: {
        type: "raw",
        raw: Buffer.from(dbIntent.memo, "utf8").toString("hex"),
      },
    };
    const outcome = await process.applyTransactionToIntent(intent.id, tx);
    expect(outcome.result).toBe("credited");

    // status now confirmed
    const s2 = await statusRoute.GET(new Request("http://x"), ctx(intent.id));
    const payment = (await s2.json()).data.payment;
    expect(payment.status).toBe("CONFIRMED");
    expect(payment.confirmedGift.amountNim).toBe("4");

    // wish progress
    const wish = await prisma.wish.findUniqueOrThrow({ where: { id: wishId } });
    expect(wish.raisedLuna).toBe(400_000n);

    // creator activity
    currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });
    const act = await activityRoute.GET(new Request("http://x"));
    const activity = (await act.json()).data.activity;
    expect(activity.totals.giftCount).toBe(1);
    expect(activity.totals.totalNim).toBe("4");
    expect(activity.items[0].senderLabel).toMatch(/^NQ55…/);
  });

  it("intent for a bad wish is 404", async () => {
    const res = await intentRoute.POST(
      json({ slug, wishId: "nope", amountNim: "1", anonymous: false }),
    );
    expect(res.status).toBe(404);
  });

  it("intent with amount 0 is 400", async () => {
    const res = await intentRoute.POST(
      json({ slug, wishId, amountNim: "0", anonymous: false }),
    );
    expect(res.status).toBe(400);
  });

  it("me/gifts requires auth", async () => {
    currentUser.mockResolvedValue(null);
    const res = await activityRoute.GET(new Request("http://x"));
    expect(res.status).toBe(401);
  });
  /* --------- the gift ledger outranks tidying up the wishlist --------- */

  describe("deleting a wish", () => {
    function del(id: string) {
      return wishRoute.DELETE(
        new Request(`http://localhost/api/wishes/${id}`, { method: "DELETE" }),
        ctx(id),
      );
    }

    /** Drive a real gift all the way to CONFIRMED through the route handlers. */
    async function giftThisWish(amountNim: string, tx: string) {
      const created = await intentRoute.POST(
        json({ slug, wishId, amountNim, anonymous: false }),
      );
      const intent = (await created.json()).data.intent;
      const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
        where: { id: intent.id },
      });
      await process.applyTransactionToIntent(intent.id, {
        transactionHash: tx,
        state: "confirmed",
        confirmations: 12,
        sender: "NQ55 GIVE R000 0000 0000 0000 0000 0000 0001",
        recipient: dbIntent.recipientAddress,
        value: Number(dbIntent.expectedAmountLuna),
        network: verification.EXPECTED_NETWORK,
        data: {
          type: "raw",
          raw: Buffer.from(dbIntent.memo, "utf8").toString("hex"),
        },
      });
      return intent.id as string;
    }

    it("refuses to delete a wish that has received a gift, keeping the ledger intact", async () => {
      const intentId = await giftThisWish("4", "e".repeat(64));
      currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });

      const res = await del(wishId);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.message).toMatch(/already received a gift/i);
      expect(body.error.message).not.toMatch(/prisma|cascade|sql/i);

      // nothing was removed: the wish, its gift, the intent and the guard row
      expect(await prisma.wish.count({ where: { id: wishId } })).toBe(1);
      expect(await prisma.gift.count({ where: { wishId } })).toBe(1);
      expect(
        await prisma.paymentIntent.count({ where: { id: intentId } }),
      ).toBe(1);
      expect(
        await prisma.processedTransaction.count({ where: { giftId: { not: null } } }),
      ).toBe(1);
      expect(
        (await prisma.wish.findUniqueOrThrow({ where: { id: wishId } })).raisedLuna,
      ).toBe(400_000n);
    });

    it("still deletes a wish nobody has gifted", async () => {
      const b = await prisma.birthday.findUniqueOrThrow({ where: { slug } });
      const spare = await prisma.wish.create({
        data: { birthdayId: b.id, title: "Socks", targetAmount: 5, sortOrder: 1 },
      });
      currentUser.mockResolvedValue({ id: userId, walletAddress: RECIPIENT });

      const res = await del(spare.id);
      expect(res.status).toBe(200);
      expect(await prisma.wish.count({ where: { id: spare.id } })).toBe(0);
    });

    it("tells the editor which wishes are gifted, so Remove can be blocked up front", async () => {
      await giftThisWish("4", "f".repeat(64));
      const { getOwnBirthday, toEditorBirthday } = await import("@/lib/birthday");
      const editor = toEditorBirthday((await getOwnBirthday(userId))!);
      const gifted = editor.wishes.find((w) => w.id === wishId)!;
      expect(gifted.giftCount).toBe(1);
      expect(gifted.raisedNim).toBe("4");
    });

    it("does not let a different creator delete someone else's wish", async () => {
      const other = await prisma.user.create({
        data: { walletAddress: "NQ33 3333 3333 3333 3333 3333 3333 3333 3333" },
      });
      currentUser.mockResolvedValue({
        id: other.id,
        walletAddress: other.walletAddress,
      });
      expect((await del(wishId)).status).toBe(403);

      currentUser.mockResolvedValue(null);
      expect((await del(wishId)).status).toBe(401);
      expect(await prisma.wish.count({ where: { id: wishId } })).toBe(1);
    });
  });
});
