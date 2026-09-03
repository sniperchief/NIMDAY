/**
 * THE ONE PLACE that interprets what `sendBasicTransactionWithData()` returns.
 *
 * The official API reference says it returns the transaction hash (a 32-byte
 * hex string). Phase 0 flagged the exact device return value as still-unconfirmed
 * (DEVICE CHECK PENDING). If a real Nimiq Pay device returns something else
 * (a serialized transaction, an object, a 0x-prefixed hash), adjust ONLY this
 * function — nothing else in the app parses that value.
 */

export class TxResultError extends Error {
  constructor(message = "Unrecognised transaction result from Nimiq Pay") {
    super(message);
    this.name = "TxResultError";
  }
}

const HASH_RE = /^[0-9a-f]{64}$/;

function asHash(value: string): string | null {
  const hex = value.trim().replace(/^0x/i, "").toLowerCase();
  return HASH_RE.test(hex) ? hex : null;
}

export function parseSendResult(raw: unknown): { txHash: string } {
  if (typeof raw === "string") {
    const hash = asHash(raw);
    if (hash) return { txHash: hash };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["transactionHash", "hash", "txHash", "id"]) {
      const v = obj[key];
      if (typeof v === "string") {
        const hash = asHash(v);
        if (hash) return { txHash: hash };
      }
    }
  }

  throw new TxResultError();
}
