import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: "#163A2E",
        emerald: "#1B9A62",
        mint: "#35D28A",
        cream: "#F6F1E7",
        "app-bg": "#EEE7D8",
        ink: "#16201B",
        muted: "#5B6961",
        "muted-2": "#8A9490",
        coral: "#C24B36",
        "dark-bg": "#0E1712",
        "dark-card": "#16241D",
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
