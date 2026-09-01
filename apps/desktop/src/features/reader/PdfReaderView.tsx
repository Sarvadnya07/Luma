import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Layout,
  ListTree,
  Image as ImageIcon,
  Bookmark as BookmarkIcon,
  BookOpen,
} from "lucide-react";
import { useReaderStore } from "../../state/readerState";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

export const PdfReaderView: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const documentData = useReaderStore((s) => s.documentData);
  const currentPdfPage = useReaderStore((s) => s.currentPdfPage);
  const leftPdfPageData = useReaderStore((s) => s.leftPdfPageData);
  const rightPdfPageData = useReaderStore((s) => s.rightPdfPageData);
  const bookmarks = useReaderStore((s) => s.bookmarks);
  const loadPdfPage = useReaderStore((s) => s.loadPdfPage);
  const createHighlight = useReaderStore((s) => s.createHighlight);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);

  const [zoom, setZoom] = useState<number>(100);
  const [isDualSpread, setIsDualSpread] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<"contents" | "thumbnails" | "bookmarks">("thumbnails");
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");

  const totalPages = Math.max(1, documentData?.total_pages_or_spines || 1);
  const leftPageNum = currentPdfPage % 2 === 0 ? currentPdfPage : Math.max(1, currentPdfPage - 1);
  const rightPageNum = Math.min(totalPages, leftPageNum + 1);

  // Load page on mount or when book opens
  useEffect(() => {
    if (!leftPdfPageData && currentBook) {
      loadPdfPage(currentPdfPage || 1);
    }
  }, [currentBook, currentPdfPage, leftPdfPageData, loadPdfPage]);

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

    setSelectedText(text);
    setSelectionPos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  };

  const renderPageBody = (textContent?: string, pageNum?: number) => {
    if (!textContent || textContent.trim() === `Page ${pageNum}` || textContent.trim().length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#78716C]">
          <BookOpen className="w-8 h-8 mb-2 opacity-40 text-[#8C8275]" />
          <p className="font-serif text-sm font-semibold text-[#1C1917]">
            {currentBook?.title || "Document"}
          </p>
          <p className="text-xs text-[#78716C] mt-1 font-mono">Page {pageNum}</p>
        </div>
      );
    }

    // Split text into paragraphs
    const paragraphs = textContent
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return (
      <div className="space-y-4 text-justify select-text font-serif leading-relaxed text-[#292524] text-[13px]">
        {paragraphs.map((para, idx) => (
          <p key={idx} className="leading-relaxed">
            {para}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div
      className="relative w-full h-full flex bg-[#FAF7F2] select-text overflow-hidden text-[#1C1917]"
      onMouseUp={handleMouseUp}
    >
      <TextSelectionToolbar
        position={selectionPos}
        selectedText={selectedText}
        onHighlight={(colorHex, note) => {
          createHighlight(colorHex, selectedText, undefined, undefined, note);
          window.getSelection()?.removeAllRanges();
          setSelectionPos(null);
        }}
        onBookmark={toggleBookmark}
        onClose={() => setSelectionPos(null)}
      />

      {/* Left Thumbnail & TOC Sidebar */}
      <aside className="w-64 border-r border-[#E5DFD3] bg-[#FAF7F2] flex flex-col z-20 flex-shrink-0 select-none">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#E5DFD3]">
          <h3 className="font-serif text-sm font-bold text-[#1C1917] truncate">
            {currentBook?.title || "Document"}
          </h3>
          <p className="text-[11px] text-[#78716C] truncate mt-0.5 font-serif">
            Page {currentPdfPage} of {totalPages}
          </p>
        </div>

        {/* 3 Tabs */}
        <div className="grid grid-cols-3 border-b border-[#E5DFD3] bg-[#EFEAE1]/60 text-xs font-medium">
          <button
            onClick={() => setSidebarTab("contents")}
            className={`py-2 px-1 flex flex-col items-center gap-1 transition-colors border-b-2 ${
              sidebarTab === "contents"
                ? "border-[#18181B] text-[#18181B] font-bold bg-[#FAF7F2]"
                : "border-transparent text-[#78716C] hover:text-[#18181B]"
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="text-[10px]">Contents</span>
          </button>
          <button
            onClick={() => setSidebarTab("thumbnails")}
            className={`py-2 px-1 flex flex-col items-center gap-1 transition-colors border-b-2 ${
              sidebarTab === "thumbnails"
                ? "border-[#18181B] text-[#18181B] font-bold bg-[#FAF7F2]"
                : "border-transparent text-[#78716C] hover:text-[#18181B]"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="text-[10px]">Thumbnails</span>
          </button>
          <button
            onClick={() => setSidebarTab("bookmarks")}
            className={`py-2 px-1 flex flex-col items-center gap-1 transition-colors border-b-2 ${
              sidebarTab === "bookmarks"
                ? "border-[#18181B] text-[#18181B] font-bold bg-[#FAF7F2]"
                : "border-transparent text-[#78716C] hover:text-[#18181B]"
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
                  className="p-2 rounded-lg hover:bg-[#EFEAE1] cursor-pointer text-xs font-serif text-[#292524] truncate"
                >
                  {item.title}
                </div>
              ))
            ) : (
              <div className="text-xs text-[#78716C] text-center py-6">No table of contents</div>
            )
          ) : sidebarTab === "bookmarks" ? (
            bookmarks.length > 0 ? (
              bookmarks.map((bmk) => (
                <div
                  key={bmk.id}
                  onClick={() => {
                    if (bmk.page_number) loadPdfPage(bmk.page_number);
                  }}
                  className="p-2 rounded-lg hover:bg-[#EFEAE1] cursor-pointer text-xs font-serif text-[#292524] truncate"
                >
                  {bmk.title || `Page ${bmk.page_number || 1}`}
                </div>
              ))
            ) : (
              <div className="text-xs text-[#78716C] text-center py-6">No bookmarks yet</div>
            )
          ) : (
            Array.from({ length: Math.min(totalPages, 50) }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                onClick={() => loadPdfPage(pageNum)}
                className="space-y-1 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] text-[#78716C] px-1 font-mono">
                  <span>Page {pageNum}</span>
                </div>
                <div
                  className={`w-full aspect-[4/3] rounded-lg bg-white border p-2 flex items-center justify-center transition-all shadow-xs ${
                    pageNum === currentPdfPage || pageNum === leftPageNum || (isDualSpread && pageNum === rightPageNum)
                      ? "border-teal-700 ring-2 ring-teal-600/30"
                      : "border-[#E5DFD3] group-hover:border-[#DDD5C7]"
                  }`}
                >
                  <div className="w-full h-full border border-dashed border-[#E5DFD3] rounded flex items-center justify-center p-2 text-center">
                    <span className="font-serif text-[9px] text-[#78716C]">
                      Page {pageNum}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Reading Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Floating Top Controls Header */}
        <div className="h-12 border-b border-[#E5DFD3] bg-[#FAF7F2] px-6 flex items-center justify-between z-10 select-none">
          <div className="flex items-center gap-3">
            <button
              disabled={leftPageNum <= 1}
              onClick={() => loadPdfPage(Math.max(1, isDualSpread ? leftPageNum - 2 : currentPdfPage - 1))}
              className="p-1 hover:text-[#18181B] text-[#78716C] rounded hover:bg-[#EFEAE1] disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-semibold text-[#1C1917]">
              {isDualSpread ? `${leftPageNum}-${rightPageNum} / ${totalPages}` : `${currentPdfPage} / ${totalPages}`}
            </span>
            <button
              disabled={isDualSpread ? rightPageNum >= totalPages : currentPdfPage >= totalPages}
              onClick={() => loadPdfPage(Math.min(totalPages, isDualSpread ? leftPageNum + 2 : currentPdfPage + 1))}
              className="p-1 hover:text-[#18181B] text-[#78716C] rounded hover:bg-[#EFEAE1] disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#78716C]">
            <button
              onClick={() => setZoom((z) => Math.max(60, z - 10))}
              className="p-1 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-[#1C1917]">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(180, z + 10))}
              className="p-1 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-[#E5DFD3] mx-1" />
            <button
              onClick={() => setIsDualSpread(!isDualSpread)}
              className={`p-1.5 rounded-md transition-colors ${
                isDualSpread ? "bg-[#E4DED3] text-[#18181B]" : "hover:bg-[#EFEAE1]"
              }`}
              title="Toggle Dual Spread Mode"
            >
              <Layout className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dual / Single Page Spread Viewport */}
        <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
          <div
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            className="flex gap-6 items-start transition-transform duration-150"
          >
            {/* Left Page */}
            <div className="w-[440px] min-h-[600px] bg-white border border-[#E5DFD3] rounded-sm p-10 shadow-lg flex flex-col justify-between text-xs leading-relaxed text-[#292524]">
              <div className="flex-1">
                {renderPageBody(leftPdfPageData?.text_content, leftPageNum)}
              </div>

              <div className="text-center font-mono text-[10px] text-[#78716C] pt-4 border-t border-[#F2ECE2] mt-6">
                {leftPageNum}
              </div>
            </div>

            {/* Right Page (Only in Dual Spread Mode) */}
            {isDualSpread && rightPageNum <= totalPages && (
              <div className="w-[440px] min-h-[600px] bg-white border border-[#E5DFD3] rounded-sm p-10 shadow-lg flex flex-col justify-between text-xs leading-relaxed text-[#292524]">
                <div className="flex-1">
                  {renderPageBody(rightPdfPageData?.text_content, rightPageNum)}
                </div>

                <div className="text-center font-mono text-[10px] text-[#78716C] pt-4 border-t border-[#F2ECE2] mt-6">
                  {rightPageNum}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
