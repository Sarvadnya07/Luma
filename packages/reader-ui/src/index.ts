import React from "react";
import { DocumentFormat } from "@luma/shared-types";
import { ThemeName } from "@luma/design-system";

export interface ReaderSettings {
  theme: ThemeName;
  fontSize: number;
  fontFamily: "sans" | "serif" | "mono";
  lineHeight: number;
  marginHorizontal: number;
  twoColumn: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: "dark",
  fontSize: 18,
  fontFamily: "serif",
  lineHeight: 1.6,
  marginHorizontal: 32,
  twoColumn: false,
};

export interface ReaderProps {
  bookId: string;
  format: DocumentFormat;
  initialLocator?: string;
  onProgressChange?: (locator: string, percentage: number) => void;
  onTextSelected?: (text: string, prefix: string, suffix: string) => void;
}

export const ReaderContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      {children}
    </div>
  );
};
