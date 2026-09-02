import React from "react";
import { BookOpen } from "lucide-react";
import { useReaderStore } from "../../state/readerState";

export const EInkReaderView: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const currentSpineIndex = useReaderStore((s) => s.currentSpineIndex);
  const currentPdfPage = useReaderStore((s) => s.currentPdfPage);
  const leftPdfPageData = useReaderStore((s) => s.leftPdfPageData);
  const documentData = useReaderStore((s) => s.documentData);
  const loadChapter = useReaderStore((s) => s.loadChapter);
  const loadPdfPage = useReaderStore((s) => s.loadPdfPage);
  const closeReader = useReaderStore((s) => s.closeReader);
  const toggleTypography = useReaderStore((s) => s.toggleTypography);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);
  const setSidebarTab = useReaderStore((s) => s.setSidebarTab);
  const sidebarTab = useReaderStore((s) => s.sidebarTab);

  const isPdf = documentData?.file.format === "pdf";
  const total = documentData?.total_pages_or_spines || 1;
  const currentPos = isPdf ? currentPdfPage : currentSpineIndex + 1;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentPos / total) * 100)));

  return (
    <div className="w-full h-full bg-[#FFFFFF] text-[#000000] flex flex-col justify-between p-6 select-text font-serif">
      {/* Top Header Bar */}
      <header className="border-b-2 border-black pb-3 flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={closeReader}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            ← Library
          </button>
          <span className="font-serif text-sm font-black tracking-widest uppercase truncate max-w-xs sm:max-w-md">
            {currentBook?.title || "LUMA READER"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarTab(sidebarTab === "toc" ? null : "toc")}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            TOC
          </button>
          <button
            onClick={toggleTypography}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            Tune
          </button>
          <button
            onClick={toggleBookmark}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            Bookmark
          </button>
        </div>
      </header>

      {/* Main E-Ink Reading Canvas */}
      <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full py-8 space-y-6">
        {/* Title Block */}
        <div className="text-center space-y-2 pb-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-widest uppercase text-black font-serif">
            {currentChapter?.title || currentBook?.title || "Document"}
          </h1>
          <div className="inline-block bg-black text-white px-3 py-1 text-[11px] font-bold font-mono uppercase tracking-widest mt-1">
            {isPdf ? `PAGE ${currentPdfPage} OF ${total}` : `SECTION ${currentSpineIndex + 1} OF ${total}`}
          </div>
        </div>

        <div className="border-b-2 border-black w-full" />

        {/* High-Contrast Body */}
        <div className="space-y-4 text-sm leading-relaxed text-black prose-reader text-justify">
          {isPdf ? (
            leftPdfPageData?.text_content ? (
              <div className="whitespace-pre-wrap font-serif leading-loose">
                {leftPdfPageData.text_content}
              </div>
            ) : (
              <div className="text-center py-12 font-mono text-xs">
                Page {currentPdfPage} loaded.
              </div>
            )
          ) : currentChapter?.html_content ? (
            <div
              dangerouslySetInnerHTML={{ __html: currentChapter.html_content }}
              className="leading-relaxed"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <BookOpen className="w-8 h-8 text-black mb-2 animate-pulse" />
              <p className="font-mono text-xs">Loading reading content...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom E-Ink Status Bar */}
      <footer className="border-t-2 border-black pt-3 flex items-center justify-between font-mono text-xs font-bold text-black flex-shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            disabled={currentPos <= 1}
            onClick={() => {
              if (isPdf) {
                if (currentPdfPage > 1) loadPdfPage(currentPdfPage - 1);
              } else {
                if (currentSpineIndex > 0) loadChapter(currentSpineIndex - 1);
              }
            }}
            className="border border-black px-2 py-0.5 text-[11px] disabled:opacity-30 hover:bg-black hover:text-white"
          >
            [Prev]
          </button>
          <span>{isPdf ? `PAGE ${currentPdfPage} / ${total}` : `SPINE ${currentSpineIndex + 1} / ${total}`}</span>
          <button
            disabled={currentPos >= total}
            onClick={() => {
              if (isPdf) {
                if (currentPdfPage < total) loadPdfPage(currentPdfPage + 1);
              } else {
                if (currentSpineIndex < total - 1) loadChapter(currentSpineIndex + 1);
              }
            }}
            className="border border-black px-2 py-0.5 text-[11px] disabled:opacity-30 hover:bg-black hover:text-white"
          >
            [Next]
          </button>
        </div>

        {/* Progress Line */}
        <div className="w-40 sm:w-48 h-2.5 border border-black p-0.5 hidden sm:block">
          <div className="h-full bg-black transition-all" style={{ width: `${progressPercent}%` }} />
        </div>

        <span>{progressPercent}% READ</span>
      </footer>
    </div>
  );
};
