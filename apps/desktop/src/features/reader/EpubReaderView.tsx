import React, { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { Annotation } from "@luma/shared-types";
import { useReaderStore } from "../../state/readerState";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

function highlightInTextNodes(
  container: HTMLElement,
  searchText: string,
  className: string,
  color: string,
  annotationId: string | null
) {
  if (!searchText || searchText.length === 0) return;
  const targetLower = searchText.toLowerCase();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest("mark.luma-highlight, script, style")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    textNodes.push(n as Text);
  }

  for (const textNode of textNodes) {
    const val = textNode.nodeValue;
    if (!val) continue;

    const valLower = val.toLowerCase();
    const idx = valLower.indexOf(targetLower);
    if (idx !== -1) {
      try {
        const matchNode = textNode.splitText(idx);
        matchNode.splitText(targetLower.length);

        const mark = document.createElement("mark");
        mark.className = className;
        mark.style.backgroundColor = `${color}55`;
        mark.style.borderBottom = `2px solid ${color}`;
        mark.style.borderRadius = "2px";
        mark.style.padding = "0 2px";
        mark.style.color = "inherit";
        if (annotationId) {
          mark.setAttribute("data-annotation-id", annotationId);
        }
        mark.textContent = matchNode.nodeValue;

        matchNode.parentNode?.replaceChild(mark, matchNode);
        break;
      } catch {
        // skip if DOM split error occurs
      }
    }
  }
}

function applyDomHighlights(
  container: HTMLElement,
  annotations: Annotation[],
  currentSpine: number,
  searchQuery?: string
) {
  // 1. Remove previous marks cleanly without destroying text
  const previousMarks = container.querySelectorAll("mark.luma-highlight, mark.luma-search-highlight");
  previousMarks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
  });

  // 2. Filter relevant annotations for this chapter/spine
  const relevantAnns = annotations.filter((ann) => {
    if (!ann.quote || !ann.quote.trim()) return false;
    try {
      const p = JSON.parse(ann.anchor_payload_json);
      if (p.spine_index !== undefined) {
        return p.spine_index === currentSpine;
      }
    } catch {
      // payload fallback
    }
    return true;
  });

  // 3. Highlight Search Matches if present
  if (searchQuery && searchQuery.trim().length > 1) {
    highlightInTextNodes(container, searchQuery.trim(), "luma-search-highlight", "#f59e0b", null);
  }

  // 4. Highlight User Annotations
  for (const ann of relevantAnns) {
    const color = ann.color_hex || "#fef08a";
    highlightInTextNodes(container, ann.quote.trim(), "luma-highlight", color, ann.id);
  }
}

export const EpubReaderView: React.FC = () => {
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const annotations = useReaderStore((s) => s.annotations);
  const currentSpineIndex = useReaderStore((s) => s.currentSpineIndex);
  const documentData = useReaderStore((s) => s.documentData);
  const settings = useReaderStore((s) => s.settings);
  const searchQuery = useReaderStore((s) => s.searchQuery);
  const createHighlight = useReaderStore((s) => s.createHighlight);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [prefixContext, setPrefixContext] = useState<string>("");
  const [suffixContext, setSuffixContext] = useState<string>("");
  const [footnotePopover, setFootnotePopover] = useState<{ text: string; x: number; y: number } | null>(null);

  const totalSpines = documentData?.total_pages_or_spines || 1;

  // Re-apply DOM highlights whenever content, annotations, spine index, or search query changes
  useEffect(() => {
    if (contentRef.current && currentChapter?.html_content) {
      applyDomHighlights(contentRef.current, annotations, currentSpineIndex, searchQuery);
    }
  }, [currentChapter, annotations, currentSpineIndex, searchQuery]);

  // Listen for scroll-to events (TOC jumps, search match jumps, bookmark jumps)
  useEffect(() => {
    const handleScrollTo = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.locator || !containerRef.current) return;
      const loc = detail.locator;

      let targetEl: Element | null = null;
      if (loc.startsWith("p") || loc.startsWith("heading-")) {
        targetEl =
          containerRef.current.querySelector(`#${loc}`) ||
          containerRef.current.querySelector(`[data-node-id="${loc}"]`);
      } else if (loc.startsWith("#")) {
        targetEl = containerRef.current.querySelector(loc);
      }

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    window.addEventListener("luma-reader-scroll-to", handleScrollTo);
    return () => window.removeEventListener("luma-reader-scroll-to", handleScrollTo);
  }, []);

  // Text selection listener with DOM context extraction
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

    // Extract accurate preceding and following context from DOM
    let prefix = "";
    let suffix = "";
    try {
      const parentBlock =
        range.startContainer.parentElement?.closest("p, div, section, h1, h2, h3, h4, h5, h6") ||
        contentRef.current;

      if (parentBlock) {
        const preRange = document.createRange();
        preRange.setStart(parentBlock, 0);
        preRange.setEnd(range.startContainer, range.startOffset);
        prefix = preRange.toString().slice(-40).trim();

        const postRange = document.createRange();
        postRange.setStart(range.endContainer, range.endOffset);
        postRange.setEnd(parentBlock, parentBlock.childNodes.length);
        suffix = postRange.toString().slice(0, 40).trim();
      }
    } catch {
      if (currentChapter?.text_content) {
        const fullText = currentChapter.text_content;
        const idx = fullText.indexOf(text);
        if (idx !== -1) {
          prefix = fullText.substring(Math.max(0, idx - 40), idx).trim();
          suffix = fullText
            .substring(idx + text.length, Math.min(fullText.length, idx + text.length + 40))
            .trim();
        }
      }
    }

    setPrefixContext(prefix);
    setSuffixContext(suffix);
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
        targetEl.scrollIntoView({ behavior: "smooth" });
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

      {/* Footnote Reference Popover */}
      {footnotePopover && (
        <div
          style={{ top: `${footnotePopover.y}px`, left: `${footnotePopover.x}px` }}
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 bg-[#18181B] text-white rounded-xl p-3 shadow-2xl max-w-sm text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="font-semibold text-amber-300 mb-1">Footnote Reference</div>
          <p className="line-clamp-4 text-stone-200">{footnotePopover.text}</p>
        </div>
      )}

      {/* Main Reading Viewport */}
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
              ref={contentRef}
              className="prose-reader text-justify"
              dangerouslySetInnerHTML={{ __html: currentChapter.html_content }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-[#78716C]">
              <BookOpen className="w-10 h-10 mb-3 animate-pulse text-[#8C8275]" />
              <p className="text-xs">Loading reading content...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Progress Bar Footer */}
      <footer className="w-full h-10 border-t border-[#E5DFD3] bg-[#FAF7F2] px-8 flex items-center justify-between z-20 select-none flex-shrink-0">
        <span className="text-[11px] font-medium text-[#78716C]">
          {getChapterProgressLabel()}
        </span>

        {/* Center Progress Rail */}
        <div className="flex-1 max-w-md mx-8">
          <div className="w-full h-[2px] bg-[#E5DFD3] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#18181B] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <span className="text-[11px] font-mono text-[#78716C]">{progressPercent}%</span>
      </footer>
    </div>
  );
};
