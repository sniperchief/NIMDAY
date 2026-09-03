import { describe, it, expect } from "vitest";
import {
  encodeSignedMessage,
  verifyNimiqSignature,
  normalizeAddress,
} from "@/lib/nimiq/verifySignature";
import { newKeyPair } from "../helpers/nimiq";

describe("encodeSignedMessage", () => {
  it("raw-utf8 returns the message bytes unchanged", () => {
    expect(encodeSignedMessage("hello", "raw-utf8")).toEqual(
      new TextEncoder().encode("hello"),
    );
  });
  it("sha256-utf8 returns a 32-byte digest", () => {
    expect(encodeSignedMessage("hello", "sha256-utf8")).toHaveLength(32);
  });
  it("nimiq-signed-message returns a 32-byte digest", () => {
    expect(encodeSignedMessage("hello", "nimiq-signed-message")).toHaveLength(32);
  });
});

describe("verifyNimiqSignature", () => {
  it("verifies a real signature and derives the signer address", async () => {
    const kp = await newKeyPair();
    const message = "Sign in to NIMday\n\nNonce: abc123";
    const Nimiq = await import("@nimiq/core");
    const sig = kp.sign(new TextEncoder().encode(message));

    const result = await verifyNimiqSignature({
      message,
      publicKey: kp.publicKey.toHex(),
      signature: sig.toHex(),
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.encoding).toBe("raw-utf8");
      expect(normalizeAddress(result.address)).toBe(
        normalizeAddress(kp.toAddress().toUserFriendlyAddress()),
      );
    }
    void Nimiq;
  });

  it("rejects a signature over a different message", async () => {
    const kp = await newKeyPair();
    const sig = kp.sign(new TextEncoder().encode("the real message"));
    const result = await verifyNimiqSignature({
      message: "a tampered message",
      publicKey: kp.publicKey.toHex(),
      signature: sig.toHex(),
    });
    expect(result).toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects malformed hex", async () => {
    const result = await verifyNimiqSignature({
      message: "x",
      publicKey: "nothex",
      signature: "nothex",
    });
    expect(result).toEqual({ valid: false, reason: "malformed" });
  });
});

describe("normalizeAddress", () => {
  it("round-trips a real address regardless of spacing / case", async () => {
    const kp = await newKeyPair();
    const friendly = kp.toAddress().toUserFriendlyAddress(); // "NQxx xxxx ..."
    const canonical = normalizeAddress(friendly);
    expect(canonical).toBe(friendly);
    expect(normalizeAddress(friendly.replace(/\s/g, "").toLowerCase())).toBe(
      friendly,
    );
  });
  it("returns null for junk", () => {
    expect(normalizeAddress("hello")).toBeNull();
  });
});
