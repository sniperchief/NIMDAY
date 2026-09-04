/**
 * NIMIQ_NETWORK is the one setting that decides which chain a gift has to be
 * on to count. There is exactly one reader of it (`lib/env`), it accepts only
 * real Nimiq networks, and testnet is never silent.
 */
import { describe, it, expect } from "vitest";
import {
  NIMIQ_MAINNET,
  NIMIQ_NETWORKS,
  resolveNimiqNetwork,
} from "@/lib/env";

describe("Nimiq network configuration", () => {
  it("defaults to mainnet when nothing is set", () => {
    expect(resolveNimiqNetwork(undefined)).toBe(NIMIQ_MAINNET);
    expect(resolveNimiqNetwork("")).toBe(NIMIQ_MAINNET);
    expect(resolveNimiqNetwork("   ")).toBe(NIMIQ_MAINNET);
  });

  it("accepts every network it claims to support", () => {
    for (const n of NIMIQ_NETWORKS) {
      expect(resolveNimiqNetwork(n)).toBe(n);
    }
    expect(NIMIQ_NETWORKS).toContain("mainalbatross");
    expect(NIMIQ_NETWORKS).toContain("testalbatross");
  });

  it("refuses a plausible-looking typo instead of failing every payment later", () => {
    // Left unvalidated, each of these would verify nothing: `tx.network` would
    // never match, so every real gift would be rejected as "wrong network".
    for (const bad of ["mainnet", "testnet", "main-albatross", "albatross", "MAINALBATROSS"]) {
      expect(() => resolveNimiqNetwork(bad)).toThrow(/not a Nimiq network/i);
    }
  });

  it("names the setting and the valid values when it refuses", () => {
    expect(() => resolveNimiqNetwork("mainnet")).toThrow(/NIMIQ_NETWORK/);
    expect(() => resolveNimiqNetwork("mainnet")).toThrow(/mainalbatross/);
  });

  it("is the same value the verifier enforces", async () => {
    const { EXPECTED_NETWORK } = await import("@/lib/gifts/verification");
    expect(EXPECTED_NETWORK).toBe(resolveNimiqNetwork(process.env.NIMIQ_NETWORK));
    expect(NIMIQ_NETWORKS as readonly string[]).toContain(EXPECTED_NETWORK);
  });

  it("is the same value the light client syncs", async () => {
    const { nimiqNetwork } = await import("@/lib/nimiq/client");
    const { EXPECTED_NETWORK } = await import("@/lib/gifts/verification");
    // The worker watching one chain while verification expects another would
    // mean nothing ever confirms; there is only one reader, so it can't happen.
    expect(nimiqNetwork()).toBe(EXPECTED_NETWORK);
  });

  it("reports testnet as testnet, whatever the process is pointed at", async () => {
    const { env } = await import("@/lib/env");
    expect(env.isTestnet()).toBe(env.nimiqNetwork() !== NIMIQ_MAINNET);
  });
});
