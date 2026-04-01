import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1e3a5f",
          dark: "#152a45",
        },
        gold: {
          DEFAULT: "#d4a843",
          muted: "#c49a3a",
        },
        surface: "#f5f5f5",
        ink: "#1a1a1a",
        muted: "#6b7280",
        success: "#16a34a",
        danger: "#dc2626",
        warning: "#f59e0b",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          '"Fira Code"',
          '"Cascadia Code"',
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
