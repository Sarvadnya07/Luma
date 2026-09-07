import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  BookOpen,
  Columns,
  Square,
  Loader2,
  ListTree,
} from "lucide-react";
import { useReaderStore } from "../../state/readerState";
import { LumaApi } from "../../lib/tauri";

export const CbzReaderView: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const documentData = useReaderStore((s) => s.documentData);
  const readingProgress = useReaderStore((s) => s.readingProgress);

  const totalPages = Math.max(1, documentData?.total_pages_or_spines || 1);

  // State
  const [currentPage, setCurrentPage] = useState<number>(() => {
    if (readingProgress?.current_page_number) {
      return Math.min(totalPages, Math.max(1, readingProgress.current_page_number));
    }
    return 1;
  });

  const [isDualSpread, setIsDualSpread] = useState<boolean>(false);
  const [readingDirection, setReadingDirection] = useState<"ltr" | "rtl">("ltr");
  const [zoomMode, setZoomMode] = useState<"fit-height" | "fit-width" | "custom">("fit-height");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);

  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Track created Blob URLs to revoke them and avoid memory leaks
  const activeUrlsRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const revokeAllUrls = useCallback(() => {
    for (const url of activeUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    activeUrlsRef.current.clear();
  }, []);

  // Fetch page image bytes
  const fetchPageUrl = useCallback(
    async (pageNum: number): Promise<string | null> => {
      if (!currentBook) return null;
      try {
        const bytes = await LumaApi.readDocumentResource(currentBook.id, `page=${pageNum}`);
        if (!bytes || bytes.length === 0) return null;
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        activeUrlsRef.current.add(url);
        return url;
      } catch (err) {
        console.warn(`[CbzReaderView] Failed to load image for page ${pageNum}:`, err);
        return null;
      }
    },
    [currentBook]
  );

  // Load pages when currentPage or dualSpread changes
  useEffect(() => {
    let isCancelled = false;

    async function loadCurrentPages() {
      setLoading(true);
      setError(null);

      // Clean up previous URLs
      revokeAllUrls();

      try {
        const p1Url = await fetchPageUrl(currentPage);
        if (isCancelled) return;

        let p2Url: string | null = null;
        if (isDualSpread && currentPage < totalPages) {
          p2Url = await fetchPageUrl(currentPage + 1);
        }

        if (isCancelled) return;

        setPageUrl(p1Url);
        setNextPageUrl(p2Url);

        if (!p1Url) {
          setError(`Unable to load page ${currentPage}`);
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          setError(String(e));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadCurrentPages();

    // Scroll container to top
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }

    return () => {
      isCancelled = true;
    };
  }, [currentPage, isDualSpread, totalPages, fetchPageUrl, revokeAllUrls]);

  // Clean up all blob URLs on unmount
  useEffect(() => {
    return () => {
      revokeAllUrls();
    };
  }, [revokeAllUrls]);

  // Navigation handlers
  const goToPage = useCallback(
    (page: number) => {
      const valid = Math.max(1, Math.min(totalPages, page));
      setCurrentPage(valid);

      // Update progress in store
      if (currentBook) {
        const progress = {
          book_id: currentBook.id,
          progress_percentage: valid / totalPages,
          current_locator: `page=${valid}`,
          current_chapter_title: `Page ${valid}`,
          current_page_number: valid,
          total_pages: totalPages,
          last_read_at: new Date().toISOString(),
          sync: {
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            device_id: "dev_01",
            is_deleted: false,
          },
        };
        LumaApi.saveReadingProgress(progress).catch(() => {});
      }
    },
    [currentBook, totalPages]
  );

  const stepForward = useCallback(() => {
    const step = isDualSpread ? 2 : 1;
    goToPage(currentPage + step);
  }, [currentPage, isDualSpread, goToPage]);

  const stepBackward = useCallback(() => {
    const step = isDualSpread ? 2 : 1;
    goToPage(currentPage - step);
  }, [currentPage, isDualSpread, goToPage]);

  const handleNext = useCallback(() => {
    if (readingDirection === "rtl") {
      stepBackward();
    } else {
      stepForward();
    }
  }, [readingDirection, stepForward, stepBackward]);

  const handlePrev = useCallback(() => {
    if (readingDirection === "rtl") {
      stepForward();
    } else {
      stepBackward();
    }
  }, [readingDirection, stepForward, stepBackward]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          handlePrev();
          break;
        case "Home":
          e.preventDefault();
          goToPage(1);
          break;
        case "End":
          e.preventDefault();
          goToPage(totalPages);
          break;
        case "d":
        case "D":
          setIsDualSpread((v) => !v);
          break;
        case "m":
        case "M":
          setReadingDirection((d) => (d === "ltr" ? "rtl" : "ltr"));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, goToPage, totalPages]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121110] text-[#E7E2D9] select-none overflow-hidden">
      {/* Top Floating Mini-Toolbar */}
      <div className="absolute top-3 right-6 z-20 flex items-center gap-1.5 bg-[#1C1A17]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg text-xs">
        <span className="font-mono text-[11px] text-[#A8A29E] mr-2">
          {currentPage} / {totalPages}
        </span>

        {/* Dual Spread Toggle */}
        <button
          onClick={() => setIsDualSpread(!isDualSpread)}
          className={`p-1 rounded transition-colors ${
            isDualSpread ? "bg-white/20 text-white" : "text-[#A8A29E] hover:text-white"
          }`}
          title={isDualSpread ? "Switch to Single Page (D)" : "Switch to Two-Page Spread (D)"}
        >
          {isDualSpread ? <Columns className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>

        {/* Reading Direction (LTR vs RTL Manga) */}
        <button
          onClick={() => setReadingDirection(readingDirection === "ltr" ? "rtl" : "ltr")}
          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase transition-colors ${
            readingDirection === "rtl"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "text-[#A8A29E] hover:text-white"
          }`}
          title={`Direction: ${readingDirection.toUpperCase()} (Click or press M to toggle)`}
        >
          {readingDirection.toUpperCase()}
        </button>

        <div className="w-px h-3.5 bg-white/20 mx-1" />

        {/* Fit Mode Toggle */}
        <button
          onClick={() => {
            if (zoomMode === "fit-height") setZoomMode("fit-width");
            else if (zoomMode === "fit-width") setZoomMode("custom");
            else setZoomMode("fit-height");
          }}
          className="p-1 text-[#A8A29E] hover:text-white rounded transition-colors"
          title={`Mode: ${zoomMode}`}
        >
          {zoomMode === "fit-height" && <Maximize2 className="w-3.5 h-3.5" />}
          {zoomMode === "fit-width" && <Minimize2 className="w-3.5 h-3.5" />}
          {zoomMode === "custom" && <span className="font-mono text-[10px]">{zoomLevel}%</span>}
        </button>

        {/* Zoom In / Out */}
        <button
          onClick={() => {
            setZoomMode("custom");
            setZoomLevel((z) => Math.min(300, z + 25));
          }}
          className="p-1 text-[#A8A29E] hover:text-white rounded"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoomMode("custom");
            setZoomLevel((z) => Math.max(50, z - 25));
          }}
          className="p-1 text-[#A8A29E] hover:text-white rounded"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-white/20 mx-1" />

        {/* Thumbnails rail toggle */}
        <button
          onClick={() => setShowThumbnails(!showThumbnails)}
          className={`p-1 rounded transition-colors ${
            showThumbnails ? "bg-white/20 text-white" : "text-[#A8A29E] hover:text-white"
          }`}
          title="Toggle Thumbnail Strip"
        >
          <ListTree className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Image Stage */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full flex items-center justify-center overflow-auto relative p-4"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 text-[#A8A29E]">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <span className="text-xs font-serif">Decompressing page {currentPage}...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 text-[#A8A29E] max-w-sm text-center p-6 bg-white/5 rounded-xl border border-white/10">
            <BookOpen className="w-10 h-10 text-amber-500/80" />
            <h3 className="font-serif text-sm font-bold text-white">Page Unavailable</h3>
            <p className="text-xs text-[#A8A29E]">{error}</p>
            <button
              onClick={() => goToPage(1)}
              className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors"
            >
              Return to Page 1
            </button>
          </div>
        )}

        {!loading && !error && (
          <div
            className={`flex items-center justify-center gap-2 ${
              readingDirection === "rtl" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Primary Page */}
            {pageUrl && (
              <img
                src={pageUrl}
                alt={`Page ${currentPage}`}
                className={`shadow-2xl rounded-xs transition-all ${
                  zoomMode === "fit-height"
                    ? "max-h-[calc(100vh-5rem)] w-auto object-contain"
                    : zoomMode === "fit-width"
                    ? "w-full max-w-4xl h-auto object-contain"
                    : ""
                }`}
                style={
                  zoomMode === "custom"
                    ? {
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: "center center",
                      }
                    : undefined
                }
              />
            )}

            {/* Secondary Page for Spread Mode */}
            {isDualSpread && nextPageUrl && (
              <img
                src={nextPageUrl}
                alt={`Page ${currentPage + 1}`}
                className={`shadow-2xl rounded-xs transition-all ${
                  zoomMode === "fit-height"
                    ? "max-h-[calc(100vh-5rem)] w-auto object-contain"
                    : zoomMode === "fit-width"
                    ? "w-full max-w-4xl h-auto object-contain"
                    : ""
                }`}
                style={
                  zoomMode === "custom"
                    ? {
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: "center center",
                      }
                    : undefined
                }
              />
            )}
          </div>
        )}

        {/* Click zones for left/right page turns */}
        <div
          onClick={handlePrev}
          className="absolute left-0 top-0 bottom-0 w-24 hover:bg-white/[0.02] cursor-w-resize z-10 flex items-center justify-start pl-4 group"
          title="Previous Page"
        >
          <ChevronLeft className="w-8 h-8 text-white/20 group-hover:text-white/60 transition-colors" />
        </div>
        <div
          onClick={handleNext}
          className="absolute right-0 top-0 bottom-0 w-24 hover:bg-white/[0.02] cursor-e-resize z-10 flex items-center justify-end pr-4 group"
          title="Next Page"
        >
          <ChevronRight className="w-8 h-8 text-white/20 group-hover:text-white/60 transition-colors" />
        </div>
      </div>

      {/* Bottom Thumbnail Strip (Collapsible) */}
      {showThumbnails && (
        <div className="h-28 bg-[#181614] border-t border-white/10 px-4 py-2 flex items-center gap-3 overflow-x-auto z-20 flex-shrink-0">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={`flex-shrink-0 h-20 aspect-[3/4] rounded border flex flex-col items-center justify-center text-xs font-mono transition-all ${
                p === currentPage
                  ? "border-amber-400 bg-amber-500/20 text-amber-200 shadow-md scale-105"
                  : "border-white/10 bg-white/5 text-[#A8A29E] hover:border-white/30 hover:text-white"
              }`}
            >
              <span>{p}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
