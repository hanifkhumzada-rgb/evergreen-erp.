/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#073B3A",
        navyLight: "#0E4F4D",
        aqua: "#059669",
        aquaSoft: "var(--aquaSoft)",
        foam: "var(--foam)",
        card: "var(--card)",
        ink: "var(--ink)",
        slate: "var(--slate)",
        line: "var(--line)",
        amber: "#D97706",
        amberSoft: "var(--amberSoft)",
        coral: "#DC2626",
        coralSoft: "var(--coralSoft)",
        green: "#16A34A",
        greenSoft: "var(--greenSoft)",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 32, 39, 0.04), 0 4px 16px rgba(15, 32, 39, 0.04)",
      },
    },
  },
  plugins: [],
};
