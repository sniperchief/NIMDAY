/**
 * NIM ⇄ Luna. All monetary maths is integer (bigint) — never floating point.
 *   1 NIM = 100_000 Luna (NIM has 5 decimal places).
 */

export const NIM_DECIMALS = 5;
export const LUNA_PER_NIM = 100_000n;

/** Largest gift we'll accept, as a sanity bound (10 million NIM). */
export const MAX_GIFT_LUNA = 10_000_000n * LUNA_PER_NIM;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Parse a human NIM amount ("1.25", "10", " 0.5 ") to integer Luna.
 * Rejects: empty, non-numeric, negative, zero, > 5 decimal places, and
 * anything above MAX_GIFT_LUNA. Never uses Number for the value.
 */
export function nimStringToLuna(input: string): bigint {
  if (typeof input !== "string") throw new MoneyError("Enter an amount");
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new MoneyError("Enter a valid NIM amount");
  }

  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > NIM_DECIMALS) {
    throw new MoneyError(`NIM has at most ${NIM_DECIMALS} decimal places`);
  }

  const paddedFrac = frac.padEnd(NIM_DECIMALS, "0");
  const luna = BigInt(whole) * LUNA_PER_NIM + BigInt(paddedFrac || "0");

  if (luna <= 0n) throw new MoneyError("Amount must be more than 0");
  if (luna > MAX_GIFT_LUNA) throw new MoneyError("That amount is too large");
  return luna;
}

/** Accept a string or a finite number that safely represents whole/■.5-dp NIM. */
export function toLuna(input: string | number): bigint {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new MoneyError("Enter a valid amount");
    // Route through the string parser so precision rules are enforced once.
    return nimStringToLuna(
      input.toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: NIM_DECIMALS,
      }),
    );
  }
  return nimStringToLuna(input);
}

/** Format integer Luna as a trimmed NIM string ("125000" -> "1.25"). */
export function lunaToNimString(luna: bigint): string {
  const negative = luna < 0n;
  const abs = negative ? -luna : luna;
  const whole = abs / LUNA_PER_NIM;
  const frac = (abs % LUNA_PER_NIM).toString().padStart(NIM_DECIMALS, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return negative ? `-${body}` : body;
}

/** Grouped display, e.g. "1,250 NIM". */
export function formatLuna(luna: bigint): string {
  const s = lunaToNimString(luna);
  const [intPart, frac] = s.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${frac ? `${grouped}.${frac}` : grouped} NIM`;
}

/**
 * The largest Luna value we can hand to the mini-app SDK, which takes a JS
 * number. MAX_GIFT_LUNA (1e12) is far below Number.MAX_SAFE_INTEGER (~9e15),
 * so any accepted gift converts losslessly — but assert it anyway.
 */
export function lunaToSdkValue(luna: bigint): number {
  if (luna <= 0n || luna > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyError("Amount is out of range");
  }
  return Number(luna);
}
