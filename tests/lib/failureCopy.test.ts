import { describe, it, expect } from "vitest";
import { giftFailureMessage, paymentStateCopy } from "@/lib/gifts/failureCopy";
import type { VerificationFailure } from "@/lib/gifts/verification";

const ALL_REASONS: VerificationFailure[] = [
  "wrong_currency",
  "wrong_network",
  "wrong_recipient",
  "wrong_sender",
  "wrong_memo",
  "amount_too_low",
  "not_confirmed",
  "invalidated",
  "not_creditable",
];

describe("giftFailureMessage", () => {
  it("has human copy for every verification failure", () => {
    for (const reason of ALL_REASONS) {
      const copy = giftFailureMessage(reason);
      expect(copy.length).toBeGreaterThan(20);
      // never leaks the machine reason or anything that looks like a stack trace
      expect(copy).not.toContain(reason);
      expect(copy).not.toMatch(/Error|_|\bat \w+\(/);
    }
  });

  it("explains wrong_recipient the way a person would", () => {
    expect(giftFailureMessage("wrong_recipient")).toBe(
      "We couldn't confirm this gift. The payment was sent to a different address.",
    );
  });

  it("falls back safely for an unknown or missing reason", () => {
    expect(giftFailureMessage(null)).toBe(
      "We couldn't confirm that gift, so nothing was recorded.",
    );
    expect(giftFailureMessage("something_new_from_the_worker")).toBe(
      "We couldn't confirm that gift, so nothing was recorded.",
    );
  });
});

describe("paymentStateCopy", () => {
  it("covers every payment state the giver can see", () => {
    for (const status of [
      "CREATED",
      "SUBMITTED",
      "PENDING",
      "CONFIRMED",
      "FAILED",
      "EXPIRED",
    ]) {
      const copy = paymentStateCopy(status, null);
      expect(copy.title).toBeTruthy();
      expect(copy.body).toBeTruthy();
      expect(copy.title).not.toBe(status);
    }
  });

  it("never says a submitted payment is 'sent'", () => {
    const copy = paymentStateCopy("SUBMITTED", null);
    expect(copy.title.toLowerCase()).toContain("verifying");
    expect(copy.title.toLowerCase()).not.toMatch(/\bsent\b/);
  });

  it("carries the failure reason into the failed state", () => {
    expect(paymentStateCopy("FAILED", "wrong_recipient").body).toBe(
      giftFailureMessage("wrong_recipient"),
    );
  });

  it("has a safe default for an unrecognised status", () => {
    expect(paymentStateCopy("WHAT", null).title).toBe("Checking your gift");
  });
});
