"use client";

import { useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { ThemePicker } from "./ThemePicker";
import { ImageUpload } from "./ImageUpload";
import type { Draft } from "./types";

export function DetailsStep({
  draft,
  patch,
  onNext,
}: {
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateAndNext() {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = "Add a name";
    else if (draft.name.trim().length > 80) e.name = "That name is a bit long";

    if (!draft.birthday) e.birthday = "Pick the birthday date";
    else {
      const d = new Date(`${draft.birthday}T00:00:00Z`);
      const year = d.getUTCFullYear();
      if (Number.isNaN(d.getTime()) || year < 1900 || year > new Date().getUTCFullYear() + 1)
        e.birthday = "Pick a valid date";
    }
    if (draft.message.length > 280) e.message = "Keep it under 280 characters";

    setErrors(e);
    if (Object.keys(e).length === 0) onNext();
  }

  return (
    <div className="space-y-5">
      <Field label="Whose birthday is it?" error={errors.name}>
        <Input
          value={draft.name}
          maxLength={80}
          placeholder="e.g. Sarah"
          onChange={(ev) => patch({ name: ev.target.value })}
        />
      </Field>

      <Field label="Birthday" error={errors.birthday} hint="Used for the countdown.">
        <Input
          type="date"
          value={draft.birthday}
          onChange={(ev) => patch({ birthday: ev.target.value })}
        />
      </Field>

      <Field
        label="A short birthday message"
        optional
        error={errors.message}
        hint={`${draft.message.length}/280`}
      >
        <Textarea
          value={draft.message}
          maxLength={280}
          placeholder="Something warm for the people opening your card…"
          onChange={(ev) => patch({ message: ev.target.value })}
        />
      </Field>

      <ImageUpload
        value={draft.imageUrl}
        onChange={(url) => patch({ imageUrl: url })}
      />

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink/80">Theme</span>
        <ThemePicker value={draft.theme} onChange={(theme) => patch({ theme })} />
      </div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={validateAndNext}>
          Next: add wishes
        </Button>
      </div>
    </div>
  );
}
