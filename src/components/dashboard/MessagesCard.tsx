"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, cn } from "@/components/ui";
import { timeAgo } from "@/lib/activityText";
import { ApiError, deleteMessage, type PublicMessage } from "@/lib/apiClient";

/**
 * The messages on the creator's own nimDay, with the one creator action there
 * is: remove a message from your card.
 *
 * This is deliberately not moderation — there is no hiding, reporting, editing
 * or blocking, and nothing about a sender is shown here that a visitor can't
 * already see. Removal is confirmed in place, and the server re-checks that
 * the message belongs to a nimDay this session actually owns.
 */
export function MessagesCard({
  messages: initial,
}: {
  messages: PublicMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setConfirmId(null);
      setRemoved(true);
      // Totals and the activity feed are server-rendered — pull them again so
      // the message count on this page matches what was just removed.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't remove that message. Check your connection and try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Messages</h2>
        <p className="text-xs text-ink/45">
          {messages.length === 0
            ? "none yet"
            : `${messages.length} on your card`}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {removed ? "Message removed" : ""}
      </p>

      {messages.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-black/10 p-5 text-center">
          <p className="text-2xl">💌</p>
          <p className="mt-2 text-sm text-ink/55">
            When people write to you, their notes land here.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {messages.map((m) => {
            const confirming = confirmId === m.id;
            return (
              <li
                key={m.id}
                className={cn(
                  "rounded-2xl bg-black/[0.03] p-3.5 ring-1 ring-black/[0.05]",
                  confirming && "ring-red-200 bg-red-50/60",
                )}
              >
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">
                  {m.body}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold text-ink">
                    {m.author}
                  </span>
                  <span className="text-xs text-ink/45">
                    · {timeAgo(m.createdAt)}
                  </span>
                  {m.gift ? (
                    <span className="rounded-full bg-persimmon-soft px-2 py-0.5 text-[11px] font-medium text-ink">
                      🎁 gifted {m.gift.amountNim} NIM · {m.gift.wishTitle}
                    </span>
                  ) : null}
                </div>

                {confirming ? (
                  <div className="mt-3 border-t border-black/[0.06] pt-3">
                    <p className="text-sm text-ink/70">
                      Remove this message from your nimDay? It disappears from
                      your public page for good.
                      {m.gift
                        ? " The gift itself is untouched — only the note goes."
                        : ""}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmId(null)}
                        disabled={busyId === m.id}
                      >
                        Keep it
                      </Button>
                      <Button
                        loading={busyId === m.id}
                        onClick={() => remove(m.id)}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        Remove message
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setError(null);
                        setRemoved(false);
                        setConfirmId(m.id);
                      }}
                      aria-label={`Remove the message from ${m.author}`}
                      className="text-xs text-ink/50 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
