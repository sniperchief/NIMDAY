"use client";

import { useState } from "react";
import { Button, Field, Input, Textarea, cn } from "@/components/ui";
import { ImageUpload } from "./ImageUpload";
import { GIFT_TYPE_LABEL } from "@/lib/amount";
import { MAX_WISHES } from "@/lib/validation";
import { newWish, type Draft, type DraftWish } from "./types";

const GIFT_TYPES: DraftWish["giftType"][] = ["FUND", "BUY", "EITHER"];

/**
 * A wish that has already received a gift can't be deleted — the server
 * refuses it, because `Gift` rows cascade from `Wish` and the gift ledger is
 * the authoritative record of money that really moved. Reflected here so the
 * creator sees why, rather than hitting the refusal at publish time.
 */
function gifted(w: DraftWish): boolean {
  return (w.giftCount ?? 0) > 0;
}

function WishForm({
  wish,
  onSave,
  onCancel,
}: {
  wish: DraftWish;
  onSave: (w: DraftWish) => void;
  onCancel: () => void;
}) {
  const [w, setW] = useState<DraftWish>(wish);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const e: Record<string, string> = {};
    if (!w.title.trim()) e.title = "Give the wish a name";
    const amount = Number(w.targetAmount);
    if (!w.targetAmount.trim() || !Number.isFinite(amount) || amount <= 0)
      e.targetAmount = "Enter an amount above 0";
    if (amount > 1_000_000_000) e.targetAmount = "That target is too large";
    if (w.description.length > 500) e.description = "Keep it under 500 characters";
    setErrors(e);
    if (Object.keys(e).length === 0) onSave({ ...w, title: w.title.trim() });
  }

  return (
    <div className="space-y-4 rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/5">
      <Field label="Wish" error={errors.title}>
        <Input
          value={w.title}
          maxLength={80}
          placeholder="e.g. New headphones"
          onChange={(e) => setW({ ...w, title: e.target.value })}
        />
      </Field>

      <Field label="Description" optional error={errors.description}>
        <Textarea
          value={w.description}
          maxLength={500}
          placeholder="Any details that help — colour, size, a link to talk about…"
          onChange={(e) => setW({ ...w, description: e.target.value })}
        />
      </Field>

      <ImageUpload
        label="Wish image"
        shape="square"
        value={w.imageUrl}
        onChange={(url) => setW({ ...w, imageUrl: url })}
      />

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label="Target amount" error={errors.targetAmount}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={w.targetAmount}
              placeholder="120"
              onChange={(e) => setW({ ...w, targetAmount: e.target.value })}
            />
            <span className="text-sm font-medium text-ink/60">NIM</span>
          </div>
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink/80">
          How would you like to receive it?
        </span>
        <div className="flex flex-wrap gap-2">
          {GIFT_TYPES.map((gt) => (
            <button
              key={gt}
              type="button"
              onClick={() => setW({ ...w, giftType: gt })}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm ring-1 transition",
                w.giftType === gt
                  ? "bg-ink text-cream ring-ink"
                  : "bg-white text-ink/70 ring-black/10",
              )}
            >
              {GIFT_TYPE_LABEL[gt]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button type="button" onClick={save} className="w-full sm:w-auto">
          Save wish
        </Button>
      </div>
    </div>
  );
}

export function WishesStep({
  draft,
  setDraft,
  onNext,
  onBack,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const atLimit = draft.wishes.length >= MAX_WISHES;

  function upsert(w: DraftWish) {
    setDraft((d) => {
      const exists = d.wishes.some((x) => x.key === w.key);
      return {
        ...d,
        wishes: exists
          ? d.wishes.map((x) => (x.key === w.key ? w : x))
          : [...d.wishes, w],
      };
    });
    setEditingKey(null);
    setAdding(false);
  }

  function remove(key: string) {
    setDraft((d) => ({ ...d, wishes: d.wishes.filter((x) => x.key !== key) }));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">
        Add up to {MAX_WISHES} things you&apos;d love. You can skip this and add
        them later.
      </p>

      <ul className="space-y-3">
        {draft.wishes.map((w) =>
          editingKey === w.key ? (
            <li key={w.key}>
              <WishForm
                wish={w}
                onSave={upsert}
                onCancel={() => setEditingKey(null)}
              />
            </li>
          ) : (
            <li
              key={w.key}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/10"
            >
              <div className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-black/5">
                {w.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center opacity-30">
                    🎁
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm font-medium text-ink">
                  {w.title || "Untitled wish"}
                </p>
                <p className="text-xs text-ink/50">
                  {w.targetAmount || "0"} NIM · {GIFT_TYPE_LABEL[w.giftType]}
                </p>
                {gifted(w) ? (
                  <p className="mt-0.5 text-xs font-medium text-emerald-700">
                    🎁 {w.raisedNim ?? "0"} NIM received — can&apos;t be removed
                  </p>
                ) : null}
              </div>
              <div className="ml-auto flex flex-none gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingKey(w.key)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={gifted(w)}
                  title={
                    gifted(w)
                      ? "This wish has already received a gift"
                      : undefined
                  }
                  onClick={() => remove(w.key)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <WishForm
          wish={newWish()}
          onSave={upsert}
          onCancel={() => setAdding(false)}
        />
      ) : atLimit ? (
        <p className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-ink/50">
          That&apos;s the maximum of {MAX_WISHES} wishes.
        </p>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
          className="w-full sm:w-auto"
        >
          + Add a wish
        </Button>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
        <Button size="lg" onClick={onNext} className="w-full sm:w-auto">
          Next: preview
        </Button>
      </div>
    </div>
  );
}
