"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { getMyGiftActivity, type GiftActivity } from "@/lib/apiClient";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function GiftActivityPanel() {
  const [activity, setActivity] = useState<GiftActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyGiftActivity()
      .then(setActivity)
      .catch(() => setActivity(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="h-24 animate-pulse rounded-xl bg-black/5" />
      </Card>
    );
  }

  const items = activity?.items ?? [];
  const totals = activity?.totals ?? { giftCount: 0, totalNim: "0" };

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium text-ink">Gifts</h3>
        <p className="text-sm text-ink/55">
          {totals.giftCount} {totals.giftCount === 1 ? "gift" : "gifts"} ·{" "}
          {totals.totalNim} NIM
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink/50">
          No gifts yet. When someone sends one, it&apos;ll show here once it&apos;s
          verified on the Nimiq network.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {items.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {g.anonymous ? "Someone" : g.senderLabel} gifted{" "}
                  <span className="whitespace-nowrap">{g.amountNim} NIM</span>
                </p>
                <p className="text-xs text-ink/50">
                  {g.wishTitle} · {timeAgo(g.confirmedAt)}
                  {g.status === "REVERSED" ? " · reversed" : ""}
                </p>
              </div>
              {g.anonymous ? (
                <span className="ml-3 flex-none text-xs text-ink/35">anonymous</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
