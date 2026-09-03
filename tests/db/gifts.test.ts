/**
 * Gift + verification integration tests — require a real PostgreSQL.
 *   DATABASE_URL=... npm test        (after `prisma db push`)
 * Skipped automatically without DATABASE_URL.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const HAS_DB = !!process.env.DATABASE_URL;

const RECIPIENT = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";
const SENDER = "NQ55 1111 1111 1111 1111 1111 1111 1111 1111";

describe.skipIf(!HAS_DB)("gifts + verification", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let intentSvc: typeof import("@/lib/gifts/intent");
  let process: typeof import("@/lib/gifts/process");
  let activity: typeof import("@/lib/gifts/activity");
  let money: typeof import("@/lib/money");
  let verification: typeof import("@/lib/gifts/verification");
  let shortId: typeof import("@/lib/gifts/shortId");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    intentSvc = await import("@/lib/gifts/intent");
    process = await import("@/lib/gifts/process");
    activity = await import("@/lib/gifts/activity");
    money = await import("@/lib/money");
    verification = await import("@/lib/gifts/verification");
    shortId = await import("@/lib/gifts/shortId");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function reset() {
    await prisma.processedTransaction.deleteMany();
    await prisma.gift.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.wish.deleteMany();
    await prisma.birthday.deleteMany();
    await prisma.user.deleteMany();
  }
  beforeEach(reset);

  async function makeBirthday(opts?: {
    published?: boolean;
    address?: string;
    currency?: "NIM" | "USDT";
    target?: number;
  }) {
    const user = await prisma.user.create({
      data: { walletAddress: opts?.address ?? RECIPIENT },
    });
    const birthday = await prisma.birthday.create({
      data: {
        creatorId: user.id,
        slug: `s-${Math.random().toString(36).slice(2, 8)}`,
        name: "Sarah",
        birthday: new Date("2000-09-13"),
        published: opts?.published ?? true,
        publishedAt: new Date(),
        wishes: {
          create: [
            {
              title: "Headphones",
              targetAmount: opts?.target ?? 10,
              currency: opts?.currency ?? "NIM",
              sortOrder: 0,
            },
          ],
        },
      },
      include: { wishes: true },
    });
    return { user, birthday, wish: birthday.wishes[0] };
  }

  function txFor(
    intent: { memo: string; recipientAddress: string; expectedAmountLuna: bigint },
    over: Partial<import("@/lib/gifts/verification").PlainTxDetails> = {},
  ): import("@/lib/gifts/verification").PlainTxDetails {
    return {
      transactionHash:
        over.transactionHash ??
        Array.from({ length: 64 }, () =>
          "0123456789abcdef"[Math.floor(Math.random() * 16)],
        ).join(""),
      state: "confirmed",
      confirmations: 12,
      sender: SENDER,
      recipient: intent.recipientAddress,
      value: Number(intent.expectedAmountLuna),
      network: verification.NIMIQ_MAINNET,
      data: {
        type: "raw",
        raw: Buffer.from(intent.memo, "utf8").toString("hex"),
      },
      ...over,
    };
  }

  it("creates a valid NIM intent with a server-derived recipient", async () => {
    const { birthday, wish } = await makeBirthday();
    const view = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "2.5",
      anonymous: false,
    });
    expect(view.amountLuna).toBe("250000");
    expect(view.recipientAddress).toBe(RECIPIENT);
    expect(view.memo.startsWith("nimday:")).toBe(true);
    expect(view.deepLink).toContain(`intent=${view.id}`);
  });

  it("rejects an intent for an unpublished birthday", async () => {
    const { birthday, wish } = await makeBirthday({ published: false });
    await expect(
      intentSvc.createPaymentIntent({
        slug: birthday.slug,
        wishId: wish.id,
        amountNim: "1",
        anonymous: false,
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  it("rejects an intent for a non-NIM wish", async () => {
    const { birthday, wish } = await makeBirthday({ currency: "USDT" });
    await expect(
      intentSvc.createPaymentIntent({
        slug: birthday.slug,
        wishId: wish.id,
        amountNim: "1",
        anonymous: false,
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  it("rejects an invalid amount", async () => {
    const { birthday, wish } = await makeBirthday();
    await expect(
      intentSvc.createPaymentIntent({
        slug: birthday.slug,
        wishId: wish.id,
        amountNim: "0",
        anonymous: false,
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  it("credits a correct confirmed transaction and advances wish progress", async () => {
    const { birthday, wish } = await makeBirthday({ target: 10 });
    const view = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "4",
      anonymous: false,
    });
    const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: view.id },
    });

    const out = await process.applyTransactionToIntent(
      view.id,
      txFor(dbIntent),
    );
    expect(out.result).toBe("credited");

    const [gift, intent, updatedWish, processed] = await Promise.all([
      prisma.gift.findFirst({ where: { paymentIntentId: view.id } }),
      prisma.paymentIntent.findUnique({ where: { id: view.id } }),
      prisma.wish.findUnique({ where: { id: wish.id } }),
      prisma.processedTransaction.findFirst({ where: { paymentIntentId: view.id } }),
    ]);
    expect(gift?.status).toBe("CONFIRMED");
    expect(intent?.status).toBe("CONFIRMED");
    expect(updatedWish?.raisedLuna).toBe(400_000n);
    expect(processed).not.toBeNull();
    expect(money.lunaToNimString(updatedWish!.raisedLuna)).toBe("4");
  });

  it("never credits the same transaction twice", async () => {
    const { birthday, wish } = await makeBirthday();
    const view = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "3",
      anonymous: false,
    });
    const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: view.id },
    });
    const tx = txFor(dbIntent);

    const first = await process.applyTransactionToIntent(view.id, tx);
    const second = await process.applyTransactionToIntent(view.id, tx);
    expect(first.result).toBe("credited");
    expect(second.result).toBe("already");

    expect(await prisma.gift.count()).toBe(1);
    const updatedWish = await prisma.wish.findUnique({ where: { id: wish.id } });
    expect(updatedWish?.raisedLuna).toBe(300_000n); // not doubled
  });

  it("does not credit an unconfirmed transaction, then credits it once confirmed", async () => {
    const { birthday, wish } = await makeBirthday();
    const view = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "1",
      anonymous: false,
    });
    const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: view.id },
    });
    const hash = "b".repeat(64);

    const pending = await process.applyTransactionToIntent(
      view.id,
      txFor(dbIntent, { transactionHash: hash, state: "included" }),
    );
    expect(pending.result).toBe("pending");
    expect(await prisma.gift.count()).toBe(0);
    expect(
      (await prisma.paymentIntent.findUnique({ where: { id: view.id } }))?.status,
    ).toBe("PENDING");

    const credited = await process.applyTransactionToIntent(
      view.id,
      txFor(dbIntent, { transactionHash: hash, state: "confirmed" }),
    );
    expect(credited.result).toBe("credited");
    expect(await prisma.gift.count()).toBe(1);
  });

  it("fails a transaction to the wrong recipient without touching progress", async () => {
    const { birthday, wish } = await makeBirthday();
    const view = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "5",
      anonymous: false,
    });
    const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: view.id },
    });
    const out = await process.applyTransactionToIntent(
      view.id,
      txFor(dbIntent, { recipient: "NQ07 9999 9999 9999 9999 9999 9999 9999 9999" }),
    );
    expect(out).toMatchObject({ result: "failed", reason: "wrong_recipient" });
    expect(await prisma.gift.count()).toBe(0);
    const w = await prisma.wish.findUnique({ where: { id: wish.id } });
    expect(w?.raisedLuna).toBe(0n);
    expect(
      (await prisma.paymentIntent.findUnique({ where: { id: view.id } }))?.status,
    ).toBe("FAILED");
  });

  it("reverses a credited gift when its transaction is later invalidated", async () => {
    const { birthday, wish } = await makeBirthday();
    const view = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "6",
      anonymous: false,
    });
    const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: view.id },
    });
    const tx = txFor(dbIntent);
    await process.applyTransactionToIntent(view.id, tx);
    expect((await prisma.wish.findUnique({ where: { id: wish.id } }))?.raisedLuna).toBe(600_000n);

    const reversed = await process.handleInvalidatedTransaction(tx.transactionHash);
    expect(reversed).toBe(true);

    const [gift, w, intent] = await Promise.all([
      prisma.gift.findUnique({ where: { txHash: tx.transactionHash } }),
      prisma.wish.findUnique({ where: { id: wish.id } }),
      prisma.paymentIntent.findUnique({ where: { id: view.id } }),
    ]);
    expect(gift?.status).toBe("REVERSED");
    expect(w?.raisedLuna).toBe(0n);
    expect(intent?.status).toBe("FAILED");
  });

  it("expires stale intents that never received a payment", async () => {
    const { birthday, wish } = await makeBirthday();
    const view = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "1",
      anonymous: false,
    });
    await prisma.paymentIntent.update({
      where: { id: view.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const n = await process.expireStaleIntents();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(
      (await prisma.paymentIntent.findUnique({ where: { id: view.id } }))?.status,
    ).toBe("EXPIRED");
  });

  it("gift activity is scoped to one creator's birthday", async () => {
    const a = await makeBirthday({ address: RECIPIENT });
    const b = await makeBirthday({
      address: "NQ07 2222 2222 2222 2222 2222 2222 2222 2222",
    });

    for (const ctx of [a, b]) {
      const view = await intentSvc.createPaymentIntent({
        slug: ctx.birthday.slug,
        wishId: ctx.wish.id,
        amountNim: "2",
        anonymous: ctx === b,
      });
      const dbIntent = await prisma.paymentIntent.findUniqueOrThrow({
        where: { id: view.id },
      });
      await process.applyTransactionToIntent(view.id, txFor(dbIntent));
    }

    const actA = await activity.getGiftActivity(a.birthday.id);
    const actB = await activity.getGiftActivity(b.birthday.id);
    expect(actA.totals.giftCount).toBe(1);
    expect(actB.totals.giftCount).toBe(1);
    expect(actA.items[0].anonymous).toBe(false);
    expect(actA.items[0].senderLabel).toMatch(/^NQ55…/);
    expect(actB.items[0].anonymous).toBe(true);
    expect(actB.items[0].senderLabel).toBeNull();
  });

  it("uses the memo shortId to match, ignoring an unrelated intent", async () => {
    const { birthday, wish } = await makeBirthday();
    const v1 = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "1",
      anonymous: false,
    });
    const v2 = await intentSvc.createPaymentIntent({
      slug: birthday.slug,
      wishId: wish.id,
      amountNim: "1",
      anonymous: false,
    });
    const i1 = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: v1.id } });
    // a tx carrying v1's memo must not credit v2
    const out = await process.applyTransactionToIntent(v2.id, txFor(i1));
    expect(out).toMatchObject({ result: "failed", reason: "wrong_memo" });
    expect(shortId.shortIdFromMemo(i1.memo)).toBe(i1.shortId);
  });
});
