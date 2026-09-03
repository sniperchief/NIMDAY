"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Phase 1 gift CTA. Real NIM gifting arrives in Phase 2 — this never initiates a
 * transaction and never shows fake progress. It opens a short "coming next" note
 * and offers to open the page inside Nimiq Pay (using the prepared deep link),
 * which is harmless: the app just loads this same page.
 */
export function GiftCta({
  deepLinkHttps,
  accentClass,
  accentTextClass,
  autoOpen = false,
}: {
  deepLinkHttps: string;
  accentClass: string;
  accentTextClass: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="rounded-2xl bg-black/[0.04] p-4 text-center ring-1 ring-black/5">
        <button
          onClick={() => setOpen(true)}
          className={`w-full rounded-full px-6 py-3.5 text-base font-medium ${accentClass} ${accentTextClass} transition active:scale-[0.98]`}
        >
          🎁 Send a Gift
        </button>
        <p className="mt-2 text-xs text-black/50">
          Gifting with NIM is coming next.
        </p>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Gifting coming soon"
        >
          <div
            className="w-full max-w-sm animate-pop-in rounded-3xl bg-white p-6 text-center text-ink shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/5 text-2xl">
              🎁
            </div>
            <h3 className="text-lg font-semibold">Gifting is coming next</h3>
            <p className="mt-2 text-sm text-ink/65">
              Very soon you&apos;ll be able to send a NIM gift straight to the
              birthday person&apos;s wallet — verified, with no middleman. For now,
              you can still leave the card open and come back.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <a
                href={deepLinkHttps}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream"
              >
                Open in Nimiq Pay
              </a>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Back to the card
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
