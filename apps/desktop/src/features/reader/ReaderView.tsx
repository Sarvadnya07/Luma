import React, { useEffect } from "react";
import {
  ArrowLeft,
  ListTree,
  Highlighter,
  Bookmark as BookmarkIcon,
  Search,
  Type,
  Maximize,
  Minimize,
  CheckCircle2,
} from "lucide-react";
import { Book } from "@luma/shared-types";
import { useReaderStore } from "../../state/readerState";
import { ReaderSidebar } from "./ReaderSidebar";
import { TypographySettingsDrawer } from "./TypographySettingsDrawer";
import { EpubReaderView } from "./EpubReaderView";
import { PdfReaderView } from "./PdfReaderView";

export interface ReaderViewProps {
  book: Book;
}

export const ReaderView: React.FC<ReaderViewProps> = ({ book }) => {
  const closeReader = useReaderStore((s) => s.closeReader);
  const documentData = useReaderStore((s) => s.documentData);
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const bookmarks = useReaderStore((s) => s.bookmarks);
  const sidebarTab = useReaderStore((s) => s.sidebarTab);
  const setSidebarTab = useReaderStore((s) => s.setSidebarTab);
  const toggleTypography = useReaderStore((s) => s.toggleTypography);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);
  const statusMessage = useReaderStore((s) => s.statusMessage);
  const loadChapter = useReaderStore((s) => s.loadChapter);
  const currentSpineIndex = useReaderStore((s) => s.currentSpineIndex);

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const isCurrentBookmarked =
    readingProgress && bookmarks.some((b) => b.locator === readingProgress.current_locator);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing inside input / textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "escape":
          if (sidebarTab) setSidebarTab(null);
          else closeReader();
          break;
        case "b":
          toggleBookmark();
          break;
        case "t":
          setSidebarTab(sidebarTab === "toc" ? null : "toc");
          break;
        case "a":
          setSidebarTab(sidebarTab === "annotations" ? null : "annotations");
          break;
        case "f":
          setSidebarTab(sidebarTab === "search" ? null : "search");
          break;
        case "arrowleft":
          if (currentSpineIndex > 0) loadChapter(currentSpineIndex - 1);
          break;
        case "arrowright":
          if (documentData && currentSpineIndex < (documentData.total_pages_or_spines || 1) - 1) {
            loadChapter(currentSpineIndex + 1);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarTab, currentSpineIndex, documentData]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const isPdf = documentData?.file.format === "pdf";

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Status Toast Notification */}
      {statusMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 border border-slate-700/80 text-sky-400 text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {statusMessage}
        </div>
      )}

      {/* Top Reader Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 flex items-center justify-between z-30 flex-shrink-0">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={closeReader}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Return to Library (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </button>
          <div className="w-[1px] h-4 bg-slate-800 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-xs font-semibold text-slate-100 truncate max-w-sm sm:max-w-md">
              {book.title}
            </h1>
            {currentChapter?.title && (
              <p className="text-[10px] text-slate-400 truncate hidden md:block">
                {currentChapter.title}
              </p>
            )}
          </div>
        </div>

        {/* Right: Reader Action Controls */}
        <div className="flex items-center gap-1">
          {/* Table of Contents */}
          <button
            onClick={() => setSidebarTab(sidebarTab === "toc" ? null : "toc")}
            className={`p-2 rounded-lg transition-colors ${
              sidebarTab === "toc" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Table of Contents (T)"
          >
            <ListTree className="w-4 h-4" />
          </button>

          {/* Annotations */}
          <button
            onClick={() => setSidebarTab(sidebarTab === "annotations" ? null : "annotations")}
            className={`p-2 rounded-lg transition-colors ${
              sidebarTab === "annotations" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Annotations (A)"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          {/* Bookmarks */}
          <button
            onClick={() => setSidebarTab(sidebarTab === "bookmarks" ? null : "bookmarks")}
            className={`p-2 rounded-lg transition-colors ${
              sidebarTab === "bookmarks" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Bookmarks Panel"
          >
            <BookmarkIcon className="w-4 h-4" />
          </button>

          {/* In-Doc Search */}
          <button
            onClick={() => setSidebarTab(sidebarTab === "search" ? null : "search")}
            className={`p-2 rounded-lg transition-colors ${
              sidebarTab === "search" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Search in Document (F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Toggle Bookmark Current Page */}
          <button
            onClick={toggleBookmark}
            className={`p-2 rounded-lg transition-colors ${
              isCurrentBookmarked ? "text-amber-400 hover:bg-amber-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title={isCurrentBookmarked ? "Remove bookmark" : "Bookmark this location (B)"}
          >
            <BookmarkIcon className={`w-4 h-4 ${isCurrentBookmarked ? "fill-amber-400" : ""}`} />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          {/* Typography Settings */}
          <button
            onClick={toggleTypography}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Reading Settings & Themes"
          >
            <Type className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors hidden sm:block"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Tabbed Sidebar */}
        <ReaderSidebar />

        {/* Floating Typography Settings Drawer */}
        <TypographySettingsDrawer />

        {/* Document Engine Viewport */}
        <main className="flex-1 h-full overflow-hidden flex flex-col relative">
          {isPdf ? <PdfReaderView /> : <EpubReaderView />}
        </main>
      </div>
    </div>
  );
};
