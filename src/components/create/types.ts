import { DEFAULT_THEME_ID } from "@/lib/themes";

export interface DraftWish {
  /** stable client key; server id once created */
  key: string;
  serverId?: string;
  title: string;
  description: string;
  imageUrl: string;
  targetAmount: string; // kept as string for the input
  giftType: "FUND" | "BUY" | "EITHER";
}

export interface Draft {
  name: string;
  birthday: string; // YYYY-MM-DD
  message: string;
  theme: string;
  imageUrl: string;
  wishes: DraftWish[];
}

export const EMPTY_DRAFT: Draft = {
  name: "",
  birthday: "",
  message: "",
  theme: DEFAULT_THEME_ID,
  imageUrl: "",
  wishes: [],
};

export function newWish(): DraftWish {
  return {
    key:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.random()),
    title: "",
    description: "",
    imageUrl: "",
    targetAmount: "",
    giftType: "EITHER",
  };
}
