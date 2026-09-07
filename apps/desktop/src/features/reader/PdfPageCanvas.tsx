import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import { Loader2, BookOpen, FileText } from "lucide-react";
import { Annotation } from "@luma/shared-types";
import { perfTelemetry } from "../../lib/perfTelemetry";
import { findBestMatch, normalizeString } from "./highlightEngine";

interface PdfPageCanvasProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNum: number;
  zoom?: number;
  isThumbnail?: boolean;
  className?: string;
  fallbackText?: string | null;
  hasTextLayer?: boolean;
  targetWidth?: number;
  onPageLoaded?: (hasText: boolean) => void;
  annotations?: Annotation[];
  searchQuery?: string;
}

interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  id: string;
  isSearch?: boolean;
}

export const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNum,
  zoom = 100,
  isThumbnail = false,
  className = "",
  fallbackText,
  hasTextLayer,
  targetWidth,
  onPageLoaded,
  annotations,
  searchQuery,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const [renderState, setRenderState] = useState<"loading" | "rendered" | "error">("loading");
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number; scale: number }>({
    width: isThumbnail ? 160 : (targetWidth || 480),
    height: isThumbnail ? 220 : 640,
    scale: 1.0,
  });
  const [isScannedOnly, setIsScannedOnly] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(!isThumbnail);
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);

  // Filter annotations belonging specifically to this page
  const pageAnnotations = useMemo(() => {
    if (!annotations || isThumbnail) return [];
    return annotations.filter((ann) => {
      try {
        const p = JSON.parse(ann.anchor_payload_json);
        if (p.page_number !== undefined) {
          return p.page_number === pageNum;
        }
      } catch {
        // payload fallback
      }
      return false;
    });
  }, [annotations, pageNum, isThumbnail]);

  // Compute exact highlight and search bounding boxes directly from rendered TextLayer spans
  const computeOverlays = useCallback(() => {
    const layer = textLayerRef.current;
    if (!layer || renderState !== "rendered") {
      setHighlightRects([]);
      return;
    }

    const spans = Array.from(layer.querySelectorAll("span"));
    if (!spans.length) {
      setHighlightRects([]);
      return;
    }

    // Build contiguous text string and span offsets without space pollution
    let rawText = "";
    const spanMap: Array<{ span: HTMLSpanElement; rawStart: number; rawEnd: number }> = [];

    for (const span of spans) {
      const str = span.textContent || "";
      if (!str) continue;

      if (rawText.length > 0 && spanMap.length > 0) {
        const prev = spanMap[spanMap.length - 1]!;
        const prevText = prev.span.textContent || "";
        const endsWithSpace = /\s$/.test(prevText);
        const startsWithSpace = /^\s/.test(str);

        if (!endsWithSpace && !startsWithSpace) {
          const lineDiff = Math.abs(span.offsetTop - prev.span.offsetTop);
          const horizGap = span.offsetLeft - (prev.span.offsetLeft + prev.span.offsetWidth);
          if (lineDiff > 4 || horizGap > 2) {
            rawText += " ";
          }
        }
      }

      const rawStart = rawText.length;
      rawText += str;
      const rawEnd = rawStart + str.length;
      spanMap.push({ span, rawStart, rawEnd });
    }

    if (!rawText.length) {
      setHighlightRects([]);
      return;
    }

    // Normalized text with bidirectional character offsets
    let normalizedText = "";
    const normToRawStart: number[] = [];
    const normToRawEnd: number[] = [];
    let i = 0;
    while (i < rawText.length) {
      const ch = rawText[i]!;
      if (/\s/.test(ch)) {
        const spaceStart = i;
        while (i < rawText.length && /\s/.test(rawText[i]!)) {
          i++;
        }
        normalizedText += " ";
        normToRawStart.push(spaceStart);
        normToRawEnd.push(i);
      } else {
        normalizedText += ch;
        normToRawStart.push(i);
        normToRawEnd.push(i + 1);
        i++;
      }
    }

    const normLower = normalizedText.toLowerCase();
    const rects: HighlightRect[] = [];
    const layerRect = layer.getBoundingClientRect();

    // Helper: compute bounding box for [rawStart, rawEnd) across intersecting spans
    const addRectsForRange = (
      rawMatchStart: number,
      rawMatchEnd: number,
      color: string,
      id: string,
      isSearch: boolean
    ) => {
      for (const item of spanMap) {
        if (item.rawEnd > rawMatchStart && item.rawStart < rawMatchEnd) {
          const localStart = Math.max(0, rawMatchStart - item.rawStart);
          const localEnd = Math.min(item.span.textContent?.length || 0, rawMatchEnd - item.rawStart);
          if (localEnd <= localStart) continue;

          let added = false;
          try {
            const range = document.createRange();
            const textNode = item.span.firstChild || item.span;
            range.setStart(textNode, localStart);
            range.setEnd(textNode, localEnd);
            const r = range.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && layerRect.width > 0) {
              rects.push({
                left: Math.round(r.left - layerRect.left),
                top: Math.round(r.top - layerRect.top),
                width: Math.round(r.width),
                height: Math.round(r.height),
                color,
                id,
                isSearch,
              });
              added = true;
            }
          } catch {
            // fallback
          }

          if (!added) {
            const spanLen = item.span.textContent?.length || 1;
            const charWidth = (item.span.offsetWidth || 100) / spanLen;
            rects.push({
              left: Math.round(item.span.offsetLeft + localStart * charWidth),
              top: item.span.offsetTop,
              width: Math.round((localEnd - localStart) * charWidth),
              height: item.span.offsetHeight || 16,
              color,
              id,
              isSearch,
            });
          }
        }
      }
    };

    // 1. In-document search highlights (amber)
    if (searchQuery && searchQuery.trim().length > 1) {
      const qNorm = normalizeString(searchQuery).toLowerCase();
      let searchPos = 0;
      let hitCount = 0;

      while ((searchPos = normLower.indexOf(qNorm, searchPos)) !== -1) {
        const normStart = searchPos;
        const normEnd = searchPos + qNorm.length;
        searchPos = normEnd;

        const rawStart = normToRawStart[normStart];
        const rawEnd = normToRawEnd[normEnd - 1];

        if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
          addRectsForRange(rawStart, rawEnd, "#f59e0b", `search-${hitCount}`, true);
          hitCount++;
        }
      }
    }

    // 2. User persistent annotations
    for (const ann of pageAnnotations) {
      if (!ann.quote || !ann.quote.trim()) continue;
      const normQuote = normalizeString(ann.quote);
      if (!normQuote) continue;

      let prefix: string | null = null;
      let suffix: string | null = null;
      try {
        const p = JSON.parse(ann.anchor_payload_json);
        prefix = p.prefix || null;
        suffix = p.suffix || null;
      } catch {
        // fallback
      }

      const match = findBestMatch(normalizedText, normQuote, prefix, suffix);
      if (match) {
        const rawStart = normToRawStart[match.start];
        const rawEnd = normToRawEnd[match.end - 1];

        if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
          addRectsForRange(rawStart, rawEnd, ann.color_hex || "#fef08a", ann.id, false);
        }
      }
    }

    setHighlightRects(rects);
  }, [pageAnnotations, searchQuery, renderState]);

  useEffect(() => {
    computeOverlays();
  }, [computeOverlays]);

  // Thumbnail Intersection Observer
  useEffect(() => {
    if (!isThumbnail || !containerRef.current) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isThumbnail]);

  // Main PDF Render Task (Canvas + Official TextLayer)
  useEffect(() => {
    let isCancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let textLayerTask: TextLayer | null = null;

    async function renderPage() {
      if (!isVisible || !pdfDoc || pageNum < 1 || pageNum > pdfDoc.numPages) {
        return;
      }

      try {
        setRenderState("loading");
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        // Retrieve text content to check for scanned document
        const textContent = await page.getTextContent();
        const hasText = textContent.items.length > 0 || hasTextLayer === true;
        setIsScannedOnly(!hasText);
        onPageLoaded?.(hasText);

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const dpr = window.devicePixelRatio || 1;

        let baseTargetWidth = targetWidth || 480;
        if (isThumbnail) {
          baseTargetWidth = 180;
        }

        const baseScale = baseTargetWidth / unscaledViewport.width;
        const effectiveZoom = isThumbnail ? 1.0 : zoom / 100;
        const finalScale = baseScale * effectiveZoom;

        // Viewport at logical display scale
        const viewport = page.getViewport({ scale: finalScale });
        const logicalWidth = Math.floor(viewport.width);
        const logicalHeight = Math.floor(viewport.height);

        setPageDimensions({ width: logicalWidth, height: logicalHeight, scale: finalScale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        // High-DPI buffer scaling
        canvas.width = Math.floor(logicalWidth * dpr);
        canvas.height = Math.floor(logicalHeight * dpr);
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;

        renderTask = page.render({
          canvas: canvas,
          canvasContext: ctx,
          transform: transform,
          viewport: viewport,
        } as unknown as Parameters<typeof page.render>[0]);

        await renderTask.promise;
        if (isCancelled) return;

        // Render Official PDF.js TextLayer if not thumbnail and text is present
        if (!isThumbnail && hasText && textLayerRef.current) {
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${logicalWidth}px`;
          textLayerDiv.style.height = `${logicalHeight}px`;
          textLayerDiv.style.setProperty("--scale-factor", `${viewport.scale}`);

          textLayerTask = new TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });

          await textLayerTask.render();
        }

        if (!isCancelled) {
          setRenderState("rendered");
          if (!isThumbnail) {
            perfTelemetry.mark("LUMA_PERF_PDF_CANVAS_READY", { pageNum });
          }
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "name" in err && err.name === "RenderingCancelledException") {
          return;
        }
        console.warn(`[PdfPageCanvas] Page ${pageNum} render error:`, err);
        if (!isCancelled) {
          setRenderState("error");
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore cancel error
        }
      }
      if (textLayerTask) {
        try {
          textLayerTask.cancel();
        } catch {
          // ignore cancel error
        }
      }
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = "";
      }
    };
  }, [pdfDoc, pageNum, zoom, isThumbnail, isVisible, onPageLoaded, targetWidth, hasTextLayer]);

  // Thumbnail Render Mode
  if (isThumbnail) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full aspect-[3/4] bg-white rounded border border-[#18181B]/15 dark:border-white/20 shadow-xs overflow-hidden flex items-center justify-center ${className}`}
      >
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
        {renderState === "loading" && (
          <div className="absolute inset-0 bg-[#FAF7F2] flex items-center justify-center">
            <span className="text-[9px] font-mono text-[#A8A29E]">{pageNum}</span>
          </div>
        )}
      </div>
    );
  }

  // Full Reading Viewport Mode
  return (
    <div
      ref={containerRef}
      data-page-num={pageNum}
      className={`relative flex flex-col items-center bg-white border border-[#18181B]/15 dark:border-white/20 rounded-sm shadow-[0_4px_20px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] transition-all ${className}`}
      style={{
        width: `${pageDimensions.width}px`,
        height: `${pageDimensions.height}px`,
      }}
    >
      {/* Visual Canvas Layer */}
      <canvas
        ref={canvasRef}
        className={`block rounded-sm transition-opacity duration-200 ${
          renderState === "rendered" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Visual Highlight & Search Overlays */}
      {renderState === "rendered" && highlightRects.length > 0 && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none z-5"
          style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
        >
          {highlightRects.map((rect, idx) => (
            <div
              key={`hl-${rect.id}-${idx}`}
              className="absolute rounded-xs pointer-events-none"
              style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                backgroundColor: rect.isSearch ? "rgba(245, 158, 11, 0.45)" : `${rect.color}55`,
                borderBottom: rect.isSearch ? "2px solid #b45309" : `2px solid ${rect.color}`,
              }}
            />
          ))}
        </div>
      )}

      {/* Official PDF.js TextLayer Container */}
      {!isThumbnail && (
        <div
          ref={textLayerRef}
          className="textLayer select-text"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${pageDimensions.width}px`,
            height: `${pageDimensions.height}px`,
            overflow: "clip",
            zIndex: 10,
          }}
        />
      )}

      {/* Loading Skeleton */}
      {renderState === "loading" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF7F2] text-[#8C8275] p-6 text-center space-y-2 rounded-sm"
          style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
        >
          <Loader2 className="w-6 h-6 animate-spin text-[#8C8275] opacity-60" />
          <p className="text-xs font-serif text-[#78716C]">Rendering Page {pageNum}...</p>
        </div>
      )}

      {/* Fallback Error or Missing PDF */}
      {renderState === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#78716C]">
          <BookOpen className="w-8 h-8 mb-2 opacity-40 text-[#8C8275]" />
          <p className="text-xs text-[#78716C] mt-1 font-mono">Page {pageNum}</p>
          {fallbackText && fallbackText.trim().length > 0 ? (
            <div className="mt-4 p-4 text-justify select-text font-serif leading-relaxed text-[#292524] text-[13px] max-h-[500px] overflow-y-auto">
              {fallbackText}
            </div>
          ) : (
            <p className="text-[11px] text-[#A8A29E] mt-3 max-w-xs italic font-serif">
              Visual rendering encountered an issue. Page content unavailable.
            </p>
          )}
        </div>
      )}

      {/* Scanned/Image Document Status Badge */}
      {renderState === "rendered" && isScannedOnly && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-[#FAF7F2]/90 border border-[#E5DFD3] text-[9px] font-mono text-[#78716C] flex items-center gap-1 opacity-70 hover:opacity-100 select-none shadow-xs pointer-events-auto">
          <FileText className="w-2.5 h-2.5 text-[#8C8275]" />
          <span>Scanned Page (No Text Layer)</span>
        </div>
      )}
    </div>
  );
};
