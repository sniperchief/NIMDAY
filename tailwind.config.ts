import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        cream: "#fbf7f0",
        ink: "#241f1a",
        /**
         * nimDay brand colour. Contrast, measured (WCAG):
         *  DEFAULT  large text and shapes only — 3.17:1 on cream, 3.39:1 on
         *           white. Small text ON it must be ink (4.82:1), never white.
         *  deep     small persimmon text — 4.79:1 on cream, 5.12:1 on white.
         *  soft     a pale wash for backgrounds.
         */
        persimmon: {
          DEFAULT: "#EF5B2B",
          deep: "#C63E15",
          soft: "#FDEDE4",
        },
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(-1deg)" },
          "50%": { transform: "translateY(-14px) rotate(1deg)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(6deg)" },
          "50%": { transform: "translateY(-8px) rotate(5deg)" },
        },
        confetti: {
          "0%": { opacity: "0", transform: "translateY(-10vh) rotate(0deg)" },
          "10%": { opacity: "1" },
          "100%": {
            opacity: "0",
            transform: "translateY(105vh) rotate(540deg)",
          },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "pop-in": "pop-in 0.35s ease-out both",
        confetti: "confetti 2s ease-in forwards",
        float: "float 5s ease-in-out infinite",
        "float-slow": "float-slow 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
