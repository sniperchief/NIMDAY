/**
 * nimDay themes. Three polished birthday-card looks — bold, elegant, soft.
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
  /**
   * The default theme, in the nimDay brand colours (it used to be pink).
   *
   * Contrast (WCAG): bright persimmon #EF5B2B is used only for large text — the
   * name. Fills that carry small white text, like the countdown pill and the
   * "Send a gift" buttons, use the deep shade #C63E15, where white reads at
   * 5.12:1; on bright persimmon white would be 3.39:1, below the 4.5:1 that
   * small text needs.
   */
  confetti: {
    id: "confetti",
    name: "Confetti",
    blurb: "Bold and bright",
    page: "bg-white",
    card: "bg-white",
    text: "text-[#2b2622]",
    muted: "text-[#8a7f74]",
    accent: "bg-persimmon-deep",
    accentText: "text-white",
    heading: "font-display text-persimmon",
    motif: "confetti",
    swatches: ["#EF5B2B", "#F6B26B", "#D9C7B0"],
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

/**
 * Resolve a theme. Accepts a saved theme id — anything unknown falls back to
 * the default — or a theme object, which is used as-is.
 */
export function getTheme(theme: string | Theme | null | undefined): Theme {
  if (theme && typeof theme === "object") return theme;
  return isThemeId(theme) ? THEMES[theme] : THEMES[DEFAULT_THEME_ID];
}
