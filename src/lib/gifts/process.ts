// Server/worker only. Not marked `server-only` because the standalone
// verification worker (worker/index.ts) runs this outside the Next.js runtime.
import { prisma } from "@/lib/prisma";
import {
  verifyTransaction,
  type PlainTxDetails,
  type IntentForVerification,
} from "@/lib/gifts/verification";
import { creditGift, reverseGift } from "@/lib/gifts/credit";

type Db = typeof prisma;

export type ProcessOutcome =
  | { result: "credited"; giftId: string }
  | { result: "already"; giftId: string | null }
  | { result: "pending" }
  | { result: "failed"; reason: string }
  | { result: "not_found" };

/**
 * The intent fields verification uses. `senderAddress` on the intent is only the
 * address the giver's wallet listed when they connected — a claim, not evidence
 * of which account pays — so it is deliberately not passed on. The real sender
 * comes from the transaction.
 */
function toIntentForVerification(intent: {
  id: string;
  shortId: string;
  memo: string;
  recipientAddress: string;
  minAmountLuna: bigint;
  currency: "NIM" | "USDT";
}): IntentForVerification {
  return {
    id: intent.id,
    shortId: intent.shortId,
    memo: intent.memo,
    recipientAddress: intent.recipientAddress,
    minAmountLuna: intent.minAmountLuna,
    currency: intent.currency,
  };
}

/**
 * Verify a transaction against a payment intent and, if it checks out and is
 * confirmed, credit it. Advances the intent's status. Idempotent — safe to call
 * repeatedly (the worker does).
 */
export async function applyTransactionToIntent(
  intentId: string,
  tx: PlainTxDetails,
  db: Db = prisma,
): Promise<ProcessOutcome> {
  const intent = await db.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) return { result: "not_found" };

  if (intent.status === "CONFIRMED") {
    const gift = await db.gift.findUnique({
      where: { paymentIntentId: intent.id },
    });
    return { result: "already", giftId: gift?.id ?? null };
  }

  const verification = verifyTransaction(toIntentForVerification(intent), tx);

  if (!verification.ok) {
    if (verification.retryable) {
      // tx is on-chain but not final yet — mark PENDING (covers both the submit
      // path and the reconciliation sweep finding a CREATED intent's payment).
      if (intent.status === "CREATED" || intent.status === "SUBMITTED") {
        await db.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "PENDING", txHash: tx.transactionHash },
        });
      }
      return { result: "pending" };
    }
    await db.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "FAILED",
        failureReason: verification.reason,
        txHash: tx.transactionHash,
      },
    });
    return { result: "failed", reason: verification.reason };
  }

  const outcome = await creditGift(
    {
      id: intent.id,
      birthdayId: intent.birthdayId,
      wishId: intent.wishId,
      shortId: intent.shortId,
      anonymous: intent.anonymous,
    },
    tx,
    verification.senderAddress,
    verification.amountLuna,
    db,
  );

  return outcome.alreadyCredited
    ? { result: "already", giftId: outcome.giftId }
    : { result: "credited", giftId: outcome.giftId! };
}

/** Mark intents that lapsed without a confirmed payment. */
export async function expireStaleIntents(db: Db = prisma): Promise<number> {
  const res = await db.paymentIntent.updateMany({
    where: {
      status: { in: ["CREATED", "SUBMITTED", "PENDING"] },
      expiresAt: { lt: new Date() },
      gift: { is: null },
    },
    data: { status: "EXPIRED" },
  });
  return res.count;
}

/** Reverse a credited gift whose transaction was later invalidated. */
export async function handleInvalidatedTransaction(
  txHash: string,
  db: Db = prisma,
): Promise<boolean> {
  const { reversed } = await reverseGift(txHash, db);
  return reversed;
}
