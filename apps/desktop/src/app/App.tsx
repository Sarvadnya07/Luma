import React, { useEffect, useState } from "react";
import { useReaderStore } from "../state/readerState";
import { LibraryView } from "../features/library/LibraryView";
import { ReaderView } from "../features/reader/ReaderView";

export const App: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const settingsTheme = useReaderStore((s) => s.settings.theme);
  const updateSettings = useReaderStore((s) => s.updateSettings);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof localStorage === "undefined") {
      return false;
    }
    return localStorage.getItem("luma_theme") === "dark";
  });

  // Keep state synchronized with reader settings theme
  useEffect(() => {
    if (settingsTheme) {
      setIsDarkMode(settingsTheme === "dark");
    }
  }, [settingsTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    root.style.colorScheme = isDarkMode ? "dark" : "light";
    localStorage.setItem("luma_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      updateSettings({ theme: next ? "dark" : "light" });
      return next;
    });
  };

  return (
    <main className="h-screen w-screen flex flex-col bg-[#FAF7F2] text-[#1C1917] antialiased overflow-hidden transition-colors dark:bg-[#141312] dark:text-[#F5F1EA]">
      {currentBook ? (
        <ReaderView
          book={currentBook}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />
      ) : (
        <LibraryView
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />
      )}
    </main>
  );
};
