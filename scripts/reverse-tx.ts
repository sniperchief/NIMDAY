/**
 * Manual helper: reverse a credited gift whose transaction was invalidated.
 * Same code path the worker's invalidation sweep uses.
 *
 *   DATABASE_URL=... npx tsx scripts/reverse-tx.ts <txHash>
 */
import { prisma } from "@/lib/prisma";
import { handleInvalidatedTransaction } from "@/lib/gifts/process";

const txHash = process.argv[2];
if (!txHash) {
  console.error("usage: tsx scripts/reverse-tx.ts <txHash>");
  process.exit(1);
}

(async () => {
  const gift = await prisma.gift.findUnique({ where: { txHash } });
  if (!gift) {
    console.error("no gift for that transaction");
    process.exit(1);
  }
  const before = await prisma.wish.findUniqueOrThrow({ where: { id: gift.wishId } });
  const reversed = await handleInvalidatedTransaction(txHash);
  const after = await prisma.wish.findUniqueOrThrow({ where: { id: gift.wishId } });
  const updated = await prisma.gift.findUnique({ where: { txHash } });
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: gift.paymentIntentId },
  });
  console.log(
    JSON.stringify({
      reversed,
      raisedLunaBefore: before.raisedLuna.toString(),
      raisedLunaAfter: after.raisedLuna.toString(),
      giftStatus: updated?.status,
      intentStatus: intent?.status,
    }),
  );
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
