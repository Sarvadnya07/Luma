import React, { useEffect, useState } from "react";
import { ReaderStoreProvider, useReaderStore } from "../state/readerContext";
import { LibraryView } from "../features/library/LibraryView";
import { ReaderView } from "../features/reader/ReaderView";

export interface AppProps {
  api?: import("../lib/tauri").LumaApiClient;
}

interface AppContentProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ isDarkMode, onToggleDarkMode }) => {
  const currentBook = useReaderStore((s) => s.currentBook);

  useEffect(() => {
    if (currentBook) {
      console.log("[LUMA-OPEN] 8. ROUTE_NAVIGATION_COMPLETE", {
        timestamp: new Date().toISOString(),
        bookId: currentBook.id,
        format: currentBook.primary_file_id ? "resolving" : "unknown",
        currentBook: currentBook.title,
        view: "ReaderView",
      });
    }
  }, [currentBook]);

  return (
    <main className="h-screen w-screen flex flex-col bg-[#FAF7F2] text-[#1C1917] antialiased overflow-hidden transition-colors dark:bg-[#141312] dark:text-[#F5F1EA]">
      {currentBook ? (
        <ReaderView
          book={currentBook}
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
        />
      ) : (
        <LibraryView
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
        />
      )}
    </main>
  );
};

export const App: React.FC<AppProps> = ({ api }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof localStorage === "undefined") {
      return false;
    }
    return localStorage.getItem("luma_theme") === "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    root.style.colorScheme = isDarkMode ? "dark" : "light";
    localStorage.setItem("luma_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const content = (
    <AppContent
      isDarkMode={isDarkMode}
      onToggleDarkMode={handleToggleDarkMode}
    />
  );

  return api ? <ReaderStoreProvider api={api}>{content}</ReaderStoreProvider> : content;
};
