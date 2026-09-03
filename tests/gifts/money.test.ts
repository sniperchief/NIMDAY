import { describe, it, expect } from "vitest";
import {
  nimStringToLuna,
  lunaToNimString,
  formatLuna,
  toLuna,
  lunaToSdkValue,
  LUNA_PER_NIM,
  MoneyError,
} from "@/lib/money";

describe("nimStringToLuna", () => {
  it("1 NIM = 100000 Luna", () => {
    expect(nimStringToLuna("1")).toBe(100_000n);
    expect(LUNA_PER_NIM).toBe(100_000n);
  });

  it("converts decimals with integer maths", () => {
    expect(nimStringToLuna("1.25")).toBe(125_000n);
    expect(nimStringToLuna("0.00001")).toBe(1n);
    expect(nimStringToLuna("10.5")).toBe(1_050_000n);
    expect(nimStringToLuna("1234.56789")).toBe(123_456_789n);
  });

  it("rejects zero", () => {
    expect(() => nimStringToLuna("0")).toThrow(MoneyError);
    expect(() => nimStringToLuna("0.00000")).toThrow(MoneyError);
  });

  it("rejects negatives", () => {
    expect(() => nimStringToLuna("-1")).toThrow(MoneyError);
  });

  it("rejects > 5 decimal places (unsafe precision)", () => {
    expect(() => nimStringToLuna("1.000001")).toThrow(/decimal places/);
  });

  it("rejects non-numeric input", () => {
    expect(() => nimStringToLuna("abc")).toThrow(MoneyError);
    expect(() => nimStringToLuna("")).toThrow(MoneyError);
    expect(() => nimStringToLuna("1.2.3")).toThrow(MoneyError);
    expect(() => nimStringToLuna("1e5")).toThrow(MoneyError);
  });

  it("rejects absurdly large amounts", () => {
    expect(() => nimStringToLuna("999999999")).toThrow(/too large/);
  });
});

describe("lunaToNimString / formatLuna", () => {
  it("trims trailing zeros", () => {
    expect(lunaToNimString(125_000n)).toBe("1.25");
    expect(lunaToNimString(100_000n)).toBe("1");
    expect(lunaToNimString(1n)).toBe("0.00001");
    expect(lunaToNimString(0n)).toBe("0");
  });
  it("groups thousands for display", () => {
    expect(formatLuna(1_250_000_00n)).toBe("1,250 NIM");
  });
});

describe("toLuna (string | number)", () => {
  it("accepts a safe number", () => {
    expect(toLuna(1.25)).toBe(125_000n);
  });
  it("routes through precision rules", () => {
    expect(() => toLuna(Number.NaN)).toThrow(MoneyError);
  });
});

describe("lunaToSdkValue", () => {
  it("returns a plain number for accepted amounts", () => {
    expect(lunaToSdkValue(125_000n)).toBe(125000);
  });
  it("rejects out-of-range", () => {
    expect(() => lunaToSdkValue(0n)).toThrow(MoneyError);
    expect(() => lunaToSdkValue(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow();
  });
});
