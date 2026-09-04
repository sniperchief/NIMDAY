"use client";

import { useCallback, useEffect, useState } from "react";
import type { EditorBirthday } from "@/lib/apiClient";
import { EMPTY_DRAFT, type Draft, type DraftWish } from "./types";

const KEY = "nimday:draft:v1";

export function draftFromEditor(b: EditorBirthday): Draft {
  return {
    name: b.name,
    birthday: b.birthday,
    message: b.message ?? "",
    theme: b.theme,
    imageUrl: b.imageUrl ?? "",
    wishes: b.wishes.map<DraftWish>((w) => ({
      key: w.id,
      serverId: w.id,
      title: w.title,
      description: w.description ?? "",
      imageUrl: w.imageUrl ?? "",
      targetAmount: String(Number(w.targetAmount)),
      giftType: w.giftType,
      giftCount: w.giftCount,
      raisedNim: w.raisedNim,
    })),
  };
}

export function useDraft() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, hydrated]);

  const patch = useCallback((p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setDraft(EMPTY_DRAFT);
  }, []);

  return { draft, setDraft, patch, clear, hydrated };
}
