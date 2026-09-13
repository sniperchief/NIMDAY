import { describe, it, expect } from "vitest";
import {
  EMPTY_QUEST,
  QUEST_STEPS,
  completeStep,
  isQuestStepId,
  parseQuestState,
  questLabel,
  questProgress,
  questStorageKey,
  serializeQuestState,
} from "@/lib/quest";

describe("quest shape", () => {
  it("has exactly four steps, none of them about spending", () => {
    expect(QUEST_STEPS).toHaveLength(4);
    expect(QUEST_STEPS.map((s) => s.id)).toEqual([
      "visit",
      "message",
      "wish",
      "celebrate",
    ]);
    const text = JSON.stringify(QUEST_STEPS).toLowerCase();
    expect(text).not.toMatch(/reward|prize|earn|win|bonus|more nim/);
  });
});

describe("completeStep", () => {
  it("marks a step done", () => {
    const next = completeStep(EMPTY_QUEST, "message");
    expect(next.message).toBe(true);
    expect(next.visit).toBe(false);
  });

  it("never un-completes a step and is a no-op when already done", () => {
    const once = completeStep(EMPTY_QUEST, "visit");
    const twice = completeStep(once, "visit");
    expect(twice).toBe(once); // identity preserved, so no pointless re-render
    expect(twice.visit).toBe(true);
  });

  it("does not mutate the state it was given", () => {
    const base = { ...EMPTY_QUEST };
    completeStep(base, "wish");
    expect(base.wish).toBe(false);
  });
});

describe("questProgress", () => {
  it("reports 0 / 4 for a fresh visitor", () => {
    const p = questProgress(EMPTY_QUEST);
    expect(p).toMatchObject({ completed: 0, total: 4, percent: 0, done: false });
    expect(p.next?.id).toBe("visit");
  });

  it("reports halfway", () => {
    let s = completeStep(EMPTY_QUEST, "visit");
    s = completeStep(s, "message");
    const p = questProgress(s);
    expect(p.completed).toBe(2);
    expect(p.percent).toBe(50);
    expect(p.done).toBe(false);
    expect(p.next?.id).toBe("wish");
    expect(questLabel(p)).toBe("2 / 4 completed");
  });

  it("reports completion", () => {
    const s = QUEST_STEPS.reduce((acc, step) => completeStep(acc, step.id), EMPTY_QUEST);
    const p = questProgress(s);
    expect(p).toMatchObject({ completed: 4, percent: 100, done: true, next: null });
    expect(questLabel(p)).toBe("Birthday Quest complete");
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const s = completeStep(completeStep(EMPTY_QUEST, "visit"), "celebrate");
    expect(parseQuestState(serializeQuestState(s))).toEqual(s);
  });

  it("survives missing, malformed and hostile input", () => {
    expect(parseQuestState(null)).toEqual(EMPTY_QUEST);
    expect(parseQuestState("not json")).toEqual(EMPTY_QUEST);
    expect(parseQuestState("[1,2,3]")).toEqual(EMPTY_QUEST);
    expect(parseQuestState('{"visit":"yes"}')).toEqual(EMPTY_QUEST);
    expect(parseQuestState('{"visit":true,"__proto__":true,"nope":true}')).toEqual({
      ...EMPTY_QUEST,
      visit: true,
    });
  });

  it("scopes storage per nimDay", () => {
    expect(questStorageKey("sarah-2026")).toBe("nimday.quest.sarah-2026");
    expect(questStorageKey("a")).not.toBe(questStorageKey("b"));
  });

  it("recognises only real step ids", () => {
    expect(isQuestStepId("wish")).toBe(true);
    expect(isQuestStepId("gift-more")).toBe(false);
    expect(isQuestStepId(4)).toBe(false);
  });
});
