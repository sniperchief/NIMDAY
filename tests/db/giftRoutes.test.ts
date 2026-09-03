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
  let process: typeof import("@/lib/gifts/process");
  let verification: typeof import("@/lib/gifts/verification");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    intentRoute = await import("@/app/api/gifts/intent/route");
    submitRoute = await import("@/app/api/gifts/intent/[id]/submit/route");
    statusRoute = await import("@/app/api/gifts/intent/[id]/route");
    activityRoute = await import("@/app/api/birthdays/me/gifts/route");
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
      network: verification.NIMIQ_MAINNET,
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
});
