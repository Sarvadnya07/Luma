export const LUMA_THEMES = {
  dark: {
    bg: "#090d16",
    surface: "#131b2e",
    border: "#1e293b",
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
    accent: "#38bdf8",
  },
  sepia: {
    bg: "#fbf0d9",
    surface: "#f4e4c1",
    border: "#dfcca6",
    textPrimary: "#433422",
    textSecondary: "#7c6a53",
    accent: "#b45309",
  },
  light: {
    bg: "#ffffff",
    surface: "#f8fafc",
    border: "#e2e8f0",
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    accent: "#0284c7",
  },
} as const;

export const ANNOTATION_HIGHLIGHT_COLORS = [
  { name: "Yellow", hex: "#fde047", darkHex: "#eab308" },
  { name: "Green", hex: "#86efac", darkHex: "#22c55e" },
  { name: "Blue", hex: "#93c5fd", darkHex: "#3b82f6" },
  { name: "Pink", hex: "#f472b6", darkHex: "#ec4899" },
  { name: "Purple", hex: "#d8b4fe", darkHex: "#a855f7" },
] as const;

export type ThemeName = keyof typeof LUMA_THEMES;
