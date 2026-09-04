/**
 * Pure formatting for the creator's activity feed. Kept separate from the
 * query so the exact wording — and the anonymity rules baked into it — can be
 * unit-tested without a database.
 */

export type ActivityKind = "gift" | "message" | "fulfilled";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** ISO timestamp */
  at: string;
  /** display label for whoever did it — null when anonymous or not applicable */
  actor: string | null;
  amountNim?: string;
  wishTitle?: string;
  /** short excerpt of a message, already trimmed */
  excerpt?: string;
  /** a gift that was later reversed still shows, but says so */
  reversed?: boolean;
}

export function activityEmoji(kind: ActivityKind): string {
  return kind === "gift" ? "🎁" : kind === "message" ? "💌" : "🎉";
}

/** One line of feed copy. Never contains a raw address — `actor` is pre-masked. */
export function activityLine(item: ActivityItem): string {
  const who = item.actor ?? "Someone";
  switch (item.kind) {
    case "gift": {
      const base = `${who} gifted ${item.amountNim} NIM${
        item.wishTitle ? ` toward ${item.wishTitle}` : ""
      }`;
      return item.reversed ? `${base} — later reversed by the network` : base;
    }
    case "message":
      return item.actor
        ? `${who} left you a birthday message`
        : "Someone left you a birthday message";
    case "fulfilled":
      return `${item.wishTitle} wish fulfilled`;
  }
}

/** "just now" / "12 min ago" / a date. Shared by the dashboard and the feed. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = now - then;
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h === 1) return "1 hour ago";
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function excerpt(text: string, max = 70): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return [...clean].length <= max ? clean : `${[...clean].slice(0, max - 1).join("")}…`;
}
