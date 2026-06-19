import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#fdf8f3",
        paper: "#fffdfb",
        line: "#f0e3d4",
        ink: "#42342a",
        muted: "#8a7763",
        accent: "#d97706",
        "accent-deep": "#b45309",
      },
      boxShadow: {
        card: "0 2px 8px rgba(180,120,60,0.08)",
        sheet: "0 8px 30px rgba(120,80,40,0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
