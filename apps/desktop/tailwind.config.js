/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/library-ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/reader-ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/annotation-ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Lora', 'Georgia', 'serif'],
        book: ['Lora', 'Georgia', 'serif'],
      },
      colors: {
        luma: {
          bg: "#FAF7F2",
          sidebar: "#F3EFE6",
          card: "#FFFFFF",
          border: "#E5DFD3",
          borderSubtle: "#EFEAE1",
          ink: "#1C1917",
          inkMuted: "#78716C",
          inkLight: "#A8A29E",
          hover: "#E8E2D6",
          active: "#E4DED3",
          accent: "#18181B",
          highlight: "#FDE68A",
        },
      },
    },
  },
  plugins: [],
};
