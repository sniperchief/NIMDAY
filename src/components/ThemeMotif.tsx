import type { Theme } from "@/lib/themes";

/** Lightweight decorative motif behind the card header. Purely visual. */
export function ThemeMotif({ theme }: { theme: Theme }) {
  if (theme.motif === "sun") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 400 120"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 w-full opacity-70"
      >
        <defs>
          <radialGradient id="sun" cx="50%" cy="0%" r="75%">
            <stop offset="0%" stopColor={theme.swatches[1]} stopOpacity="0.9" />
            <stop offset="100%" stopColor={theme.swatches[1]} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="120" fill="url(#sun)" />
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={i}
            x1="200"
            y1="8"
            x2={40 + i * 40}
            y2="110"
            stroke={theme.swatches[0]}
            strokeOpacity="0.25"
            strokeWidth="2"
          />
        ))}
      </svg>
    );
  }

  if (theme.motif === "bloom") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 400 120"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 w-full opacity-80"
      >
        {[60, 150, 250, 340].map((x, i) => (
          <g key={x} transform={`translate(${x} ${18 + (i % 2) * 10})`}>
            {Array.from({ length: 6 }).map((_, p) => (
              <ellipse
                key={p}
                cx="0"
                cy="-9"
                rx="4.5"
                ry="9"
                fill={i % 2 ? theme.swatches[2] : theme.swatches[1]}
                transform={`rotate(${p * 60})`}
              />
            ))}
            <circle r="3.5" fill={theme.swatches[0]} />
          </g>
        ))}
      </svg>
    );
  }

  // confetti
  const bits = [
    [24, 30, 0],
    [80, 14, 20],
    [140, 40, -15],
    [210, 18, 35],
    [270, 44, 10],
    [330, 22, -25],
    [372, 38, 15],
  ];
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 120"
      className="pointer-events-none absolute inset-x-0 top-0 h-28 w-full opacity-90"
    >
      {bits.map(([x, y, r], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width="8"
          height="8"
          rx="1.5"
          fill={theme.swatches[i % 3]}
          transform={`rotate(${r} ${x + 4} ${y + 4})`}
        />
      ))}
    </svg>
  );
}
