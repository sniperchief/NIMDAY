import * as React from "react";

/**
 * The nimDay wordmark: "nımDay" with a gift standing in for the dot of the i.
 *
 * Drawn as geometry rather than set in a font, so the gift always sits exactly
 * over the stem no matter which fonts a phone or webview has installed. Letters
 * are one stroke weight on a shared grid (x-height 12, cap height 17) and take
 * `currentColor`, so the wordmark follows the surrounding text colour; the gift
 * is always persimmon.
 *
 * Size it with a height class and `w-auto`, e.g. `className="h-7 w-auto"`.
 */

const GIFT = (
  <g className="fill-persimmon">
    {/* bow */}
    <path d="M15.5 5.3 12.9 2.9v2.4Z" />
    <path d="M15.5 5.3 18.1 2.9v2.4Z" />
    {/* lid and box, split by the ribbon */}
    <rect x="11.9" y="5.3" width="3.1" height="1.9" rx="0.45" />
    <rect x="16" y="5.3" width="3.1" height="1.9" rx="0.45" />
    <rect x="12.5" y="7.7" width="2.5" height="3.1" rx="0.4" />
    <rect x="16" y="7.7" width="2.5" height="3.1" rx="0.4" />
  </g>
);

export function Wordmark({
  className,
  title = "nimDay",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 2.4 85 27.6"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* n */}
        <path d="M1.5 22.5v-9M1.5 17.5a4 4 0 0 1 8 0v5" />
        {/* ı — the dot is the gift */}
        <path d="M15.5 13.5v9" />
        {/* m */}
        <path d="M21.5 22.5v-9M21.5 17.5a4 4 0 0 1 8 0v5M29.5 17.5a4 4 0 0 1 8 0v5" />
        {/* D */}
        <path d="M44 8.5v14h3a7 7 0 0 0 0-14Z" />
        {/* a */}
        <circle cx="64" cy="18" r="4.5" />
        <path d="M68.5 13.5v9" />
        {/* y */}
        <path d="M74 13.5 79.1 22.5M83 13.5 76.5 28.5" />
      </g>
      {GIFT}
    </svg>
  );
}

/** The gift on its own — the brand's small mark, for badges and bullets. */
export function GiftMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="11.4 2.4 8.2 8.9"
      aria-hidden
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {GIFT}
    </svg>
  );
}
