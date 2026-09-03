/** Format a NIM/USDT amount for display: trim trailing zeros, group thousands. */
export function formatAmount(
  value: string | number,
  currency: "NIM" | "USDT",
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return `0 ${currency}`;
  const fixed = n.toFixed(5).replace(/\.?0+$/, "");
  const [intPart, frac] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${frac ? `${grouped}.${frac}` : grouped} ${currency}`;
}

export const GIFT_TYPE_LABEL: Record<"FUND" | "BUY" | "EITHER", string> = {
  FUND: "Fund this gift",
  BUY: "Buy this gift",
  EITHER: "Gift or contribute",
};
