import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAFAF7",
        ink: "#0F0F0E",
        muted: "#6B6B66",
        line: "rgba(15,15,14,0.08)",
        lineStrong: "rgba(15,15,14,0.16)",
        accent: {
          DEFAULT: "#1A4D3A",
          fg: "#FAFAF7",
          tint: "rgba(26,77,58,0.08)",
        },
        ok: "#2D6A4F",
        warn: "#B07020",
        bad: "#B03020",
        rowHover: "rgba(15,15,14,0.04)",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ['"Inter Tight"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderColor: {
        DEFAULT: "rgba(15,15,14,0.08)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.2, 0.6, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
