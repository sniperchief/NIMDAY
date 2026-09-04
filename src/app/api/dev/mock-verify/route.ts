import { randomBytes } from "node:crypto";
import { route, readJson, ok, forbidden, notFound } from "@/lib/http";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { applyTransactionToIntent } from "@/lib/gifts/process";
import {
  EXPECTED_NETWORK,
  type PlainTxDetails,
  type TxState,
} from "@/lib/gifts/verification";

/**
 * DEV ONLY — simulates the verification worker seeing a transaction, so the full
 * gift loop can be exercised without a Nimiq Pay device or a live worker.
 *
 * It builds a transaction that by default matches the intent exactly (so it
 * verifies + credits), and runs the REAL `applyTransactionToIntent` code path —
 * only the on-chain lookup is synthetic. Overrides let tests drive failure cases.
 *
 * Disabled in production and unless ALLOW_DEV_LOGIN=1.
 */

const schema = z.object({
  intentId: z.string(),
  txHash: z.string().optional(),
  state: z
    .enum(["new", "pending", "included", "confirmed", "invalidated", "expired"])
    .optional(),
  valueLuna: z.string().optional(),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  network: z.string().optional(),
  memo: z.string().optional(),
});

export const POST = route(async (req) => {
  if (env.isProd || process.env.ALLOW_DEV_LOGIN !== "1") {
    return forbidden("Mock verification is disabled");
  }

  const body = await readJson(req, schema);
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: body.intentId },
  });
  if (!intent) return notFound("intent not found");

  const memo = body.memo ?? intent.memo;
  const tx: PlainTxDetails = {
    transactionHash: body.txHash ?? randomBytes(32).toString("hex"),
    state: (body.state ?? "confirmed") as TxState,
    confirmations: 12,
    blockHeight: 1_000_000,
    timestamp: Date.now(),
    sender:
      body.sender ??
      intent.senderAddress ??
      "NQ55 MOCK SEND ER00 0000 0000 0000 0000 0001",
    recipient: body.recipient ?? intent.recipientAddress,
    value: Number(body.valueLuna ?? intent.expectedAmountLuna.toString()),
    // Follow the configured network, so this still works on testnet.
    network: body.network ?? EXPECTED_NETWORK,
    data: { type: "raw", raw: Buffer.from(memo, "utf8").toString("hex") },
  };

  const outcome = await applyTransactionToIntent(intent.id, tx);
  return ok({ outcome, txHash: tx.transactionHash });
});
