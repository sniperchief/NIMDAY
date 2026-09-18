"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, Textarea, cn } from "@/components/ui";
import { getTheme } from "@/lib/themes";
import { timeAgo } from "@/lib/activityText";
import {
  MESSAGE_MAX_LENGTH,
  SENDER_NAME_MAX_LENGTH,
  checkBody,
  normalizeBody,
  MESSAGE_PROBLEM_COPY,
  remainingCharacters,
} from "@/lib/messages/text";
import { ApiError, getMessages, postMessage, type PublicMessage } from "@/lib/apiClient";

type Status = "idle" | "sending" | "sent" | "error";

function noteTint(theme: ReturnType<typeof getTheme>, index: number): string {
  // Low-alpha wash of a theme swatch, so notes feel like paper on the card.
  return `${theme.swatches[index % theme.swatches.length]}14`;
}

/** One message as it appears on a nimDay. Also rendered by the homepage showcase. */
export function MessageNote({
  message,
  theme,
  index,
  fresh,
}: {
  message: PublicMessage;
  theme: ReturnType<typeof getTheme>;
  index: number;
  fresh?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-2xl p-4 ring-1 ring-black/[0.05]",
        fresh && "animate-pop-in",
      )}
      style={{ backgroundColor: noteTint(theme, index) }}
    >
      <p className={cn("whitespace-pre-line text-[15px] leading-relaxed", theme.text)}>
        {message.body}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn("text-[13px] font-semibold", theme.text)}>
          {message.author}
        </span>
        {/* relative time can differ between server render and hydration */}
        <span className={cn("text-xs", theme.muted)} suppressHydrationWarning>
          · {timeAgo(message.createdAt)}
        </span>
        {message.gift ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              theme.accent,
              theme.accentText,
            )}
          >
            🎁 gifted {message.gift.amountNim} NIM · {message.gift.wishTitle}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * "Leave a birthday message" — the second thing a visitor can do, and the one
 * that needs no wallet at all. Anonymous hides the name in nimDay; it is not
 * on-chain anonymity, and the toggle says so.
 */
export function MessageBoard({
  slug,
  birthdayName,
  theme: themeId,
  initialMessages,
  initialTotal,
  pendingIntentId,
  senderAddress,
  onPosted,
  composerRef,
}: {
  slug: string;
  birthdayName: string;
  theme: string;
  initialMessages: PublicMessage[];
  initialTotal: number;
  /** a payment intent the visitor just paid, so the message can carry the gift */
  pendingIntentId?: string | null;
  senderAddress?: string | null;
  onPosted?: () => void;
  composerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const theme = getTheme(themeId);
  const [messages, setMessages] = useState<PublicMessage[]>(initialMessages);
  const [total, setTotal] = useState(initialTotal);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = birthdayName.trim().split(/\s+/)[0] || birthdayName;
  const remaining = remainingCharacters(body);
  const overLimit = remaining < 0;

  // Remember the visitor's name between messages on this device only.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("nimday.name");
      if (saved) setName(saved);
    } catch {
      /* storage blocked — the field just starts empty */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const clean = normalizeBody(body);
    const problem = checkBody(clean);
    if (problem) {
      setError(MESSAGE_PROBLEM_COPY[problem]);
      setStatus("error");
      return;
    }

    setStatus("sending");
    try {
      const created = await postMessage({
        slug,
        body: clean,
        senderName: anonymous ? undefined : name.trim() || undefined,
        anonymous,
        senderAddress: senderAddress ?? undefined,
        intentId: pendingIntentId ?? undefined,
      });
      setMessages((prev) => [created, ...prev]);
      setTotal((n) => n + 1);
      setFreshId(created.id);
      setBody("");
      setStatus("sent");
      onPosted?.();
      if (!anonymous && name.trim()) {
        try {
          window.localStorage.setItem("nimday.name", name.trim());
        } catch {
          /* not important enough to surface */
        }
      }
      setTimeout(() => setStatus((s) => (s === "sent" ? "idle" : s)), 4000);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't post that message. Check your connection and try again.",
      );
      // Best-effort resync in case the message actually landed.
      getMessages(slug)
        .then((d) => {
          setMessages(d.messages);
          setTotal(d.total);
        })
        .catch(() => {
          /* leave the list as it is */
        });
    }
  }

  return (
    <section className="space-y-4">
      <div ref={composerRef} className="scroll-mt-4">
        <form
          onSubmit={submit}
          className={cn("rounded-3xl p-5 ring-1 ring-black/[0.06]", theme.card)}
        >
          <h2 className={cn("font-display text-xl", theme.heading)}>
            Leave a birthday message
          </h2>
          <p className={cn("mt-1 text-sm", theme.muted)}>
            {firstName} will see it on this page. No wallet needed.
          </p>

          <div className="mt-4">
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MESSAGE_MAX_LENGTH * 2}
              rows={3}
              placeholder={`Happy birthday ${firstName}! Hope you have an amazing day 🎉`}
              aria-label="Your birthday message"
              className="min-h-[96px] bg-white"
            />
            <div className="mt-1 flex items-center justify-between">
              <span
                className={cn("text-xs", overLimit ? "text-red-600" : "text-ink/40")}
              >
                {remaining < 60 ? `${remaining} characters left` : " "}
              </span>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <Input
              value={anonymous ? "" : name}
              onChange={(e) => setName(e.target.value)}
              disabled={anonymous}
              maxLength={SENDER_NAME_MAX_LENGTH}
              placeholder={anonymous ? "Hidden" : "Your name (optional)"}
              aria-label="Your name"
              className="bg-white disabled:bg-black/[0.04] disabled:text-ink/40"
            />
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ink/75">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Send anonymously
            </label>
          </div>
          {anonymous ? (
            <p className="mt-1 text-xs text-ink/45">
              Your name stays hidden inside nimDay. If you also send a gift, that
              payment is still public on the Nimiq blockchain.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}
          {status === "sent" ? (
            <p
              role="status"
              className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              Message sent 💌 {firstName} will love that.
            </p>
          ) : null}

          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              size="lg"
              loading={status === "sending"}
              disabled={overLimit || normalizeBody(body).length === 0}
              className="w-full sm:w-auto"
            >
              Send message
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h3 className={cn("mb-3 px-1 text-sm font-semibold", theme.muted)}>
          {total === 0 ? "Messages" : `${total} ${total === 1 ? "message" : "messages"}`}
        </h3>

        {messages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/10 p-6 text-center">
            <p className="text-2xl">💌</p>
            <p className={cn("mt-2 text-sm", theme.muted)}>
              No messages yet — be the first to wish {firstName} a happy birthday.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {messages.map((m, i) => (
              <MessageNote
                key={m.id}
                message={m}
                theme={theme}
                index={i}
                fresh={m.id === freshId}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
