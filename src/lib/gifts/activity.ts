import "server-only";
import { prisma } from "@/lib/prisma";
import { lunaToNimString } from "@/lib/money";
import { maskAddress } from "@/lib/nimiq/address";

export interface GiftActivityItem {
  id: string;
  wishTitle: string;
  amountNim: string;
  currency: "NIM";
  anonymous: boolean;
  /** masked address for named gifts, null when the giver chose anonymous */
  senderLabel: string | null;
  confirmedAt: string;
  status: "CONFIRMED" | "REVERSED";
}

export interface GiftActivity {
  items: GiftActivityItem[];
  totals: {
    giftCount: number;
    totalNim: string;
  };
}


export async function getGiftActivity(birthdayId: string): Promise<GiftActivity> {
  const gifts = await prisma.gift.findMany({
    where: { birthdayId },
    include: { wish: true },
    orderBy: { confirmedAt: "desc" },
    take: 50,
  });

  const items: GiftActivityItem[] = gifts.map((g) => ({
    id: g.id,
    wishTitle: g.wish.title,
    amountNim: lunaToNimString(g.amountLuna),
    currency: "NIM",
    anonymous: g.anonymous,
    senderLabel: g.anonymous ? null : maskAddress(g.senderAddress),
    confirmedAt: g.confirmedAt.toISOString(),
    status: g.status,
  }));

  const confirmed = gifts.filter((g) => g.status === "CONFIRMED");
  const totalLuna = confirmed.reduce((sum, g) => sum + g.amountLuna, 0n);

  return {
    items,
    totals: {
      giftCount: confirmed.length,
      totalNim: lunaToNimString(totalLuna),
    },
  };
}
