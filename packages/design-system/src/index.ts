export const LUMA_THEMES = {
  paper: {
    bg: "#FAF7F2",
    surface: "#FFFFFF",
    sidebar: "#F3EFE6",
    border: "#E5DFD3",
    textPrimary: "#1C1917",
    textSecondary: "#78716C",
    accent: "#18181B",
  },
  sepia: {
    bg: "#F4ECD8",
    surface: "#FDF6E2",
    sidebar: "#EBDDBF",
    border: "#D8C7A5",
    textPrimary: "#433422",
    textSecondary: "#7C6A53",
    accent: "#8C4A1E",
  },
  dark: {
    bg: "#18181B",
    surface: "#27272A",
    sidebar: "#202023",
    border: "#3F3F46",
    textPrimary: "#F4F4F5",
    textSecondary: "#A1A1AA",
    accent: "#FAFAFA",
  },
  light: {
    bg: "#FFFFFF",
    surface: "#F8FAFC",
    sidebar: "#F1F5F9",
    border: "#E2E8F0",
    textPrimary: "#0F172A",
    textSecondary: "#64748B",
    accent: "#0F172A",
  },
} as const;

export const ANNOTATION_HIGHLIGHT_COLORS = [
  { name: "Yellow", hex: "#FDE68A", darkHex: "#F59E0B" },
  { name: "Green", hex: "#A7F3D0", darkHex: "#10B981" },
  { name: "Blue", hex: "#BAE6FD", darkHex: "#0EA5E9" },
  { name: "Pink", hex: "#FBCFE8", darkHex: "#EC4899" },
  { name: "Purple", hex: "#E9D5FF", darkHex: "#A855F7" },
] as const;

export type ThemeName = keyof typeof LUMA_THEMES;

