/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B3142",
        navyLight: "#123B4E",
        aqua: "#0E9E97",
        aquaSoft: "var(--aquaSoft)",
        foam: "var(--foam)",
        card: "var(--card)",
        ink: "var(--ink)",
        slate: "var(--slate)",
        line: "var(--line)",
        amber: "#DE9B33",
        amberSoft: "var(--amberSoft)",
        coral: "#D95A44",
        coralSoft: "var(--coralSoft)",
        green: "#2E9E6B",
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
