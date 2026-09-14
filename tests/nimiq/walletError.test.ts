/**
 * A real Nimiq Pay device rejected a transaction with a plain object, not an
 * Error. `String(err)` turned that into "[object Object]", which told the user
 * nothing and — worse — defeated every keyword rule underneath, so a declined
 * transaction was reported as an unknown failure.
 */
import { describe, it, expect } from "vitest";
import {
  WalletError,
  classifyWalletError,
  describeWalletError,
  errorText,
  friendlyWalletMessage,
  isProviderError,
} from "@/lib/nimiq/walletError";
import { TxResultError } from "@/lib/nimiq/txResult";

describe("errorText", () => {
  it("never returns [object Object]", () => {
    for (const thrown of [
      { error: { type: "SOME_TYPE", message: "went wrong" } },
      { weird: true },
      { nested: { deep: 1 } },
      Object.create(null),
      {},
    ]) {
      expect(errorText(thrown)).not.toContain("[object Object]");
    }
  });

  it("unwraps the provider's error envelope", () => {
    expect(
      errorText({ error: { type: "USER_REJECTED", message: "User declined" } }),
    ).toBe("USER_REJECTED: User declined");
    expect(errorText({ error: { message: "only a message" } })).toBe(
      "only a message",
    );
    expect(errorText({ error: { type: "ONLY_TYPE" } })).toBe("ONLY_TYPE");
  });

  it("reads Errors and strings directly", () => {
    expect(errorText(new Error("boom"))).toBe("boom");
    expect(errorText("plain string")).toBe("plain string");
  });

  it("falls back to a message-ish field, then to JSON", () => {
    expect(errorText({ message: "field message" })).toBe("field message");
    expect(errorText({ reason: "field reason" })).toBe("field reason");
    expect(errorText({ code: "E_CODE" })).toBe("E_CODE");
    expect(errorText({ a: 1, b: "two" })).toBe('{"a":1,"b":"two"}');
  });

  it("survives circular objects and empty values", () => {
    const circular: Record<string, unknown> = { name: undefined };
    circular.self = circular;
    expect(() => errorText(circular)).not.toThrow();
    expect(errorText(undefined)).toBe("No error detail");
    expect(errorText(null)).toBe("null");
  });
});

describe("classifyWalletError", () => {
  it("classifies a rejection thrown as a bare object", () => {
    // The exact shape that produced "[object Object]" on a real device.
    const err = classifyWalletError({
      error: { type: "USER_REJECTED", message: "User rejected the request" },
    });
    expect(err.code).toBe("rejected");
    expect(err.message).toContain("USER_REJECTED");
  });

  it("classifies insufficient funds, consensus and malformed transactions", () => {
    expect(
      classifyWalletError({ error: { message: "Insufficient balance" } }).code,
    ).toBe("insufficient");
    expect(
      classifyWalletError({ error: { message: "Consensus not established" } }).code,
    ).toBe("consensus");
    // The exact message a real device produced when its own client couldn't
    // read the account.
    expect(
      classifyWalletError(
        "Failed to send payment transaction: Something went wrong syncing your account",
      ).code,
    ).toBe("consensus");
    expect(
      classifyWalletError({ error: { message: "Invalid recipient address" } }).code,
    ).toBe("invalid-tx");
  });

  it("passes through WalletError and TxResultError untouched", () => {
    const original = new WalletError("no-account", "none");
    expect(classifyWalletError(original)).toBe(original);
    expect(classifyWalletError(new TxResultError()).code).toBe("tx-result");
  });

  it("falls back to unknown, keeping readable detail", () => {
    const err = classifyWalletError({ error: { type: "WEIRD_NEW_THING" } });
    expect(err.code).toBe("unknown");
    expect(err.message).toBe("WEIRD_NEW_THING");
    expect(err.message).not.toContain("[object Object]");
  });
});

describe("describeWalletError", () => {
  it("adds the wallet's words only for unrecognised failures", () => {
    const unknown = new WalletError("unknown", "SOMETHING_ODD");
    expect(describeWalletError(unknown)).toContain("Nimiq Pay said: SOMETHING_ODD");

    const rejected = new WalletError("rejected", "USER_REJECTED: declined");
    expect(describeWalletError(rejected)).toBe(friendlyWalletMessage("rejected"));
    expect(describeWalletError(rejected)).not.toContain("USER_REJECTED");
  });

  it("words 'not in Nimiq Pay' for what the visitor was doing", () => {
    const missing = new WalletError("unavailable", "Nimiq provider was not injected");
    expect(describeWalletError(missing, "connect")).toContain("Connecting a wallet");
    expect(describeWalletError(missing, "connect")).not.toContain("gift");
    expect(describeWalletError(missing)).toContain("Gifts are sent");
    // The SDK's internal wording never reaches the visitor.
    expect(describeWalletError(missing, "connect")).not.toContain("injected");
  });

  it("does not repeat itself when there is no extra detail", () => {
    const bare = new WalletError("unknown", "");
    expect(describeWalletError(bare)).toBe(friendlyWalletMessage("unknown"));
  });
});

describe("isProviderError", () => {
  it("only matches the envelope shape", () => {
    expect(isProviderError({ error: { message: "x" } })).toBe(true);
    expect(isProviderError({ error: "not an object" })).toBe(false);
    expect(isProviderError({ message: "x" })).toBe(false);
    expect(isProviderError(null)).toBe(false);
  });
});
