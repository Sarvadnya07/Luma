import React, { Suspense, lazy, useEffect, useState } from "react";
import { ReaderStoreProvider, useReaderStore } from "../state/readerContext";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { applyTheme, persistTheme, resolveInitialTheme, toggleTheme, type AppTheme } from "../lib/theme";

/**
 * The two top-level views are split so the library (the landing surface) does
 * not pay for the reader engines — see FE-HIGH-4. Everything below the view
 * level is split inside the view that owns it.
 */
const LibraryView = lazy(() =>
  import("../features/library/LibraryView").then((m) => ({ default: m.LibraryView }))
);
const ReaderView = lazy(() =>
  import("../features/reader/ReaderView").then((m) => ({ default: m.ReaderView }))
);

export interface AppProps {
  api?: import("../lib/tauri").LumaApiClient;
}

const ViewFallback: React.FC<{ label: string }> = ({ label }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex flex-1 items-center justify-center text-xs text-[#78716C] dark:text-[#B8AEA2]"
  >
    {label}
  </div>
);

interface AppContentProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ isDarkMode, onToggleDarkMode }) => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const closeReader = useReaderStore((s) => s.closeReader);

  return (
    <main className="h-screen w-screen flex flex-col bg-[#FAF7F2] text-[#1C1917] antialiased overflow-hidden transition-colors dark:bg-[#141312] dark:text-[#F5F1EA]">
      <ErrorBoundary
        label={currentBook ? "reader" : "library"}
        title={currentBook ? "This document view stopped responding" : "The library view stopped responding"}
        onReturnHome={closeReader}
        resetKey={currentBook?.id ?? "library"}
      >
        <Suspense fallback={<ViewFallback label={currentBook ? "Opening reader…" : "Loading library…"} />}>
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
        </Suspense>
      </ErrorBoundary>
    </main>
  );
};

export const App: React.FC<AppProps> = ({ api }) => {
  const [theme, setTheme] = useState<AppTheme>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const handleToggleDarkMode = () => {
    setTheme((previous) => toggleTheme(previous));
  };

  const content = (
    <AppContent
      isDarkMode={theme === "dark"}
      onToggleDarkMode={handleToggleDarkMode}
    />
  );

  return api ? <ReaderStoreProvider api={api}>{content}</ReaderStoreProvider> : content;
};
