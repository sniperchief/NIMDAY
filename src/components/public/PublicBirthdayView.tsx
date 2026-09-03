"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicBirthday } from "@/lib/birthday";
import { BirthdayCard } from "@/components/BirthdayCard";
import { ShareControls } from "@/components/ShareControls";
import { GiftFlow } from "@/components/public/GiftFlow";

export function PublicBirthdayView({
  pub,
  url,
  origin,
  giftParam,
  intentParam,
}: {
  pub: PublicBirthday;
  url: string;
  origin: string;
  giftParam: string | null;
  intentParam: string | null;
}) {
  const [activeWishId, setActiveWishId] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(
    Boolean(intentParam) || giftParam === "1",
  );

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

  return (
    <div className="mx-auto w-full max-w-lg animate-fade-up">
      <BirthdayCard
        data={pub}
        onWishGift={(wishId) => {
          setActiveWishId(wishId);
          setOpen(true);
        }}
        action={
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-black/45">
              Know someone who&apos;d want to celebrate too?
            </p>
            <ShareControls url={url} compact />
          </div>
        }
      />
      <p className="mt-6 text-center text-xs text-black/40">
        Made with{" "}
        <a href={origin} className="font-medium underline">
          NIMday
        </a>
      </p>

      <GiftFlow
        open={open}
        slug={pub.slug}
        origin={origin}
        birthdayName={pub.name}
        wishes={pub.wishes}
        initialWishId={activeWishId ?? pub.wishes[0]?.id ?? null}
        resumeIntentId={intentParam}
        onClose={() => {
          setOpen(false);
          setActiveWishId(null);
        }}
      />
    </div>
  );
}
