import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: "#163A2E",
        "forest-hover": "#1A4536",
        emerald: "#1B9A62",
        mint: "#35D28A",
        "mint-tint": "#E4F9EE",
        cream: "#F6F1E7",
        "cream-hover": "#EFE9DB",
        "app-bg": "#EEE7D8",
        ink: "#16201B",
        muted: "#5B6961",
        "muted-2": "#8A9490",
        coral: "#C24B36",
        "coral-tint": "#FBEAE6",
        "coral-tint-border": "#EFC2B7",
        link: "#1F5C46",
        gold: "#B08A3E",
        "gold-tint": "#F6EFDF",
        sky: "#4A6FA5",
        "sky-tint": "#EAF0F7",
        "sky-text": "#3B5876",
        disabled: "#E4E2DC",
        "disabled-text": "#A9A49C",
        "dark-bg": "#0E1712",
        "dark-card": "#16241D",
        "dark-forest": "#2E8562",
        "dark-text": "#F2F6F3",
        "dark-muted": "#91A399",
      },
      fontFamily: {
        display: ["var(--font-instrument-serif)"],
        sans: ["var(--font-work-sans)"],
      },
      borderRadius: {
        xl: "28px",
        lg: "24px",
        md: "16px",
        full: "999px",
      },
      boxShadow: {
        DEFAULT: "0 16px 32px -18px rgba(19,46,40,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
