// Server/worker only. Not marked `server-only` because the standalone
// verification worker (worker/index.ts) runs this outside the Next.js runtime.
import { prisma } from "@/lib/prisma";
import type { PlainTxDetails } from "@/lib/gifts/verification";

/**
 * Atomic, idempotent credit of a verified transaction to its payment intent.
 *
 * Guards against double-crediting two ways: a pre-check on ProcessedTransaction
 * and the unique constraints on Gift.txHash / ProcessedTransaction.txHash. A
 * racing second call hits the constraint, is caught, and reports alreadyCredited.
 */

type Db = typeof prisma;

export interface CreditableIntent {
  id: string;
  birthdayId: string;
  wishId: string;
  shortId: string;
  anonymous: boolean;
}

export interface CreditOutcome {
  alreadyCredited: boolean;
  giftId: string | null;
}

const PRISMA_UNIQUE_VIOLATION = "P2023"; // fallback; real code is P2002
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "P2002" || code === PRISMA_UNIQUE_VIOLATION;
}

export async function creditGift(
  intent: CreditableIntent,
  tx: PlainTxDetails,
  senderAddress: string,
  amountLuna: bigint,
  db: Db = prisma,
): Promise<CreditOutcome> {
  try {
    return await db.$transaction(async (t) => {
      const existing = await t.processedTransaction.findUnique({
        where: { txHash: tx.transactionHash },
      });
      if (existing) {
        const gift = await t.gift.findUnique({
          where: { txHash: tx.transactionHash },
        });
        return { alreadyCredited: true, giftId: gift?.id ?? null };
      }

      const gift = await t.gift.create({
        data: {
          paymentIntentId: intent.id,
          birthdayId: intent.birthdayId,
          wishId: intent.wishId,
          senderAddress,
          recipientAddress: tx.recipient,
          amountLuna,
          currency: "NIM",
          txHash: tx.transactionHash,
          shortId: intent.shortId,
          anonymous: intent.anonymous,
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      await t.processedTransaction.create({
        data: {
          txHash: tx.transactionHash,
          chain: "nimiq",
          paymentIntentId: intent.id,
          giftId: gift.id,
        },
      });

      await t.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: "CONFIRMED",
          txHash: tx.transactionHash,
          senderAddress,
        },
      });

      await t.wish.update({
        where: { id: intent.wishId },
        data: { raisedLuna: { increment: amountLuna } },
      });

      return { alreadyCredited: false, giftId: gift.id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const gift = await db.gift.findUnique({
        where: { txHash: tx.transactionHash },
      });
      return { alreadyCredited: true, giftId: gift?.id ?? null };
    }
    throw err;
  }
}

/**
 * Reverse a previously credited gift whose transaction was later invalidated
 * (Phase 2 §16). Keeps the ProcessedTransaction row as an audit trail.
 */
export async function reverseGift(
  txHash: string,
  db: Db = prisma,
): Promise<{ reversed: boolean }> {
  return db.$transaction(async (t) => {
    const gift = await t.gift.findUnique({ where: { txHash } });
    if (!gift || gift.status === "REVERSED") return { reversed: false };

    await t.gift.update({
      where: { id: gift.id },
      data: { status: "REVERSED" },
    });
    await t.paymentIntent.update({
      where: { id: gift.paymentIntentId },
      data: { status: "FAILED" },
    });
    await t.wish.update({
      where: { id: gift.wishId },
      data: { raisedLuna: { decrement: gift.amountLuna } },
    });
    await t.processedTransaction.update({
      where: { txHash },
      data: { reversedAt: new Date() },
    });
    return { reversed: true };
  });
}
