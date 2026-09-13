/**
 * REAL Nimiq mainnet verification test.
 *
 * Spins the actual `@nimiq/core` light client, reaches consensus (no self-hosted
 * node, no RPC), fetches a known confirmed transaction, and runs it through the
 * production `verifyTransaction` rules against a synthetic matching intent.
 *
 * Off by default (needs network + ~15s). Enable with:  RUN_MAINNET_TESTS=1 npm test
 */
import { describe, it, expect } from "vitest";
import { verifyTransaction, NIMIQ_MAINNET } from "@/lib/gifts/verification";
import { memoFor } from "@/lib/gifts/shortId";

const RUN = process.env.RUN_MAINNET_TESTS === "1";

describe.skipIf(!RUN)("real Nimiq mainnet client", () => {
  it("reaches consensus and getTransaction returns creditable details", async () => {
    const { getNimiqClient, toPlainTxDetails } = await import("@/lib/nimiq/client");
    const client = await getNimiqClient();

    expect(await client.isConsensusEstablished()).toBe(true);
    expect(await client.getNetworkId()).toBe(24); // mainnet Albatross

    // A well-known burn-address recipient; grab a recent basic transaction.
    const txs = await client.getTransactionsByAddress(
      "NQ07 0000 0000 0000 0000 0000 0000 0000 0000",
      null,
      null,
      null,
      3,
      1,
    );
    expect(txs.length).toBeGreaterThan(0);

    const details = toPlainTxDetails(txs[0]);
    expect(details.network).toBe(NIMIQ_MAINNET);
    expect(details.state).toBe("confirmed");
    expect(typeof details.value).toBe("number");

    // Build an intent that matches this real transaction and verify it credits.
    const memo = "nimday:realmainnetchk";
    const result = verifyTransaction(
      {
        id: "x",
        shortId: "realmainnetchk",
        memo: memoFor("realmainnetchk"),
        recipientAddress: details.recipient,
        minAmountLuna: BigInt(details.value),
        currency: "NIM",
      },
      { ...details, data: { type: "raw", raw: Buffer.from(memo, "utf8").toString("hex") } },
    );
    expect(result.ok).toBe(true);
  }, 60_000);
});
