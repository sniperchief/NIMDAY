"use client";

import { useState } from "react";
import { cn } from "@/components/ui";
import { getTheme } from "@/lib/themes";
import {
  QUEST_STEPS,
  questLabel,
  questProgress,
  type QuestState,
  type QuestStepId,
} from "@/lib/quest";

/**
 * Birthday Quest — a four-step celebration checklist.
 *
 * It is deliberately not a game: nothing is randomised, nothing is earned,
 * nothing depends on how much anyone spends, and no step requires a wallet.
 * It sits *under* the wishes so it never competes with the real actions
 * (view wishes → gift → leave a message), and it collapses to a single line.
 */
export function BirthdayQuest({
  state,
  theme: themeId,
  onStepAction,
}: {
  state: QuestState;
  theme: string;
  /** the page decides what a step does — scroll to a section, fire confetti… */
  onStepAction: (step: QuestStepId) => void;
}) {
  const theme = getTheme(themeId);
  const progress = questProgress(state);
  const [open, setOpen] = useState(false);

  return (
    <section
      className={cn("rounded-3xl p-4 ring-1 ring-black/[0.06]", theme.card)}
      aria-label="Birthday Quest"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-3 text-left"
      >
        <span className="text-xl" aria-hidden>
          {progress.done ? "🏆" : "🎯"}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-semibold", theme.text)}>
            Birthday Quest
          </span>
          <span className={cn("block text-xs", theme.muted)}>
            {progress.done
              ? "You did the whole birthday journey 🎉"
              : (progress.next?.title ?? questLabel(progress))}
          </span>
        </span>
        <span className="flex flex-none items-center gap-2">
          <span className={cn("text-xs font-medium tabular-nums", theme.muted)}>
            {questLabel(progress)}
          </span>
          <span className={cn("text-xs", theme.muted)} aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </span>
      </button>

      <div className="mt-3 flex gap-1.5" aria-hidden>
        {QUEST_STEPS.map((s) => (
          <span
            key={s.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition",
              state[s.id] ? theme.accent : "bg-black/[0.08]",
            )}
          />
        ))}
      </div>
      <p className="sr-only">
        Birthday Quest progress: {progress.completed} of {progress.total} steps
        completed.
      </p>

      {open ? (
        <ul className="mt-4 grid gap-2">
          {QUEST_STEPS.map((step) => {
            const done = state[step.id];
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onStepAction(step.id)}
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition",
                    done ? "bg-black/[0.03]" : "bg-black/[0.05] hover:bg-black/[0.08]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm",
                      done
                        ? cn(theme.accent, theme.accentText)
                        : "bg-white ring-1 ring-black/10",
                    )}
                    aria-hidden
                  >
                    {done ? "✓" : step.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        done ? cn(theme.muted, "line-through") : theme.text,
                      )}
                    >
                      {step.title}
                    </span>
                    {!done ? (
                      <span className={cn("block text-xs", theme.muted)}>
                        {step.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
