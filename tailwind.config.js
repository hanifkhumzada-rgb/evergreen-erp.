/** @type {import('tailwindcss').Config} */
// Every brand color resolves to an RGB-channel token defined per theme in
// app/globals.css (Evergreen Light, EW Ocean Blue, Evergreen Dark), so a
// class like `bg-navy/40` or `text-aqua` follows the selected theme across
// the whole ERP and opacity modifiers keep working.
const token = (name) => `rgb(var(--rgb-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: token("navy"),
        navyLight: token("navy-light"),
        aqua: token("accent"),
        aquaSoft: token("accent-soft"),
        foam: token("foam"),
        card: token("card"),
        ink: token("ink"),
        slate: token("slate"),
        line: token("line"),
        mist: token("mist"),
        amber: token("amber"),
        amberSoft: token("amber-soft"),
        coral: token("coral"),
        coralSoft: token("coral-soft"),
        green: token("green"),
        greenSoft: token("green-soft"),
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--rgb-ink) / 0.04), 0 4px 16px rgb(var(--rgb-ink) / 0.04)",
      },
    },
  },
  plugins: [],
};
