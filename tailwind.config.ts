import type { Config } from "tailwindcss";

/**
 * Das Kitchen design tokens.
 * Palette derived from the brand logo: warm brown + gold on cream.
 * Extra shades are hand-tuned for hover / border / muted states.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#B08D00", // primary gold
          light: "#C9A227",
          dark: "#8F7100",
          soft: "#EFE3B8",
        },
        brown: {
          DEFAULT: "#5C4033", // primary brown
          light: "#7A5A48",
          dark: "#4A3327",
        },
        coffee: "#3B2A20", // dark coffee — headings / footer
        cream: "#FFF8EE", // warm background
        soft: "#FAFAFA", // soft white — cards
      },
      fontFamily: {
        // Display: warm old-style serif. Body: clean humanist sans.
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        warm: "0 10px 40px -12px rgba(92, 64, 51, 0.25)",
        card: "0 2px 16px -6px rgba(59, 42, 32, 0.12)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        "fade-in": "fade-in 0.8s ease-out both",
        "scale-in": "scale-in 0.6s ease-out both",
        "slide-in-right": "slide-in-right 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
