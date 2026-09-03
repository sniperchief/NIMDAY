/**
 * NIMday themes. Three polished birthday-card looks — warm, elegant, playful.
 * No crypto aesthetics. Each theme is a small palette + a decorative motif that
 * <BirthdayCard> and the public page render identically.
 */

export interface Theme {
  id: string;
  name: string;
  /** short line shown in the picker */
  blurb: string;
  /** page (outside the card) */
  page: string;
  /** the card surface */
  card: string;
  /** primary text on the card */
  text: string;
  /** muted text on the card */
  muted: string;
  /** accent used for the name, countdown pill, buttons */
  accent: string;
  /** accent text colour (on accent background) */
  accentText: string;
  /** heading treatment */
  heading: string;
  /** decorative motif key, rendered by <ThemeMotif> */
  motif: "confetti" | "sun" | "bloom";
  /** swatches for the picker preview */
  swatches: [string, string, string];
}

export const THEMES = {
  confetti: {
    id: "confetti",
    name: "Confetti",
    blurb: "Bright and playful",
    page: "bg-[#fdf6ef]",
    card: "bg-white",
    text: "text-[#2b2622]",
    muted: "text-[#8a7f74]",
    accent: "bg-[#ff5c8a]",
    accentText: "text-white",
    heading: "font-display text-[#ff5c8a]",
    motif: "confetti",
    swatches: ["#ff5c8a", "#ffd166", "#4cc9f0"],
  },
  goldenHour: {
    id: "goldenHour",
    name: "Golden Hour",
    blurb: "Warm and elegant",
    page: "bg-[#f6efe6]",
    card: "bg-[#fffaf3]",
    text: "text-[#3b3026]",
    muted: "text-[#9a8b7a]",
    accent: "bg-[#c98a3c]",
    accentText: "text-white",
    heading: "font-display text-[#b3742b]",
    motif: "sun",
    swatches: ["#c98a3c", "#e8c9a0", "#7a5c3e"],
  },
  bloom: {
    id: "bloom",
    name: "Bloom",
    blurb: "Soft and personal",
    page: "bg-[#f2f4ef]",
    card: "bg-white",
    text: "text-[#2c332a]",
    muted: "text-[#7f887a]",
    accent: "bg-[#5b8c5a]",
    accentText: "text-white",
    heading: "font-display text-[#4a7a49]",
    motif: "bloom",
    swatches: ["#5b8c5a", "#c9dbb8", "#e6a4b4"],
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const DEFAULT_THEME_ID: ThemeId = "confetti";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

export function getTheme(id: string | null | undefined): Theme {
  return isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME_ID];
}
