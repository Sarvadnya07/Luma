import React, { useEffect, useState, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Layout,
  ListTree,
  Image as ImageIcon,
  Bookmark as BookmarkIcon,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useReaderStore } from "../../state/readerContext";
import { LumaApi } from "../../lib/tauri";
import { TextSelectionToolbar } from "./TextSelectionToolbar";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { pdfjsLib } from "./pdfWorker";
import { perfTelemetry } from "../../lib/perfTelemetry";


export const PdfReaderView: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const documentData = useReaderStore((s) => s.documentData);
  const currentPdfPage = useReaderStore((s) => s.currentPdfPage);
  const leftPdfPageData = useReaderStore((s) => s.leftPdfPageData);
  const rightPdfPageData = useReaderStore((s) => s.rightPdfPageData);
  const bookmarks = useReaderStore((s) => s.bookmarks);
  const annotations = useReaderStore((s) => s.annotations);
  const loadPdfPage = useReaderStore((s) => s.loadPdfPage);
  const createHighlight = useReaderStore((s) => s.createHighlight);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);
  const searchQuery = useReaderStore((s) => s.searchQuery);
  const setSearchResults = useReaderStore((s) => s.setSearchResults);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [isDualSpread, setIsDualSpread] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<"contents" | "thumbnails" | "bookmarks">("thumbnails");
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectedPageNum, setSelectedPageNum] = useState<number | undefined>(undefined);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, pdfDoc?.numPages || documentData?.total_pages_or_spines || 1);
  const leftPageNum = Math.floor((currentPdfPage - 1) / 2) * 2 + 1;
  const rightPageNum = Math.min(totalPages, leftPageNum + 1);

  // Scroll to top whenever the current page or dual spread mode changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPdfPage, isDualSpread]);

  useEffect(() => {
    console.log("[LUMA-OPEN] 10. FORMAT_READER_MOUNT", {
      timestamp: new Date().toISOString(),
      bookId: currentBook?.id,
      format: "pdf",
      totalPages,
      currentPage: currentPdfPage,
    });
  }, [currentBook?.id]);

  // Load PDF Document bytes into PDF.js proxy
  useEffect(() => {
    let isCancelled = false;

    async function loadPdfBytes() {
      if (!currentBook) return;
      try {
        const primaryId = currentBook.primary_file_id || undefined;
        const bytes = await LumaApi.getBookFileBytes(currentBook.id, primaryId);
        if (isCancelled) return;

        if (bytes && bytes.length > 0) {
          const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
          const loadingTask = pdfjsLib.getDocument({
            data: uint8,
            disableStream: true,
          });
          const doc = await loadingTask.promise;
          if (!isCancelled) {
            setPdfDoc(doc);
            perfTelemetry.mark("LUMA_PERF_PDF_DOCUMENT_READY", { numPages: doc.numPages });
          }

        }
      } catch (err) {
        console.warn("[PdfReaderView] Failed to load PDF file bytes for PDF.js:", err);
      }
    }

    loadPdfBytes();

    return () => {
      isCancelled = true;
    };
  }, [currentBook]);

  // Load page text & metadata on mount or navigation
  useEffect(() => {
    if (!leftPdfPageData && currentBook) {
      loadPdfPage(currentPdfPage || 1);
    }
  }, [currentBook, currentPdfPage, leftPdfPageData, loadPdfPage]);

  // Client-side in-document search across all PDF pages using PDF.js
  useEffect(() => {
    let isCancelled = false;

    if (!pdfDoc || !searchQuery || !searchQuery.trim()) {
      return;
    }

    const cleanQuery = searchQuery.trim().toLowerCase();
    const runPdfSearch = async () => {
      const results: any[] = [];
      const total = pdfDoc.numPages;

      for (let pageNum = 1; pageNum <= total; pageNum++) {
        if (isCancelled) return;
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const strings: string[] = [];
          for (const item of textContent.items as any[]) {
            if (typeof item.str === "string") {
              strings.push(item.str);
            }
          }
          const fullText = strings.join(" ");
          const lowerText = fullText.toLowerCase();

          let matchIndex = lowerText.indexOf(cleanQuery);
          let pageMatches = 0;
          while (matchIndex !== -1 && !isCancelled && pageMatches < 10) {
            const start = Math.max(0, matchIndex - 40);
            const end = Math.min(fullText.length, matchIndex + cleanQuery.length + 40);
            const snippet =
              (start > 0 ? "..." : "") +
              fullText.substring(start, end).trim() +
              (end < fullText.length ? "..." : "");

            results.push({
              spine_index: pageNum - 1,
              chapter_title: `Page ${pageNum}`,
              locator: `page=${pageNum}`,
              snippet,
              match_char_offset: matchIndex,
            });

            pageMatches++;
            matchIndex = lowerText.indexOf(cleanQuery, matchIndex + cleanQuery.length);
          }
        } catch (err) {
          console.warn(`[PdfSearch] Failed to extract text for page ${pageNum}:`, err);
        }
      }

      if (!isCancelled && results.length > 0) {
        setSearchResults(results);
      }
    };

    const timer = setTimeout(runPdfSearch, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [pdfDoc, searchQuery, setSearchResults]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        loadPdfPage(Math.max(1, isDualSpread ? leftPageNum - 2 : currentPdfPage - 1));
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        loadPdfPage(Math.min(totalPages, isDualSpread ? leftPageNum + 2 : currentPdfPage + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPdfPage, isDualSpread, leftPageNum, loadPdfPage, totalPages]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionPos(null);
      setSelectedText("");
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setSelectionPos(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Determine which page the selection is within
    const anchorNode = selection.anchorNode;
    const pageContainer = (anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement)?.closest("[data-page-num]");
    const pageNumAttr = pageContainer?.getAttribute("data-page-num");
    if (pageNumAttr) {
      setSelectedPageNum(parseInt(pageNumAttr, 10));
    } else {
      setSelectedPageNum(isDualSpread ? leftPageNum : currentPdfPage);
    }

    setSelectedText(text);
    setSelectionPos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  };

  return (
    <div
      className="relative w-full h-full flex bg-[#FAF7F2] dark:bg-[#141312] select-text overflow-hidden text-[#1C1917] dark:text-[#F5F1EA]"
      onMouseUp={handleMouseUp}
    >
      <TextSelectionToolbar
        position={selectionPos}
        selectedText={selectedText}
        onHighlight={(colorHex, note) => {
          createHighlight(colorHex, selectedText, undefined, undefined, note, selectedPageNum);
          window.getSelection()?.removeAllRanges();
          setSelectionPos(null);
        }}
        onBookmark={toggleBookmark}
        onClose={() => setSelectionPos(null)}
      />

      {/* Left Thumbnail & TOC Sidebar */}
      <aside className="w-64 border-r border-[#E5DFD3] dark:border-[#27272A] bg-[#FAF7F2] dark:bg-[#18181B] flex flex-col z-20 flex-shrink-0 select-none text-[#1C1917] dark:text-[#F5F1EA]">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#E5DFD3] dark:border-[#27272A]">
          <h3 className="font-serif text-sm font-bold text-[#1C1917] dark:text-[#F5F1EA] truncate">
            {currentBook?.title || "Document"}
          </h3>
          <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA] truncate mt-0.5 font-serif">
            Page {currentPdfPage} of {totalPages}
          </p>
        </div>

        {/* 3 Tabs */}
        <div className="grid grid-cols-3 border-b border-[#E5DFD3] dark:border-[#27272A] bg-[#EFEAE1]/60 dark:bg-[#27272A]/60 text-xs font-medium">
          <button
            onClick={() => setSidebarTab("contents")}
            className={`py-2 px-1 flex flex-col items-center gap-1 transition-colors border-b-2 ${
              sidebarTab === "contents"
                ? "border-[#18181B] dark:border-[#F5F1EA] text-[#18181B] dark:text-[#F5F1EA] font-bold bg-[#FAF7F2] dark:bg-[#18181B]"
                : "border-transparent text-[#78716C] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F5F1EA]"
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="text-[10px]">Contents</span>
          </button>
          <button
            onClick={() => setSidebarTab("thumbnails")}
            className={`py-2 px-1 flex flex-col items-center gap-1 transition-colors border-b-2 ${
              sidebarTab === "thumbnails"
                ? "border-[#18181B] dark:border-[#F5F1EA] text-[#18181B] dark:text-[#F5F1EA] font-bold bg-[#FAF7F2] dark:bg-[#18181B]"
                : "border-transparent text-[#78716C] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F5F1EA]"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="text-[10px]">Thumbnails</span>
          </button>
          <button
            onClick={() => setSidebarTab("bookmarks")}
            className={`py-2 px-1 flex flex-col items-center gap-1 transition-colors border-b-2 ${
              sidebarTab === "bookmarks"
                ? "border-[#18181B] dark:border-[#F5F1EA] text-[#18181B] dark:text-[#F5F1EA] font-bold bg-[#FAF7F2] dark:bg-[#18181B]"
                : "border-transparent text-[#78716C] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F5F1EA]"
            }`}
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
            <span className="text-[10px]">Bookmarks</span>
          </button>
        </div>

        {/* Tab Content Stream */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {sidebarTab === "contents" ? (
            documentData?.toc && documentData.toc.length > 0 ? (
              documentData.toc.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const match = item.locator.match(/page=(\d+)/);
                    if (match && match[1]) loadPdfPage(parseInt(match[1], 10));
                  }}
                  className="p-2 rounded-lg hover:bg-[#EFEAE1] dark:hover:bg-[#27272A] cursor-pointer text-xs font-serif text-[#292524] dark:text-[#E4E4E7] truncate"
                >
                  {item.title}
                </div>
              ))
            ) : (
              <div className="text-xs text-[#78716C] dark:text-[#A1A1AA] text-center py-6">No table of contents</div>
            )
          ) : sidebarTab === "bookmarks" ? (
            bookmarks.length > 0 ? (
              bookmarks.map((bmk) => (
                <div
                  key={bmk.id}
                  onClick={() => {
                    if (bmk.page_number) loadPdfPage(bmk.page_number);
                  }}
                  className="p-2 rounded-lg hover:bg-[#EFEAE1] dark:hover:bg-[#27272A] cursor-pointer text-xs font-serif text-[#292524] dark:text-[#E4E4E7] truncate"
                >
                  {bmk.title || `Page ${bmk.page_number || 1}`}
                </div>
              ))
            ) : (
              <div className="text-xs text-[#78716C] dark:text-[#A1A1AA] text-center py-6">No bookmarks yet</div>
            )
          ) : (
            Array.from({ length: Math.min(totalPages, 100) }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                onClick={() => loadPdfPage(pageNum)}
                className="space-y-1 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] text-[#78716C] dark:text-[#A1A1AA] px-1 font-mono">
                  <span>Page {pageNum}</span>
                </div>
                <div
                  className={`w-full rounded-lg overflow-hidden transition-all shadow-xs ${
                    pageNum === currentPdfPage || pageNum === leftPageNum || (isDualSpread && pageNum === rightPageNum)
                      ? "ring-2 ring-teal-700 dark:ring-teal-400 shadow-md"
                      : "opacity-85 group-hover:opacity-100"
                  }`}
                >
                  <PdfPageCanvas
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    isThumbnail={true}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Reading Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Floating Top Controls Header */}
        <div className="h-12 border-b border-[#E5DFD3] dark:border-[#27272A] bg-[#FAF7F2] dark:bg-[#18181B] px-6 flex items-center justify-between z-10 select-none text-[#1C1917] dark:text-[#F5F1EA]">
          <div className="flex items-center gap-3">
            <button
              disabled={leftPageNum <= 1}
              onClick={() => loadPdfPage(Math.max(1, isDualSpread ? leftPageNum - 2 : currentPdfPage - 1))}
              className="p-1 hover:text-[#18181B] dark:hover:text-[#F5F1EA] text-[#78716C] dark:text-[#A1A1AA] rounded hover:bg-[#EFEAE1] dark:hover:bg-[#27272A] disabled:opacity-30"
              title="Previous Page (ArrowLeft)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-semibold text-[#1C1917] dark:text-[#F5F1EA]">
              {isDualSpread ? `${leftPageNum}-${rightPageNum} / ${totalPages}` : `${currentPdfPage} / ${totalPages}`}
            </span>
            <button
              disabled={isDualSpread ? rightPageNum >= totalPages : currentPdfPage >= totalPages}
              onClick={() => loadPdfPage(Math.min(totalPages, isDualSpread ? leftPageNum + 2 : currentPdfPage + 1))}
              className="p-1 hover:text-[#18181B] dark:hover:text-[#F5F1EA] text-[#78716C] dark:text-[#A1A1AA] rounded hover:bg-[#EFEAE1] dark:hover:bg-[#27272A] disabled:opacity-30"
              title="Next Page (ArrowRight)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A1A1AA]">
            <button
              onClick={() => setZoom((z) => Math.max(60, z - 10))}
              className="p-1 hover:text-[#18181B] dark:hover:text-[#F5F1EA] rounded hover:bg-[#EFEAE1] dark:hover:bg-[#27272A]"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-[#1C1917] dark:text-[#F5F1EA]">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(180, z + 10))}
              className="p-1 hover:text-[#18181B] dark:hover:text-[#F5F1EA] rounded hover:bg-[#EFEAE1] dark:hover:bg-[#27272A]"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-[#E5DFD3] dark:bg-[#3F3F46] mx-1" />
            <button
              onClick={() => setIsDualSpread(!isDualSpread)}
              className={`p-1.5 rounded-md transition-colors ${
                isDualSpread
                  ? "bg-[#E4DED3] dark:bg-[#27272A] text-[#18181B] dark:text-[#F5F1EA]"
                  : "text-[#78716C] dark:text-[#A1A1AA] hover:bg-[#EFEAE1] dark:hover:bg-[#27272A] hover:text-[#18181B] dark:hover:text-[#F5F1EA]"
              }`}
              title="Toggle Dual Spread Mode"
            >
              <Layout className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dual / Single Page Spread Viewport */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto p-8 flex justify-center items-start bg-[#FAF7F2] dark:bg-[#141312]">
          <div className="flex gap-6 items-start transition-transform duration-150">
            {/* Left / Primary Page Canvas */}
            <div className="flex flex-col items-center">
              <PdfPageCanvas
                pdfDoc={pdfDoc}
                pageNum={isDualSpread ? leftPageNum : currentPdfPage}
                zoom={zoom}
                fallbackText={leftPdfPageData?.text_content}
                hasTextLayer={leftPdfPageData?.has_text_layer}
                targetWidth={isDualSpread ? 480 : 640}
                annotations={annotations}
                searchQuery={searchQuery}
              />
              <div className="text-center font-mono text-[10px] text-[#78716C] dark:text-[#A1A1AA] pt-2">
                Page {isDualSpread ? leftPageNum : currentPdfPage}
              </div>
            </div>

            {/* Right Page Canvas (Only in Dual Spread Mode) */}
            {isDualSpread && rightPageNum <= totalPages && (
              <div className="flex flex-col items-center">
                <PdfPageCanvas
                  pdfDoc={pdfDoc}
                  pageNum={rightPageNum}
                  zoom={zoom}
                  fallbackText={rightPdfPageData?.text_content}
                  hasTextLayer={rightPdfPageData?.has_text_layer}
                  targetWidth={480}
                  annotations={annotations}
                  searchQuery={searchQuery}
                />
                <div className="text-center font-mono text-[10px] text-[#78716C] dark:text-[#A1A1AA] pt-2">
                  Page {rightPageNum}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
