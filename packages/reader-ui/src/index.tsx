import React from "react";
import { DocumentFormat, ReaderSettings, ReaderTheme } from "@luma/shared-types";

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: "dark",
  fontSize: 18,
  fontFamily: "serif",
  lineHeight: 1.7,
  marginHorizontal: 32,
  layoutMode: "paginated",
  twoColumn: false,
};

export const READER_THEME_STYLES: Record<
  ReaderTheme,
  { bg: string; text: string; link: string; border: string; paperBg: string }
> = {
  dark: {
    bg: "bg-slate-950",
    text: "text-slate-200",
    link: "text-sky-400",
    border: "border-slate-800",
    paperBg: "#020617",
  },
  light: {
    bg: "bg-white",
    text: "text-slate-900",
    link: "text-blue-600",
    border: "border-slate-200",
    paperBg: "#ffffff",
  },
  sepia: {
    bg: "bg-[#fbf0d9]",
    text: "text-[#5f4b32]",
    link: "text-[#8b4513]",
    border: "border-[#edd6b3]",
    paperBg: "#fbf0d9",
  },
  eink: {
    bg: "bg-[#f4f4f4]",
    text: "text-black",
    link: "text-black underline",
    border: "border-black",
    paperBg: "#f4f4f4",
  },
  paper: {
    bg: "bg-[#EAEFEF]",
    text: "text-[#1C1917]",
    link: "text-teal-700",
    border: "border-[#CCD6D6]",
    paperBg: "#EAEFEF",
  },
};

export interface ReaderProps {
  bookId: string;
  format: DocumentFormat;
  initialLocator?: string;
  onProgressChange?: (locator: string, percentage: number) => void;
  onTextSelected?: (text: string, prefix: string, suffix: string) => void;
}

export const ReaderContainer: React.FC<{
  theme?: ReaderTheme;
  children: React.ReactNode;
}> = ({ theme = "dark", children }) => {
  const styles = READER_THEME_STYLES[theme];
  return (
    <div className={`relative w-full h-full flex flex-col ${styles.bg} ${styles.text} overflow-hidden select-text transition-colors duration-200`}>
      {children}
    </div>
  );
};
