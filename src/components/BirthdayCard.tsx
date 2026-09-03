import * as React from "react";
import { getTheme } from "@/lib/themes";
import { formatAmount, GIFT_TYPE_LABEL } from "@/lib/amount";
import { cn } from "@/components/ui";
import { ThemeMotif } from "@/components/ThemeMotif";
import { Countdown } from "@/components/Countdown";

export interface BirthdayCardWish {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  targetAmount: string;
  currency: "NIM" | "USDT";
  giftType: "FUND" | "BUY" | "EITHER";
}

export interface BirthdayCardData {
  name: string;
  birthday: string;
  message: string | null;
  theme: string;
  imageUrl: string | null;
  wishes: BirthdayCardWish[];
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "🎂"
  );
}

export function BirthdayCard({
  data,
  action,
  className,
}: {
  data: BirthdayCardData;
  /** slot rendered under the wishes — the gift CTA / share row */
  action?: React.ReactNode;
  className?: string;
}) {
  const theme = getTheme(data.theme);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[28px] ring-1 ring-black/5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]",
        theme.card,
        theme.text,
        className,
      )}
    >
      <div className="relative h-28">
        <ThemeMotif theme={theme} />
      </div>

      <div className="px-6 pb-8 -mt-14 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-white ring-4 ring-white shadow-md">
            {data.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageUrl}
                alt={data.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center text-2xl font-semibold text-white",
                  theme.accent,
                )}
              >
                {initials(data.name)}
              </div>
            )}
          </div>

          <p className={cn("mt-4 text-sm", theme.muted)}>It&apos;s a birthday</p>
          <h1
            className={cn(
              "mt-1 text-3xl font-semibold leading-tight sm:text-4xl",
              theme.heading,
            )}
          >
            {data.name || "Someone special"}
          </h1>

          <Countdown
            name={data.name || "the"}
            birthdayISO={data.birthday}
            className={cn("mt-3", theme.accent, theme.accentText)}
          />

          {data.message ? (
            <p
              className={cn(
                "mt-5 max-w-md whitespace-pre-line text-[15px] leading-relaxed",
                theme.text,
              )}
            >
              {data.message}
            </p>
          ) : null}
        </div>

        {data.wishes.length > 0 && (
          <section className="mt-8">
            <h2 className={cn("mb-3 text-sm font-semibold", theme.muted)}>
              {data.wishes.length === 1 ? "One wish" : `${data.wishes.length} wishes`}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.wishes.map((w) => (
                <li
                  key={w.id}
                  className="flex gap-3 rounded-2xl bg-black/[0.03] p-3 ring-1 ring-black/5"
                >
                  <div className="h-16 w-16 flex-none overflow-hidden rounded-xl bg-black/5">
                    {w.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.imageUrl}
                        alt={w.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl opacity-40">
                        🎁
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{w.title}</p>
                    {w.description ? (
                      <p className={cn("mt-0.5 line-clamp-2 text-xs", theme.muted)}>
                        {w.description}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          theme.accent,
                          theme.accentText,
                        )}
                      >
                        {formatAmount(w.targetAmount, w.currency)}
                      </span>
                      <span className={cn("text-xs", theme.muted)}>
                        {GIFT_TYPE_LABEL[w.giftType]}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </article>
  );
}
