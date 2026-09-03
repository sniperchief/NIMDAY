"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

const WHATSAPP_INTRO =
  "🎂 It's my birthday! I made a NIMday with a few things I'd love this year:";

export function ShareControls({
  url,
  shareText,
  compact = false,
}: {
  url: string;
  shareText?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // last-resort fallback
      const ok = window.prompt("Copy this link:", url);
      void ok;
    }
  }

  async function share() {
    setShareError(null);
    const data = {
      title: "NIMday",
      text: shareText ?? WHATSAPP_INTRO,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setShareError("Couldn't open share sheet");
      }
    } else {
      // Fallback: WhatsApp web intent, which covers the primary sharing target.
      const text = encodeURIComponent(`${data.text}\n${url}`);
      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
    }
  }

  return (
    <div className={compact ? "flex gap-2" : "flex flex-wrap gap-2"}>
      <Button variant="secondary" size={compact ? "md" : "lg"} onClick={copy}>
        {copied ? "Link copied ✓" : "Copy link"}
      </Button>
      <Button variant="primary" size={compact ? "md" : "lg"} onClick={share}>
        Share
      </Button>
      {shareError ? (
        <span className="self-center text-xs text-red-600">{shareError}</span>
      ) : null}
    </div>
  );
}
