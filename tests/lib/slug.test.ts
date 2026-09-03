import { describe, it, expect } from "vitest";
import { slugifyName, generateUniqueSlug } from "@/lib/slug";

describe("slugifyName", () => {
  it("lowercases, strips punctuation, joins with hyphens", () => {
    expect(slugifyName("Sarah López!!")).toBe("sarah-lopez");
  });
  it("falls back to 'nimday' for empty input", () => {
    expect(slugifyName("  ***  ")).toBe("nimday");
  });
});

describe("generateUniqueSlug", () => {
  it("returns a candidate that passes the exists check", async () => {
    const slug = await generateUniqueSlug("Sarah", async () => false);
    expect(slug.startsWith("sarah-")).toBe(true);
  });

  it("retries until it finds a free slug", async () => {
    let calls = 0;
    const slug = await generateUniqueSlug("Sam", async () => {
      calls += 1;
      return calls < 3; // first two taken
    });
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(slug.startsWith("sam-")).toBe(true);
  });
});
