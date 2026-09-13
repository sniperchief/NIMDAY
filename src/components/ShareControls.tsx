"use client";

import { useState } from "react";
import { Button, cn } from "@/components/ui";
import { prettyUrl, sharePayload, whatsappShareUrl } from "@/lib/share";

type Audience = "creator" | "visitor";

function useShare(name: string, url: string, audience: Audience) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function copy() {
    setNote(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is blocked (insecure origin, or permission denied) — show the
      // link so it can still be copied by hand rather than failing silently.
      window.prompt("Copy this link:", url);
    }
  }

  async function share() {
    setNote(null);
    const payload = sharePayload(name, url, audience);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // they changed their mind
        // fall through to the link fallback below
      }
    }
    const opened = window.open(whatsappShareUrl(payload), "_blank", "noopener");
    if (!opened) {
      await copy();
      setNote("Sharing isn't available here — the link is copied instead.");
    }
  }

  return { copied, note, copy, share };
}

/**
 * The full share block — the growth loop lives here, so it is deliberately
 * loud: the link is visible, copying is one tap, and Share opens the device
 * sheet when there is one.
 */
export function ShareSection({
  url,
  name,
  audience = "creator",
  title,
  subtitle,
  className,
  tone = "light",
}: {
  url: string;
  name: string;
  audience?: Audience;
  title?: string;
  subtitle?: string;
  className?: string;
  /** "light" sits on a white card, "soft" on a tinted page background */
  tone?: "light" | "soft";
}) {
  const { copied, note, copy, share } = useShare(name, url, audience);

  return (
    <section
      className={cn(
        "rounded-3xl p-5 text-center",
        tone === "light"
          ? "bg-white ring-1 ring-black/[0.06]"
          : "bg-black/[0.03] ring-1 ring-black/[0.06]",
        className,
      )}
    >
      <h2 className="font-display text-xl text-ink">
        {title ?? (audience === "creator" ? "Share your nimDay" : "Share the celebration")}
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink/60">
        {subtitle ??
          (audience === "creator"
            ? "One link. Send it to everyone who'd want to celebrate you."
            : "Someone else would love to wish them happy birthday too.")}
      </p>

      <button
        type="button"
        onClick={copy}
        aria-label={`Copy the link ${prettyUrl(url)}`}
        className="mt-4 flex min-h-[44px] w-full items-center gap-2 rounded-2xl bg-black/[0.04] px-4 py-3 text-left ring-1 ring-black/[0.06] transition hover:bg-black/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink/75">
          {prettyUrl(url)}
        </span>
        <span className="flex-none text-xs font-semibold text-ink/60">
          {copied ? "Copied ✓" : "Copy"}
        </span>
      </button>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          onClick={share}
          className="w-full sm:flex-1"
        >
          Share link
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={copy}
          className="w-full sm:flex-1"
        >
          {copied ? "Link copied ✓" : "Copy link"}
        </Button>
      </div>
      {/* "Copied ✓" is a colour-and-glyph change on a button; say it too. */}
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied to the clipboard" : ""}
      </p>
      {note ? <p className="mt-2 text-xs text-ink/50">{note}</p> : null}
    </section>
  );
}
