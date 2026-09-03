import { describe, it, expect } from "vitest";
import {
  generateShortId,
  memoFor,
  shortIdFromMemo,
  memoByteLength,
  SHORT_ID_LENGTH,
} from "@/lib/gifts/shortId";

describe("shortId / memo", () => {
  it("generates lowercase alphanumeric ids of the fixed length", () => {
    const id = generateShortId();
    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(id).toHaveLength(SHORT_ID_LENGTH);
  });

  it("memo stays well under the 40-byte target", () => {
    expect(memoByteLength(memoFor(generateShortId()))).toBeLessThan(40);
  });

  it("round-trips shortId <-> memo", () => {
    const id = generateShortId();
    expect(shortIdFromMemo(memoFor(id))).toBe(id);
  });

  it("rejects memos that aren't ours", () => {
    expect(shortIdFromMemo("hello world")).toBeNull();
    expect(shortIdFromMemo("nimday:")).toBeNull();
    expect(shortIdFromMemo("nimday:!!!")).toBeNull();
    expect(shortIdFromMemo("")).toBeNull();
  });

  it("ids are unique across many draws", () => {
    const set = new Set(Array.from({ length: 500 }, generateShortId));
    expect(set.size).toBe(500);
  });
});
