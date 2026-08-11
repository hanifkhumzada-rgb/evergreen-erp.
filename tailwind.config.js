/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B3142",
        navyLight: "#123B4E",
        aqua: "#0E9E97",
        aquaSoft: "#E3F5F3",
        foam: "#F6FAFA",
        ink: "#0F2027",
        slate: "#5B7280",
        line: "#E2EAEA",
        amber: "#DE9B33",
        amberSoft: "#FCF1DE",
        coral: "#D95A44",
        coralSoft: "#FBE9E5",
        green: "#2E9E6B",
        greenSoft: "#E3F5EC",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
