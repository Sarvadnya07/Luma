import React, { useEffect } from "react";
import {
  ArrowLeft,
  ListTree,
  Highlighter,
  Bookmark as BookmarkIcon,
  Search,
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
import { EInkReaderView } from "./EInkReaderView";

export interface ReaderViewProps {
  book: Book;
}

export const ReaderView: React.FC<ReaderViewProps> = ({ book }) => {
  const closeReader = useReaderStore((s) => s.closeReader);
  const documentData = useReaderStore((s) => s.documentData);
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const bookmarks = useReaderStore((s) => s.bookmarks);
  const sidebarTab = useReaderStore((s) => s.sidebarTab);
  const setSidebarTab = useReaderStore((s) => s.setSidebarTab);
  const toggleTypography = useReaderStore((s) => s.toggleTypography);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);
  const statusMessage = useReaderStore((s) => s.statusMessage);
  const loadChapter = useReaderStore((s) => s.loadChapter);
  const currentSpineIndex = useReaderStore((s) => s.currentSpineIndex);
  const settings = useReaderStore((s) => s.settings);

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const isCurrentBookmarked =
    readingProgress && bookmarks.some((b) => b.locator === readingProgress.current_locator);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    <div className="relative w-full h-full flex flex-col bg-[#FAF7F2] text-[#1C1917] overflow-hidden">
      {/* Status Toast Notification */}
      {statusMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-[#18181B] text-white text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {statusMessage}
        </div>
      )}

      {/* Top Reader Navigation Bar matching Screen 3 & Screen 5 */}
      <header className="h-12 border-b border-[#E5DFD3] bg-[#FAF7F2] px-6 flex items-center justify-between z-30 flex-shrink-0">
        {/* Left: Back to Library or Back to Reader */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              if (sidebarTab) {
                setSidebarTab(null);
              } else {
                closeReader();
              }
            }}
            className="flex items-center gap-1.5 py-1 text-xs font-medium text-[#78716C] hover:text-[#18181B] transition-colors"
            title="Return to Library (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{sidebarTab ? "Reader" : "Library"}</span>
          </button>
        </div>

        {/* Center: Book Title in editorial serif */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-center">
          <h1 className="font-serif text-sm font-bold text-[#1C1917] tracking-tight truncate max-w-sm sm:max-w-md">
            {book.title}
          </h1>
        </div>

        {/* Right: Reader Action Controls (Search, Typography, Annotations, Bookmark) */}
        <div className="flex items-center gap-1">
          {/* Typography Settings (TT icon) */}
          <button
            onClick={toggleTypography}
            className="p-1.5 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] transition-colors font-serif font-bold text-xs"
            title="Reading Settings & Themes"
          >
            <span className="text-xs tracking-tighter">TT</span>
          </button>

          {/* Table of Contents */}
          <button
            onClick={() => setSidebarTab(sidebarTab === "toc" ? null : "toc")}
            className={`p-1.5 rounded-md transition-colors ${
              sidebarTab === "toc"
                ? "bg-[#E4DED3] text-[#18181B]"
                : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
            }`}
            title="Table of Contents (T)"
          >
            <ListTree className="w-4 h-4" />
          </button>

          {/* Annotations & Notes */}
          <button
            onClick={() => setSidebarTab(sidebarTab === "annotations" ? null : "annotations")}
            className={`p-1.5 rounded-md transition-colors ${
              sidebarTab === "annotations"
                ? "bg-[#E4DED3] text-[#18181B]"
                : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
            }`}
            title="Annotations & Notes (A)"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          {/* In-Doc Search */}
          <button
            onClick={() => setSidebarTab(sidebarTab === "search" ? null : "search")}
            className={`p-1.5 rounded-md transition-colors ${
              sidebarTab === "search"
                ? "bg-[#E4DED3] text-[#18181B]"
                : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
            }`}
            title="Search in Document (F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Bookmark Current Page */}
          <button
            onClick={toggleBookmark}
            className={`p-1.5 rounded-md transition-colors ${
              isCurrentBookmarked
                ? "text-amber-500 hover:bg-amber-100/50"
                : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
            }`}
            title={isCurrentBookmarked ? "Remove bookmark" : "Bookmark this location (B)"}
          >
            <BookmarkIcon className={`w-4 h-4 ${isCurrentBookmarked ? "fill-amber-500" : ""}`} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] transition-colors hidden sm:block"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Tabbed Sidebar (Screen 5) */}
        <ReaderSidebar />

        {/* Floating Typography Settings Drawer */}
        <TypographySettingsDrawer />

        {/* Document Engine Viewport */}
        <main className="flex-1 h-full overflow-hidden flex flex-col relative bg-[#FAF7F2]">
          {settings.theme === "eink" ? (
            <EInkReaderView />
          ) : isPdf ? (
            <PdfReaderView />
          ) : (
            <EpubReaderView />
          )}
        </main>
      </div>
    </div>
  );
};

