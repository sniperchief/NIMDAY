/**
 * NIMday verification worker.
 *
 * A single always-on Node process holding a warm `@nimiq/core` light client
 * (Phase 0: reaches Nimiq mainnet consensus with no self-hosted node and no
 * public RPC). It is the ONLY thing allowed to turn a payment into a confirmed
 * gift — API routes just record the giver's claimed transaction hash.
 *
 *   npm run worker          (needs DATABASE_URL; NIMIQ_NETWORK defaults to mainalbatross)
 *
 * Not a distributed queue — one worker is enough for the MVP. Every operation is
 * idempotent, so restarts and missed events are recovered by the reconciliation
 * sweep.
 */
import type { Client, PlainTransactionDetails } from "@nimiq/core";
import { prisma } from "@/lib/prisma";
import {
  getNimiqClient,
  nimiqNetwork,
  toPlainTxDetails,
  fetchTransaction,
} from "@/lib/nimiq/client";
import {
  applyTransactionToIntent,
  expireStaleIntents,
  handleInvalidatedTransaction,
} from "@/lib/gifts/process";
import { shortIdFromMemo } from "@/lib/gifts/shortId";
import type { PlainTxDetails } from "@/lib/gifts/verification";

const TICK_MS = Number(process.env.WORKER_TICK_MS ?? 8000);
const RELISTEN_EVERY_TICKS = 10;

function decodeMemo(data: PlainTxDetails["data"]): string {
  const raw = data?.raw;
  if (!raw) return "";
  try {
    return Buffer.from(raw.replace(/^0x/, ""), "hex").toString("utf8");
  } catch {
    return "";
  }
}

async function openIntentRecipients(): Promise<string[]> {
  const rows = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ["CREATED", "SUBMITTED", "PENDING"] },
      expiresAt: { gt: new Date() },
    },
    select: { recipientAddress: true },
    distinct: ["recipientAddress"],
  });
  return rows.map((r) => r.recipientAddress);
}

/** A transaction was included — try to match it to a waiting intent right away. */
async function onIncludedTransaction(tx: PlainTxDetails): Promise<void> {
  const shortId = shortIdFromMemo(decodeMemo(tx.data));
  if (!shortId) return;
  const intent = await prisma.paymentIntent.findUnique({ where: { shortId } });
  if (!intent || intent.status === "CONFIRMED") return;

  // Prefer authoritative details (finality) but fall back to the listener payload.
  const details = (await fetchTransaction(tx.transactionHash)) ?? tx;
  const outcome = await applyTransactionToIntent(intent.id, details);
  console.log(`[worker] listener ${shortId} -> ${outcome.result}`);
}

let listenerHandle: number | null = null;
async function refreshListener(client: Client): Promise<void> {
  const addresses = await openIntentRecipients();
  if (listenerHandle !== null) {
    await client.removeListener(listenerHandle).catch(() => undefined);
    listenerHandle = null;
  }
  if (addresses.length === 0) return;
  listenerHandle = await client.addTransactionListener(
    (tx: PlainTransactionDetails) => {
      onIncludedTransaction(toPlainTxDetails(tx)).catch((e) =>
        console.error("[worker] listener error", e),
      );
    },
    addresses,
  );
  console.log(`[worker] watching ${addresses.length} recipient address(es)`);
}

/** Poll intents that have a submitted hash for confirmation. */
async function processSubmitted(): Promise<void> {
  const intents = await prisma.paymentIntent.findMany({
    where: { status: { in: ["SUBMITTED", "PENDING"] }, txHash: { not: null } },
    take: 100,
  });
  for (const intent of intents) {
    const details = await fetchTransaction(intent.txHash!);
    if (!details) continue;
    const outcome = await applyTransactionToIntent(intent.id, details);
    if (outcome.result !== "pending") {
      console.log(`[worker] ${intent.shortId} -> ${outcome.result}`);
    }
  }
}

/** Reconciliation: scan each watched address for nimday transactions we missed. */
async function reconcile(client: Client): Promise<void> {
  const addresses = await openIntentRecipients();
  for (const address of addresses) {
    let txs: PlainTransactionDetails[] = [];
    try {
      txs = await client.getTransactionsByAddress(address, null, null, null, 25, 1);
    } catch {
      continue;
    }
    for (const raw of txs) {
      const tx = toPlainTxDetails(raw);
      const already = await prisma.processedTransaction.findUnique({
        where: { txHash: tx.transactionHash },
      });
      if (already) continue;
      const shortId = shortIdFromMemo(decodeMemo(tx.data));
      if (!shortId) continue;
      const intent = await prisma.paymentIntent.findUnique({ where: { shortId } });
      if (!intent || intent.status === "CONFIRMED") continue;
      const outcome = await applyTransactionToIntent(intent.id, tx);
      console.log(`[worker] reconcile ${shortId} -> ${outcome.result}`);
    }
  }
  await prisma.workerCheckpoint.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastNote: "reconciled" },
    update: { lastScannedAt: new Date(), lastNote: "reconciled" },
  });
}

/** Reverse gifts whose backing transaction was later invalidated. */
async function checkInvalidations(): Promise<void> {
  const gifts = await prisma.gift.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { confirmedAt: "desc" },
    take: 100,
  });
  for (const gift of gifts) {
    const details = await fetchTransaction(gift.txHash);
    if (details && details.state === "invalidated") {
      const reversed = await handleInvalidatedTransaction(gift.txHash);
      if (reversed) console.warn(`[worker] reversed invalidated tx ${gift.txHash}`);
    }
  }
}

let ticks = 0;
async function tick(client: Client): Promise<void> {
  ticks += 1;
  await processSubmitted();
  await reconcile(client);
  const expired = await expireStaleIntents();
  if (expired > 0) console.log(`[worker] expired ${expired} stale intent(s)`);
  await checkInvalidations();
  if (ticks % RELISTEN_EVERY_TICKS === 0) await refreshListener(client);
}

async function main(): Promise<void> {
  console.log(`[worker] connecting to Nimiq (${nimiqNetwork()})…`);
  const client = await getNimiqClient();
  console.log(`[worker] consensus established, head #${await client.getHeadHeight()}`);

  await refreshListener(client);
  await tick(client);
  setInterval(() => {
    tick(client).catch((e) => console.error("[worker] tick error", e));
  }, TICK_MS);

  const shutdown = async () => {
    console.log("[worker] shutting down");
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
