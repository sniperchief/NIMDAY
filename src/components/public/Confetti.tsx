"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * A short confetti burst. Purely decorative, no dependency, and it removes
 * itself — and respects `prefers-reduced-motion` by not rendering at all.
 */
export function Confetti({
  colors,
  durationMs = 2600,
  onDone,
}: {
  colors: readonly string[];
  durationMs?: number;
  onDone?: () => void;
}) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setReduced(Boolean(mq?.matches));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => onDone?.(), durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onDone]);

  const bits = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 11) * 90,
        duration: 1700 + ((i * 173) % 900),
        size: 6 + ((i * 7) % 6),
        rotate: (i * 53) % 360,
        color: colors[i % colors.length],
        round: i % 3 === 0,
      })),
    [colors],
  );

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-[-16px] block animate-confetti"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * 1.6,
            backgroundColor: b.color,
            borderRadius: b.round ? "9999px" : "2px",
            animationDelay: `${b.delay}ms`,
            animationDuration: `${b.duration}ms`,
            transform: `rotate(${b.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
