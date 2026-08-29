/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        luma: {
          bg: "#0f172a",
          card: "#1e293b",
          border: "#334155",
          accent: "#38bdf8",
          text: "#f8fafc",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
