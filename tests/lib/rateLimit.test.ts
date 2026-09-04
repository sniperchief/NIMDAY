import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetRateLimits,
  checkRateLimit,
  clientKey,
  isDuplicateSubmission,
} from "@/lib/rateLimit";

const OPTS = { limit: 3, windowMs: 60_000 };

beforeEach(() => __resetRateLimits());

describe("checkRateLimit", () => {
  it("allows up to the limit, then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("a", OPTS, now).allowed).toBe(true);
    }
    const blocked = checkRateLimit("a", OPTS, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("lets the window slide", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("b", OPTS, now);
    expect(checkRateLimit("b", OPTS, now + 59_000).allowed).toBe(false);
    expect(checkRateLimit("b", OPTS, now + 61_000).allowed).toBe(true);
  });

  it("keeps keys independent", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("c", OPTS, now);
    expect(checkRateLimit("c", OPTS, now).allowed).toBe(false);
    expect(checkRateLimit("d", OPTS, now).allowed).toBe(true);
  });
});

describe("isDuplicateSubmission", () => {
  it("catches the same text twice inside the window", () => {
    const now = 1_000_000;
    expect(isDuplicateSubmission("k", "happy birthday", 60_000, now)).toBe(false);
    expect(isDuplicateSubmission("k", "happy birthday", 60_000, now + 1_000)).toBe(true);
  });

  it("allows a different message, and the same one later", () => {
    const now = 1_000_000;
    isDuplicateSubmission("k", "one", 60_000, now);
    expect(isDuplicateSubmission("k", "two", 60_000, now)).toBe(false);
    expect(isDuplicateSubmission("k", "one", 60_000, now + 61_000)).toBe(false);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/api/messages", { headers });

  it("prefers the first forwarded address and scopes the key", () => {
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), "message:s")).toBe(
      "message:s:1.2.3.4",
    );
  });

  it("falls back through the other headers", () => {
    expect(clientKey(req({ "x-real-ip": "9.9.9.9" }), "m")).toBe("m:9.9.9.9");
    expect(clientKey(req({}), "m")).toBe("m:unknown");
  });

  it("separates the same client on different NIMdays", () => {
    const h = { "x-forwarded-for": "1.2.3.4" };
    expect(clientKey(req(h), "message:a")).not.toBe(clientKey(req(h), "message:b"));
  });
});
