import { describe, it, expect } from "vitest";
import { parseSendResult, TxResultError } from "@/lib/nimiq/txResult";

const HASH = "8071e57ec1af3bf63246ba23c3f0288fd7c35dcbb9bdc53e93c8a5d4633e14bd";

describe("parseSendResult", () => {
  it("accepts a bare 64-hex hash (the documented return)", () => {
    expect(parseSendResult(HASH)).toEqual({ txHash: HASH });
  });

  it("normalises 0x prefix and case", () => {
    expect(parseSendResult(`0x${HASH.toUpperCase()}`)).toEqual({ txHash: HASH });
  });

  it("digs a hash out of an object return (device-shape fallback)", () => {
    expect(parseSendResult({ transactionHash: HASH })).toEqual({ txHash: HASH });
    expect(parseSendResult({ hash: `0x${HASH}` })).toEqual({ txHash: HASH });
  });

  it("throws TxResultError on an unrecognised shape", () => {
    expect(() => parseSendResult("not a hash")).toThrow(TxResultError);
    expect(() => parseSendResult(null)).toThrow(TxResultError);
    expect(() => parseSendResult({ nope: 1 })).toThrow(TxResultError);
  });
});
