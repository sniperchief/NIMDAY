"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicBirthday } from "@/lib/birthday";
import type { PublicMessage } from "@/lib/apiClient";
import { BirthdayCard } from "@/components/BirthdayCard";
import { WishList } from "@/components/WishList";
import { ShareSection } from "@/components/ShareControls";
import { getTheme } from "@/lib/themes";
import { cn } from "@/components/ui";
import {
  EMPTY_QUEST,
  completeStep,
  parseQuestState,
  questStorageKey,
  serializeQuestState,
  type QuestState,
  type QuestStepId,
} from "@/lib/quest";
import { GiftFlow } from "@/components/public/GiftFlow";
import { MessageBoard } from "@/components/public/MessageBoard";
import { BirthdayQuest } from "@/components/public/BirthdayQuest";
import { Confetti } from "@/components/public/Confetti";

export function PublicBirthdayView({
  pub,
  url,
  origin,
  giftParam,
  intentParam,
  initialMessages,
  initialMessageCount,
  testnet,
}: {
  pub: PublicBirthday;
  url: string;
  origin: string;
  giftParam: string | null;
  intentParam: string | null;
  initialMessages: PublicMessage[];
  initialMessageCount: number;
  /** server-known: NIMday is pointed at test NIM, so the gift flow says so */
  testnet: boolean;
}) {
  const theme = getTheme(pub.theme);
  const firstName = pub.name.trim().split(/\s+/)[0] || pub.name;

  const [activeWishId, setActiveWishId] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(
    Boolean(intentParam) || giftParam === "1",
  );
  const [quest, setQuest] = useState<QuestState>(EMPTY_QUEST);
  const [confetti, setConfetti] = useState(false);
  const [pendingIntentId, setPendingIntentId] = useState<string | null>(null);

  const wishesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  /* ---- quest: derived from what the visitor does, kept on their device ---- */

  const markStep = useCallback(
    (step: QuestStepId) => {
      setQuest((prev) => {
        const next = completeStep(prev, step);
        if (next !== prev) {
          try {
            window.localStorage.setItem(
              questStorageKey(pub.slug),
              serializeQuestState(next),
            );
          } catch {
            /* storage blocked — the quest just resets next visit */
          }
        }
        return next;
      });
    },
    [pub.slug],
  );

  useEffect(() => {
    let restored = EMPTY_QUEST;
    try {
      restored = parseQuestState(
        window.localStorage.getItem(questStorageKey(pub.slug)),
      );
    } catch {
      /* storage blocked */
    }
    setQuest(restored);
    // Being here *is* the first step.
    const next = completeStep(restored, "visit");
    setQuest(next);
    try {
      window.localStorage.setItem(
        questStorageKey(pub.slug),
        serializeQuestState(next),
      );
    } catch {
      /* storage blocked */
    }
  }, [pub.slug]);

  const scrollTo = useCallback((el: HTMLElement | null) => {
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function handleQuestAction(step: QuestStepId) {
    switch (step) {
      case "visit":
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "message":
        scrollTo(composerRef.current);
        break;
      case "wish":
        scrollTo(wishesRef.current);
        break;
      case "celebrate":
        setConfetti(true);
        markStep("celebrate");
        break;
    }
  }

  /* ---- gifting ---- */

  const clearGiftParams = useCallback(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.delete("gift");
    u.searchParams.delete("intent");
    window.history.replaceState({}, "", u.toString());
  }, []);

  useEffect(() => {
    if (!open) clearGiftParams();
  }, [open, clearGiftParams]);

  function openGift(wishId: string) {
    setActiveWishId(wishId);
    setOpen(true);
    markStep("wish");
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 animate-fade-up sm:space-y-5">
      <BirthdayCard
        data={{
          name: pub.name,
          birthday: pub.birthday,
          message: pub.message,
          theme: pub.theme,
          imageUrl: pub.imageUrl,
        }}
      >
        {pub.wishes.length > 0 ? (
          <div ref={wishesRef} className="scroll-mt-4">
            <WishList
              wishes={pub.wishes}
              theme={pub.theme}
              onGift={openGift}
              heading={
                <div className="mb-3">
                  <h2 className={cn("text-base font-semibold", theme.text)}>
                    Things {firstName} would love
                  </h2>
                  <p className={cn("mt-0.5 text-[13px]", theme.muted)}>
                    Tap one to send a gift — any amount helps.
                  </p>
                </div>
              }
            />
          </div>
        ) : (
          <p className={cn("text-center text-sm", theme.muted)}>
            No wishes on this NIMday — but a message would still make their day.
          </p>
        )}
      </BirthdayCard>

      <BirthdayQuest
        state={quest}
        theme={pub.theme}
        onStepAction={handleQuestAction}
      />

      <MessageBoard
        slug={pub.slug}
        birthdayName={pub.name}
        theme={pub.theme}
        initialMessages={initialMessages}
        initialTotal={initialMessageCount}
        pendingIntentId={pendingIntentId}
        composerRef={composerRef}
        onPosted={() => {
          markStep("message");
          setPendingIntentId(null);
        }}
      />

      <ShareSection
        url={url}
        name={pub.name}
        audience="visitor"
        tone="light"
        title={`Share ${firstName}'s NIMday`}
        subtitle="Someone else would love to wish them happy birthday too."
      />

      <p className="pb-2 pt-1 text-center text-xs text-black/40">
        Made with{" "}
        <a href={origin} className="font-medium underline">
          NIMday
        </a>{" "}
        · your own birthday page takes a minute
      </p>

      {confetti ? (
        <Confetti colors={theme.swatches} onDone={() => setConfetti(false)} />
      ) : null}

      <GiftFlow
        open={open}
        slug={pub.slug}
        origin={origin}
        birthdayName={pub.name}
        wishes={pub.wishes}
        testnet={testnet}
        initialWishId={activeWishId ?? pub.wishes[0]?.id ?? null}
        resumeIntentId={intentParam}
        onWishChosen={() => markStep("wish")}
        onGiftConfirmed={(intentId) => {
          setPendingIntentId(intentId);
          setConfetti(true);
          markStep("wish");
        }}
        onLeaveMessage={() => {
          setOpen(false);
          setActiveWishId(null);
          setTimeout(() => scrollTo(composerRef.current), 120);
        }}
        onClose={() => {
          setOpen(false);
          setActiveWishId(null);
        }}
      />
    </div>
  );
}
