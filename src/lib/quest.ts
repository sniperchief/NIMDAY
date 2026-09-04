/**
 * Birthday Quest — a tiny celebration checklist, not a game and not a reward
 * scheme. There is deliberately no database table: every step is derived from
 * things the visitor has already done, remembered per-device. Nothing here
 * grants anything, costs anything, or depends on how much someone gifted.
 */

export type QuestStepId = "visit" | "message" | "wish" | "celebrate";

export interface QuestStep {
  id: QuestStepId;
  emoji: string;
  title: string;
  /** shown when the step is still open */
  hint: string;
}

export const QUEST_STEPS: QuestStep[] = [
  {
    id: "visit",
    emoji: "🎂",
    title: "Visit the birthday card",
    hint: "You're here — that's one.",
  },
  {
    id: "message",
    emoji: "💌",
    title: "Leave a birthday message",
    hint: "A line or two is plenty.",
  },
  {
    id: "wish",
    emoji: "🎁",
    title: "Choose a wish",
    hint: "Have a look at what they'd love.",
  },
  {
    id: "celebrate",
    emoji: "🎉",
    title: "Celebrate your friend",
    hint: "Tap to send some confetti.",
  },
];

export const QUEST_STEP_IDS: QuestStepId[] = QUEST_STEPS.map((s) => s.id);

export type QuestState = Record<QuestStepId, boolean>;

export const EMPTY_QUEST: QuestState = {
  visit: false,
  message: false,
  wish: false,
  celebrate: false,
};

export function isQuestStepId(value: unknown): value is QuestStepId {
  return typeof value === "string" && (QUEST_STEP_IDS as string[]).includes(value);
}

export function completeStep(state: QuestState, step: QuestStepId): QuestState {
  if (state[step]) return state; // already done — never toggles back off
  return { ...state, [step]: true };
}

export interface QuestProgress {
  completed: number;
  total: number;
  /** 0–100, rounded */
  percent: number;
  done: boolean;
  /** the first step still open, or null when the quest is finished */
  next: QuestStep | null;
}

export function questProgress(state: QuestState): QuestProgress {
  const completed = QUEST_STEP_IDS.filter((id) => state[id]).length;
  const total = QUEST_STEP_IDS.length;
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    done: completed === total,
    next: QUEST_STEPS.find((s) => !state[s.id]) ?? null,
  };
}

export function questLabel(p: QuestProgress): string {
  return p.done ? "Birthday Quest complete" : `${p.completed} / ${p.total} completed`;
}

/** Per-NIMday, per-device storage key. Progress never leaves the browser. */
export function questStorageKey(slug: string): string {
  return `nimday.quest.${slug}`;
}

/** Tolerant parse of whatever is in localStorage — unknown keys are dropped. */
export function parseQuestState(raw: string | null): QuestState {
  if (!raw) return { ...EMPTY_QUEST };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_QUEST };
    const state = { ...EMPTY_QUEST };
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isQuestStepId(k) && v === true) state[k] = true;
    }
    return state;
  } catch {
    return { ...EMPTY_QUEST };
  }
}

export function serializeQuestState(state: QuestState): string {
  return JSON.stringify(state);
}
