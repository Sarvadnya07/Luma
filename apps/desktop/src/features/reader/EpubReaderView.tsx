import React, { useEffect, useRef, useState, useCallback } from "react";
import { BookOpen } from "lucide-react";
import { Annotation } from "@luma/shared-types";
import { useReaderStore } from "../../state/readerState";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

interface TextNodeSpan {
  node: Text;
  start: number;
  end: number;
}

/**
 * Cross-Node Range Highlighter:
 * Accurately highlights text across multiple nested DOM elements, tags, and paragraphs
 * without corrupting the DOM structure or destroying publisher elements.
 */
function applyDomHighlights(
  container: HTMLElement,
  annotations: Annotation[],
  currentSpine: number,
  searchQuery?: string
) {
  // 1. Remove previous highlights cleanly and join split text nodes
  const previousMarks = container.querySelectorAll("mark.luma-highlight, mark.luma-search-hit");
  previousMarks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
  });

  // 2. Build linear text index across all text nodes in reading order
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest("script, style, noscript")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let fullText = "";
  const nodeSpans: TextNodeSpan[] = [];
  let n: Node | null;

  while ((n = walker.nextNode())) {
    const textNode = n as Text;
    const len = textNode.nodeValue?.length || 0;
    if (len > 0) {
      const start = fullText.length;
      fullText += textNode.nodeValue;
      nodeSpans.push({ node: textNode, start, end: start + len });
    }
  }

  if (nodeSpans.length === 0 || fullText.length === 0) return;

  const fullTextLower = fullText.toLowerCase();

  // Helper function to wrap character range [matchStart, matchEnd] across all intersecting text nodes
  const wrapTextRange = (
    matchStart: number,
    matchEnd: number,
    className: string,
    color: string,
    annotationId: string | null
  ) => {
    // Collect all intersecting nodes and their sub-ranges
    const intersections: Array<{ node: Text; startOffset: number; endOffset: number }> = [];

    for (const span of nodeSpans) {
      if (span.end > matchStart && span.start < matchEnd) {
        const localStart = Math.max(0, matchStart - span.start);
        const localEnd = Math.min(span.node.nodeValue?.length || 0, matchEnd - span.start);
        if (localEnd > localStart) {
          intersections.push({ node: span.node, startOffset: localStart, endOffset: localEnd });
        }
      }
    }

    // Wrap each intersecting text node segment in reverse order to preserve offsets
    for (let i = intersections.length - 1; i >= 0; i--) {
      const item = intersections[i];
      if (!item) continue;
      const { node, startOffset, endOffset } = item;
      try {
        const range = document.createRange();
        range.setStart(node, startOffset);
        range.setEnd(node, endOffset);

        const mark = document.createElement("mark");
        mark.className = className;
        mark.style.backgroundColor = `${color}55`;
        mark.style.borderBottom = `2px solid ${color}`;
        mark.style.color = "inherit";
        if (annotationId) {
          mark.setAttribute("data-annotation-id", annotationId);
        }

        mark.appendChild(range.extractContents());
        range.insertNode(mark);
      } catch {
        // skip if range extraction fails
      }
    }
  };

  // 3. Highlight Search Matches (amber)
  if (searchQuery && searchQuery.trim().length > 1) {
    const qLower = searchQuery.trim().toLowerCase();
    let searchStart = 0;
    let hitIdx: number;
    let matchCount = 0;

    while ((hitIdx = fullTextLower.indexOf(qLower, searchStart)) !== -1) {
      const hitEnd = hitIdx + qLower.length;
      searchStart = hitEnd;
      wrapTextRange(hitIdx, hitEnd, "luma-search-hit", "#f59e0b", `search-${matchCount}`);
      matchCount++;
    }
  }

  // 4. Highlight Persistent User Annotations
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

  for (const ann of relevantAnns) {
    const quoteLower = ann.quote.trim().toLowerCase();
    const color = ann.color_hex || "#fef08a";
    let searchStart = 0;
    let matchIdx: number;

    while ((matchIdx = fullTextLower.indexOf(quoteLower, searchStart)) !== -1) {
      const matchEnd = matchIdx + quoteLower.length;
      searchStart = matchEnd;
      wrapTextRange(matchIdx, matchEnd, "luma-highlight", color, ann.id);
    }
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
      if (loc.startsWith("p") || loc.startsWith("heading-") || loc.startsWith("search-")) {
        targetEl =
          containerRef.current.querySelector(`[data-annotation-id="${loc}"]`) ||
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

  // Text selection listener with multi-node DOM context extraction
  const handleMouseUp = useCallback(() => {
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
  }, [currentChapter]);

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

  const selectedFont = fontFamilies[settings.fontFamily] || fontFamilies.serif;

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
            fontFamily: selectedFont,
            // @ts-expect-error CSS variable
            "--reader-font-family": selectedFont,
            "--reader-font-size": `${settings.fontSize || 16}px`,
            "--reader-line-height": `${settings.lineHeight || 1.8}`,
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
