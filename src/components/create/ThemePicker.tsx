"use client";

import { THEMES, THEME_IDS } from "@/lib/themes";
import { cn } from "@/components/ui";

export function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEME_IDS.map((id) => {
        const t = THEMES[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "rounded-2xl p-3 text-left ring-1 transition",
              active
                ? "ring-2 ring-ink"
                : "ring-black/10 hover:ring-black/25",
            )}
          >
            <div className="flex gap-1">
              {t.swatches.map((s) => (
                <span
                  key={s}
                  className="h-4 w-4 rounded-full"
                  style={{ background: s }}
                />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-ink">{t.name}</p>
            <p className="text-xs text-ink/50">{t.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}
