import { describe, it, expect } from "vitest";
import {
  verifyChallenge,
  buildChallengeMessage,
  type StoredNonce,
} from "@/lib/nimiq/challenge";
import { signChallenge, newKeyPair } from "../helpers/nimiq";

const NONCE = "nonce-abcdefgh12345678";

function storedNonce(over: Partial<StoredNonce> = {}): StoredNonce {
  return {
    value: NONCE,
    address: "NQ00",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    ...over,
  };
}

describe("verifyChallenge", () => {
  it("accepts a valid signature over the current challenge", async () => {
    const signed = await signChallenge(NONCE);
    const res = await verifyChallenge({ nonce: NONCE, ...signed }, storedNonce());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.address).toBeTruthy();
  });

  it("rejects a signature over a tampered message", async () => {
    const signed = await signChallenge(NONCE);
    // sign a different nonce's message but submit it against NONCE
    const other = await signChallenge("some-other-nonce-value");
    const res = await verifyChallenge(
      { nonce: NONCE, ...signed, signature: other.signature },
      storedNonce(),
    );
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects when the claimed address doesn't match the signing key", async () => {
    const signed = await signChallenge(NONCE);
    const stranger = await newKeyPair();
    const res = await verifyChallenge(
      {
        nonce: NONCE,
        ...signed,
        address: stranger.toAddress().toUserFriendlyAddress(),
      },
      storedNonce(),
    );
    expect(res).toEqual({ ok: false, reason: "address_mismatch" });
  });

  it("rejects an expired nonce", async () => {
    const signed = await signChallenge(NONCE);
    const res = await verifyChallenge(
      { nonce: NONCE, ...signed },
      storedNonce({ expiresAt: new Date(Date.now() - 1000) }),
    );
    expect(res).toEqual({ ok: false, reason: "nonce_expired" });
  });

  it("rejects a reused nonce", async () => {
    const signed = await signChallenge(NONCE);
    const res = await verifyChallenge(
      { nonce: NONCE, ...signed },
      storedNonce({ usedAt: new Date() }),
    );
    expect(res).toEqual({ ok: false, reason: "nonce_used" });
  });

  it("rejects when the nonce is unknown", async () => {
    const signed = await signChallenge(NONCE);
    const res = await verifyChallenge({ nonce: NONCE, ...signed }, null);
    expect(res).toEqual({ ok: false, reason: "nonce_not_found" });
  });

  it("rejects malformed submissions", async () => {
    const res = await verifyChallenge(
      { nonce: "", address: "", publicKey: "", signature: "" },
      storedNonce(),
    );
    expect(res).toEqual({ ok: false, reason: "malformed" });
  });

  it("challenge message is stable and contains the nonce", () => {
    expect(buildChallengeMessage("XYZ")).toContain("Nonce: XYZ");
  });
});
