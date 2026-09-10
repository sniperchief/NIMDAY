"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

/**
 * Birthday picker built entirely from DOM elements.
 *
 * Deliberately no <select>. NIMday runs inside the Nimiq Pay webview, and
 * embedded webviews cannot be relied on to open a native select popup — on a
 * device where they don't, the field simply appears dead to the touch. Buttons
 * and a rendered sheet behave identically in a browser and a webview.
 *
 * Value is the same `YYYY-MM-DD` string the rest of the app uses.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EARLIEST_YEAR = 1900;

type Part = "day" | "month" | "year";

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parse(value: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return { y: 0, m: 0, d: 0 };
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function format(y: number, m: number, d: number): string {
  if (!y || !m || !d) return "";
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/** Bottom sheet listing the options for one part of the date. */
function PickerSheet({
  title,
  options,
  selected,
  onPick,
  onClose,
}: {
  title: string;
  options: { value: number; label: string }[];
  selected: number;
  onPick: (value: number) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // Bring the current value into view rather than always starting at the top,
    // which matters most for the year list.
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: "center" });
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[70dvh] w-full max-w-sm animate-pop-in flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 min-h-[40px] rounded-full px-3 text-sm text-ink/55"
          >
            Cancel
          </button>
        </div>

        <div ref={listRef} className="overflow-y-auto overscroll-contain py-1">
          {options.map((o) => {
            const active = o.value === selected;
            return (
              <button
                key={o.value}
                type="button"
                data-selected={active}
                onClick={() => onPick(o.value)}
                className={cn(
                  "flex min-h-[48px] w-full items-center justify-between px-5 text-left text-[15px] transition",
                  active
                    ? "bg-black/[0.04] font-semibold text-ink"
                    : "text-ink/80 active:bg-black/[0.04]",
                )}
              >
                {o.label}
                {active ? <span aria-hidden>✓</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DateField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
}) {
  const { y, m, d } = parse(value);
  const [open, setOpen] = useState<Part | null>(null);

  const thisYear = new Date().getUTCFullYear();

  function update(next: { y?: number; m?: number; d?: number }) {
    const ny = next.y ?? y;
    const nm = next.m ?? m;
    // Clamp so 31 January -> February becomes the 28th or 29th rather than an
    // impossible date.
    const maxDay = daysInMonth(ny, nm);
    const nd = Math.min(next.d ?? d, maxDay || 31);
    onChange(format(ny, nm, nd));
    setOpen(null);
  }

  const trigger = cn(
    "flex min-h-[48px] w-full items-center justify-between gap-1 rounded-xl bg-white px-3.5 text-[15px] ring-1 transition active:bg-black/[0.03]",
    invalid ? "ring-red-400" : "ring-black/10",
  );

  const dayOptions = Array.from({ length: daysInMonth(y, m) }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));
  const monthOptions = MONTHS.map((label, i) => ({ value: i + 1, label }));
  const yearOptions = Array.from(
    { length: thisYear - EARLIEST_YEAR + 1 },
    (_, i) => ({ value: thisYear - i, label: String(thisYear - i) }),
  );

  return (
    <>
      <div className="grid grid-cols-[1fr_1.5fr_1.1fr] gap-2">
        <button
          type="button"
          className={trigger}
          onClick={() => setOpen("day")}
          aria-label="Day"
        >
          <span className={d ? "text-ink" : "text-ink/40"}>{d || "Day"}</span>
          <span aria-hidden className="text-ink/35">
            ▾
          </span>
        </button>

        <button
          type="button"
          className={trigger}
          onClick={() => setOpen("month")}
          aria-label="Month"
        >
          <span className={cn("truncate", m ? "text-ink" : "text-ink/40")}>
            {m ? MONTHS[m - 1] : "Month"}
          </span>
          <span aria-hidden className="text-ink/35">
            ▾
          </span>
        </button>

        <button
          type="button"
          className={trigger}
          onClick={() => setOpen("year")}
          aria-label="Year"
        >
          <span className={y ? "text-ink" : "text-ink/40"}>{y || "Year"}</span>
          <span aria-hidden className="text-ink/35">
            ▾
          </span>
        </button>
      </div>

      {open === "day" && (
        <PickerSheet
          title="Day"
          options={dayOptions}
          selected={d}
          onPick={(v) => update({ d: v })}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "month" && (
        <PickerSheet
          title="Month"
          options={monthOptions}
          selected={m}
          onPick={(v) => update({ m: v })}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "year" && (
        <PickerSheet
          title="Year"
          options={yearOptions}
          selected={y}
          onPick={(v) => update({ y: v })}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
