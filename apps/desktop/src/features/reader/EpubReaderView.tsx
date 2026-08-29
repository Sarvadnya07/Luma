import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { useReaderStore } from "../../state/readerState";
import { READER_THEME_STYLES } from "@luma/reader-ui";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

export const EpubReaderView: React.FC = () => {
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const currentSpineIndex = useReaderStore((s) => s.currentSpineIndex);
  const documentData = useReaderStore((s) => s.documentData);
  const settings = useReaderStore((s) => s.settings);
  const loadChapter = useReaderStore((s) => s.loadChapter);
  const createHighlight = useReaderStore((s) => s.createHighlight);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [prefixContext, setPrefixContext] = useState<string>("");
  const [suffixContext, setSuffixContext] = useState<string>("");
  const [footnotePopover, setFootnotePopover] = useState<{ text: string; x: number; y: number } | null>(null);

  const totalSpines = documentData?.total_pages_or_spines || 1;
  const themeStyles = READER_THEME_STYLES[settings.theme];

  // Text selection listener
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionPos(null);
      setSelectedText("");
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setSelectionPos(null);
      setSelectedText("");
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Compute prefix & suffix context from chapter text
    if (currentChapter) {
      const fullText = currentChapter.text_content;
      const idx = fullText.indexOf(text);
      if (idx !== -1) {
        setPrefixContext(fullText.substring(Math.max(0, idx - 40), idx).trim());
        setSuffixContext(fullText.substring(idx + text.length, Math.min(fullText.length, idx + text.length + 40)).trim());
      }
    }

    setSelectedText(text);
    setSelectionPos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  };

  // Footnote click listener
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (link && link.hash) {
      e.preventDefault();
      const targetEl = containerRef.current?.querySelector(link.hash);
      if (targetEl) {
        setFootnotePopover({
          text: targetEl.textContent || "Footnote content",
          x: e.clientX,
          y: e.clientY - 40,
        });
      }
    } else {
      setFootnotePopover(null);
    }
  };

  // Scroll to top on chapter change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [currentSpineIndex]);

  const fontFamilies = {
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center overflow-hidden select-text ${themeStyles.bg}`}
      onMouseUp={handleMouseUp}
      onClick={handleContentClick}
    >
      {/* Floating Selection Toolbar */}
      <TextSelectionToolbar
        position={selectionPos}
        selectedText={selectedText}
        onHighlight={(colorHex, note) => {
          createHighlight(colorHex, selectedText, prefixContext, suffixContext, note);
          window.getSelection()?.removeAllRanges();
          setSelectionPos(null);
        }}
        onBookmark={toggleBookmark}
        onClose={() => setSelectionPos(null)}
      />

      {/* Footnote Popover */}
      {footnotePopover && (
        <div
          style={{ top: `${footnotePopover.y}px`, left: `${footnotePopover.x}px` }}
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl max-w-sm text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="font-semibold text-sky-400 mb-1">Footnote Reference</div>
          <p className="line-clamp-4">{footnotePopover.text}</p>
        </div>
      )}

      {/* Main Reading Container */}
      <div
        ref={containerRef}
        className="w-full flex-1 overflow-y-auto px-6 py-10 flex justify-center scroll-smooth"
      >
        <div
          className="w-full max-w-2xl transition-all duration-150 leading-relaxed"
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            fontFamily: fontFamilies[settings.fontFamily],
            color: settings.theme === "dark" ? "#e2e8f0" : settings.theme === "sepia" ? "#5f4b32" : settings.theme === "eink" ? "#000000" : "#0f172a",
          }}
        >
          {currentChapter ? (
            <div
              className="prose-reader space-y-4"
              dangerouslySetInnerHTML={{ __html: currentChapter.html_content }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <BookOpen className="w-12 h-12 mb-3 animate-pulse text-sky-400" />
              <p className="text-sm">Loading document chapter...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Reading Navigation Bar */}
      <div className={`w-full border-t ${themeStyles.border} px-8 py-3 flex items-center justify-between z-20 backdrop-blur-md`}>
        <button
          disabled={currentSpineIndex === 0}
          onClick={() => loadChapter(currentSpineIndex - 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous Chapter
        </button>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-medium text-slate-400 truncate max-w-xs">
            {currentChapter?.title || "Document Reading"}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span>
              {currentSpineIndex + 1} / {totalSpines}
            </span>
            <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${((currentSpineIndex + 1) / totalSpines) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <button
          disabled={currentSpineIndex >= totalSpines - 1}
          onClick={() => loadChapter(currentSpineIndex + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          Next Chapter
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
