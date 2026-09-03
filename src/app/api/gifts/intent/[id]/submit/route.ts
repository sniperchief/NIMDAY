import { route, readJson, ok } from "@/lib/http";
import { submitTxSchema } from "@/lib/validation";
import { attachTransaction } from "@/lib/gifts/intent";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The giver reports the transaction hash returned by Nimiq Pay. This does NOT
 * confirm the gift — it only records the hash so the verification worker can
 * check it on-chain. The gift becomes real only when the worker verifies a
 * confirmed transaction.
 */
export const POST = route(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req, submitTxSchema);
  const payment = await attachTransaction(
    id,
    body.txHash,
    body.senderAddress ?? null,
  );
  return ok({ payment });
});
