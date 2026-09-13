import { describe, it, expect } from "vitest";
import {
  verifyTransaction,
  EXPECTED_NETWORK,
  type PlainTxDetails,
  type IntentForVerification,
} from "@/lib/gifts/verification";
import { memoFor } from "@/lib/gifts/shortId";

const SHORT_ID = "abc123def45678";
const RECIPIENT = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";
const SENDER = "NQ55 1111 1111 1111 1111 1111 1111 1111 1111";

function intent(over: Partial<IntentForVerification> = {}): IntentForVerification {
  return {
    id: "intent-1",
    shortId: SHORT_ID,
    memo: memoFor(SHORT_ID),
    recipientAddress: RECIPIENT,
    minAmountLuna: 100_000n,
    currency: "NIM",
    ...over,
  };
}

function tx(over: Partial<PlainTxDetails> = {}): PlainTxDetails {
  return {
    transactionHash: "a".repeat(64),
    state: "confirmed",
    confirmations: 12,
    sender: SENDER,
    recipient: RECIPIENT,
    value: 100_000,
    network: EXPECTED_NETWORK,
    data: { type: "raw", raw: Buffer.from(memoFor(SHORT_ID), "utf8").toString("hex") },
    ...over,
  };
}

describe("verifyTransaction", () => {
  it("accepts a correct, confirmed transaction", () => {
    const r = verifyTransaction(intent(), tx());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amountLuna).toBe(100_000n);
      expect(r.senderAddress).toBeTruthy();
    }
  });

  it("credits the actual amount on overpayment", () => {
    const r = verifyTransaction(intent(), tx({ value: 250_000 }));
    expect(r.ok && r.amountLuna).toBe(250_000n);
  });

  it("rejects the wrong recipient", () => {
    const r = verifyTransaction(
      intent(),
      tx({ recipient: "NQ07 9999 9999 9999 9999 9999 9999 9999 9999" }),
    );
    expect(r).toMatchObject({ ok: false, reason: "wrong_recipient" });
  });

  it("accepts a payment from whichever account the giver actually paid with", () => {
    // Regression: the address a wallet lists first on connect was pinned as the
    // required sender. A giver with several accounts in Nimiq Pay paid from a
    // different one and a genuine gift was refused. Any account may pay.
    for (const sender of [
      "NQ55 1111 1111 1111 1111 1111 1111 1111 1111",
      "NQ55 2222 2222 2222 2222 2222 2222 2222 2222",
      "NQ55 3333 3333 3333 3333 3333 3333 3333 3333",
    ]) {
      const r = verifyTransaction(intent(), tx({ sender }));
      expect(r.ok).toBe(true);
    }
  });

  it("records the real on-chain sender, normalised", () => {
    const r = verifyTransaction(
      intent(),
      tx({ sender: "nq55 2222 2222 2222 2222 2222 2222 2222 2222".replace(/ /g, "") }),
    );
    expect(r).toMatchObject({
      ok: true,
      senderAddress: "NQ55 2222 2222 2222 2222 2222 2222 2222 2222",
    });
  });

  it("rejects a transaction whose sender can't be read", () => {
    for (const sender of ["", "not an address", "NQ55 1111"]) {
      const r = verifyTransaction(intent(), tx({ sender }));
      expect(r).toMatchObject({ ok: false, reason: "wrong_sender", retryable: false });
    }
  });

  it("still ties a payment to its own intent, whoever sent it", () => {
    // Accepting any sender must not let a payment for one gift credit another:
    // the memo is what binds it.
    const r = verifyTransaction(
      intent(),
      tx({
        sender: "NQ55 2222 2222 2222 2222 2222 2222 2222 2222",
        data: {
          type: "raw",
          raw: Buffer.from(memoFor("zzzzzzzzzzzzzz"), "utf8").toString("hex"),
        },
      }),
    );
    expect(r).toMatchObject({ ok: false, reason: "wrong_memo" });
  });

  it("rejects an amount below the minimum", () => {
    const r = verifyTransaction(intent(), tx({ value: 50_000 }));
    expect(r).toMatchObject({ ok: false, reason: "amount_too_low" });
  });

  it("rejects the wrong network", () => {
    // Any network that isn't the configured one — so the case holds whether the
    // app is pointed at mainnet or testnet.
    const other =
      EXPECTED_NETWORK === "testalbatross" ? "mainalbatross" : "testalbatross";
    const r = verifyTransaction(intent(), tx({ network: other }));
    expect(r).toMatchObject({ ok: false, reason: "wrong_network" });
  });

  it("rejects a mismatched memo", () => {
    const r = verifyTransaction(
      intent(),
      tx({ data: { type: "raw", raw: Buffer.from("nimday:someoneelse", "utf8").toString("hex") } }),
    );
    expect(r).toMatchObject({ ok: false, reason: "wrong_memo" });
  });

  it("rejects a non-NIM intent", () => {
    const r = verifyTransaction(intent({ currency: "USDT" }), tx());
    expect(r).toMatchObject({ ok: false, reason: "wrong_currency" });
  });

  it("does not credit an unconfirmed transaction (retryable)", () => {
    for (const state of ["new", "pending", "included"] as const) {
      const r = verifyTransaction(intent(), tx({ state }));
      expect(r).toMatchObject({ ok: false, reason: "not_confirmed", retryable: true });
    }
  });

  it("does not credit an invalidated transaction", () => {
    const r = verifyTransaction(intent(), tx({ state: "invalidated" }));
    expect(r).toMatchObject({ ok: false, reason: "invalidated", retryable: false });
  });

  it("accepts a bare memo string too (no prefix mismatch)", () => {
    const r = verifyTransaction(
      intent(),
      tx({ data: { type: "raw", raw: Buffer.from(memoFor(SHORT_ID), "utf8").toString("hex") } }),
    );
    expect(r.ok).toBe(true);
  });
});
