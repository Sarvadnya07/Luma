import React, { useEffect, useRef, useState, useMemo } from "react";
import { BookOpen } from "lucide-react";
import { useReaderStore } from "../../state/readerState";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

export const EpubReaderView: React.FC = () => {
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const annotations = useReaderStore((s) => s.annotations);
  const currentSpineIndex = useReaderStore((s) => s.currentSpineIndex);
  const documentData = useReaderStore((s) => s.documentData);
  const settings = useReaderStore((s) => s.settings);
  const createHighlight = useReaderStore((s) => s.createHighlight);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [prefixContext, setPrefixContext] = useState<string>("");
  const [suffixContext, setSuffixContext] = useState<string>("");
  const [footnotePopover, setFootnotePopover] = useState<{ text: string; x: number; y: number } | null>(null);

  const totalSpines = documentData?.total_pages_or_spines || 1;

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
    serif: 'Lora, "Playfair Display", Georgia, "Times New Roman", serif',
    sans: '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((currentSpineIndex + 1) / totalSpines) * 100))
  );

  const getChapterProgressLabel = () => {
    return currentChapter?.title || `Section ${currentSpineIndex + 1} of ${totalSpines}`;
  };

  const highlightedHtml = useMemo(() => {
    if (!currentChapter?.html_content) return "";
    let html = currentChapter.html_content;
    if (!annotations || annotations.length === 0) return html;

    const relevant = annotations.filter((ann) => {
      if (!ann.quote || ann.quote.trim().length === 0) return false;
      try {
        const payload = JSON.parse(ann.anchor_payload_json);
        if (payload.spine_index !== undefined) {
          return payload.spine_index === currentSpineIndex;
        }
      } catch {
        // payload fallback
      }
      return currentChapter.text_content?.includes(ann.quote);
    });

    for (const ann of relevant) {
      if (!ann.quote || ann.quote.trim().length === 0) continue;
      const color = ann.color_hex || "#fef08a";
      const regex = new RegExp(`(${ann.quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "g");
      html = html.replace(
        regex,
        `<mark class="luma-highlight" style="background-color: ${color}55; border-bottom: 2px solid ${color}; border-radius: 2px; padding: 0 2px; color: inherit;" data-annotation-id="${ann.id}">$1</mark>`
      );
    }

    return html;
  }, [currentChapter, annotations, currentSpineIndex]);

  const defaultTheme = { bg: "bg-[#FAF7F2]", text: "text-[#1C1917]", prose: "text-[#292524]" };
  const themeStyles: Record<string, { bg: string; text: string; prose: string }> = {
    light: defaultTheme,
    sepia: { bg: "bg-[#F5EFE6]", text: "text-[#3D3028]", prose: "text-[#3D3028]" },
    paper: { bg: "bg-[#EAEFEF]", text: "text-[#1F2937]", prose: "text-[#1F2937]" },
    dark: { bg: "bg-[#18181B]", text: "text-[#F5F1EA]", prose: "text-[#E4DED3]" },
    eink: { bg: "bg-[#FFFFFF]", text: "text-[#000000]", prose: "text-[#000000]" },
  };
  const currentTheme = themeStyles[settings.theme] ?? defaultTheme;
  const maxWidthClass =
    settings.marginHorizontal === 64
      ? "max-w-xl"
      : settings.marginHorizontal === 16
      ? "max-w-4xl"
      : "max-w-2xl";

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center overflow-hidden select-text ${currentTheme.bg} ${currentTheme.text}`}
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
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 bg-[#18181B] text-white rounded-xl p-3 shadow-2xl max-w-sm text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="font-semibold text-amber-300 mb-1">Footnote Reference</div>
          <p className="line-clamp-4 text-stone-200">{footnotePopover.text}</p>
        </div>
      )}

      {/* Main Reading Container */}
      <div
        ref={containerRef}
        className="w-full flex-1 overflow-y-auto px-8 py-12 flex justify-center scroll-smooth"
      >
        <div
          className={`w-full ${maxWidthClass} transition-all duration-150 leading-relaxed font-book ${currentTheme.prose}`}
          style={{
            fontSize: `${settings.fontSize || 16}px`,
            lineHeight: settings.lineHeight || 1.8,
            fontFamily: fontFamilies[settings.fontFamily] || fontFamilies.serif,
          }}
        >
          {currentChapter ? (
            <div
              className="prose-reader text-justify"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-[#78716C]">
              <BookOpen className="w-10 h-10 mb-3 animate-pulse text-[#8C8275]" />
              <p className="text-xs">Loading chapter...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Reading Progress Footer matching Screen 3 & Screen 5 */}
      <footer className="w-full h-10 border-t border-[#E5DFD3] bg-[#FAF7F2] px-8 flex items-center justify-between z-20 select-none flex-shrink-0">
        <span className="text-[11px] font-medium text-[#78716C]">
          {getChapterProgressLabel()}
        </span>

        {/* Center Thin Progress Bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="w-full h-[2px] bg-[#E5DFD3] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#18181B] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <span className="text-[11px] font-mono text-[#78716C]">
          {progressPercent}%
        </span>
      </footer>
    </div>
  );
};

