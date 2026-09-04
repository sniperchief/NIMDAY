// Server/worker only. Not marked `server-only` because the standalone
// verification worker (worker/index.ts) runs this outside the Next.js runtime.
import type { Client, PlainTransactionDetails } from "@nimiq/core";
import type { PlainTxDetails, TxState } from "@/lib/gifts/verification";
import { env } from "@/lib/env";

/**
 * Long-lived `@nimiq/core` light client for the verification worker.
 *
 * Phase 0 proved this reaches Nimiq mainnet consensus (~10-15s) in plain Node.js
 * with NO self-hosted node and NO public RPC. Only the worker should import this
 * — never a serverless API route (cold-start would pay the sync cost every call).
 */

let clientPromise: Promise<Client> | null = null;

/**
 * The network this client syncs. Same validated source the verifier uses, so
 * the worker can never watch one chain while verification expects another.
 */
export function nimiqNetwork(): string {
  return env.nimiqNetwork();
}

export async function getNimiqClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const Nimiq = await import("@nimiq/core");
      const config = new Nimiq.ClientConfiguration();
      config.network(nimiqNetwork());
      config.logLevel("warn");
      const client = await Nimiq.Client.create(config.build());
      await client.waitForConsensusEstablished();
      return client;
    })().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

/** Normalise a `@nimiq/core` PlainTransactionDetails to our verification shape. */
export function toPlainTxDetails(d: PlainTransactionDetails): PlainTxDetails {
  const data = d.data as unknown as { type?: string; raw?: string } | undefined;
  return {
    transactionHash: d.transactionHash,
    state: d.state as TxState,
    confirmations: d.confirmations ?? null,
    blockHeight: d.blockHeight ?? null,
    timestamp: d.timestamp ?? null,
    sender: d.sender,
    recipient: d.recipient,
    value: d.value,
    network: d.network,
    data: data ? { type: data.type, raw: data.raw } : null,
  };
}

export async function fetchTransaction(
  hash: string,
): Promise<PlainTxDetails | null> {
  const client = await getNimiqClient();
  try {
    const details = await client.getTransaction(hash);
    return toPlainTxDetails(details);
  } catch {
    return null; // not found yet / transient
  }
}
