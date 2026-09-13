/**
 * Pure transaction-verification rules (Phase 2 §11). Given a payment intent and
 * the on-chain transaction details, decide whether the transaction may credit
 * that intent. No database, no network — fully unit-testable.
 *
 * NIMday must never trust the frontend: every rule below is checked against the
 * chain, and the recipient is checked against the address the server derived
 * from the wish's birthday's creator.
 */

import { normalizeAddress } from "@/lib/nimiq/address";
import { shortIdFromMemo } from "@/lib/gifts/shortId";
import { env, NIMIQ_MAINNET } from "@/lib/env";

export type TxState =
  | "new"
  | "pending"
  | "included"
  | "confirmed"
  | "invalidated"
  | "expired";

export interface PlainTxDetails {
  transactionHash: string;
  state: TxState;
  confirmations?: number | null;
  blockHeight?: number | null;
  timestamp?: number | null;
  sender: string;
  recipient: string;
  /** Luna, integer. */
  value: number;
  /** e.g. "mainalbatross" */
  network: string;
  /** basic-tx data, hex-encoded raw bytes */
  data?: { type?: string; raw?: string } | null;
}

/**
 * What verification needs from an intent. Deliberately carries no sender: the
 * address a giver's wallet *claims* when they connect is not evidence of which
 * account will actually pay, so it is never compared against the chain. The
 * sender is read from the transaction and recorded on credit.
 */
export interface IntentForVerification {
  id: string;
  shortId: string;
  memo: string;
  recipientAddress: string;
  minAmountLuna: bigint;
  currency: "NIM" | "USDT";
}

export { NIMIQ_MAINNET };

/**
 * The network a transaction must be on to count. Defaults to mainnet; set
 * NIMIQ_NETWORK=testalbatross (and run the worker with the same value) to test
 * end-to-end with free testnet NIM. Read once at import, from the single
 * validated source in `lib/env` — the light client reads the same one, so the
 * chain we watch and the chain we accept can never drift apart.
 */
export const EXPECTED_NETWORK: string = env.nimiqNetwork();

export type VerificationFailure =
  | "wrong_currency"
  | "wrong_network"
  | "wrong_recipient"
  | "wrong_sender"
  | "wrong_memo"
  | "amount_too_low"
  | "not_confirmed"
  | "invalidated"
  | "not_creditable";

export type VerificationResult =
  | {
      ok: true;
      state: TxState;
      amountLuna: bigint;
      /** the real on-chain sender, normalised — the only sender NIMday records */
      senderAddress: string;
    }
  | { ok: false; reason: VerificationFailure; retryable: boolean };

function decodeMemo(data: PlainTxDetails["data"]): string {
  const raw = data?.raw;
  if (!raw) return "";
  try {
    return Buffer.from(raw.replace(/^0x/, ""), "hex").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Run every rule. `state === "confirmed"` is required to credit; earlier states
 * return `{ ok:false, retryable:true }` so the worker keeps checking.
 */
export function verifyTransaction(
  intent: IntentForVerification,
  tx: PlainTxDetails,
): VerificationResult {
  // Currency — MVP is NIM only, and a basic NIM tx is the only shape we accept.
  if (intent.currency !== "NIM") {
    return { ok: false, reason: "wrong_currency", retryable: false };
  }

  // Network
  if (tx.network !== EXPECTED_NETWORK) {
    return { ok: false, reason: "wrong_network", retryable: false };
  }

  // Recipient — must be exactly the server-derived creator address.
  const wantRecipient = normalizeAddress(intent.recipientAddress);
  const gotRecipient = normalizeAddress(tx.recipient);
  if (!wantRecipient || !gotRecipient || wantRecipient !== gotRecipient) {
    return { ok: false, reason: "wrong_recipient", retryable: false };
  }

  // Sender — must be a readable address, because it is what gets recorded. It is
  // NOT required to match the address the giver's wallet listed on connect:
  // Nimiq Pay's listAccounts() gives no guarantee its first entry is the account
  // that pays, and a giver with more than one account was being refused a
  // genuine gift. Nothing is lost by accepting any sender — the memo binds the
  // payment to this one intent, and recipient, amount, confirmation and tx-hash
  // uniqueness are all still enforced. Whoever paid, the creator received it.
  const gotSender = normalizeAddress(tx.sender);
  if (!gotSender) {
    return { ok: false, reason: "wrong_sender", retryable: false };
  }

  // Memo — decoded data must carry this intent's shortId.
  const memo = decodeMemo(tx.data);
  if (memo !== intent.memo && shortIdFromMemo(memo) !== intent.shortId) {
    return { ok: false, reason: "wrong_memo", retryable: false };
  }

  // Amount — integer Luna, at least the chosen minimum. Overpayment is fine
  // (credit the actual value); underpayment fails loudly, never silently.
  const value = BigInt(Math.trunc(tx.value));
  if (value < intent.minAmountLuna) {
    return { ok: false, reason: "amount_too_low", retryable: false };
  }

  // State — the only creditable state is "confirmed".
  if (tx.state === "invalidated") {
    return { ok: false, reason: "invalidated", retryable: false };
  }
  if (tx.state === "expired") {
    return { ok: false, reason: "not_creditable", retryable: false };
  }
  if (tx.state !== "confirmed") {
    // new / pending / included — keep waiting
    return { ok: false, reason: "not_confirmed", retryable: true };
  }

  return {
    ok: true,
    state: tx.state,
    amountLuna: value,
    senderAddress: gotSender,
  };
}
