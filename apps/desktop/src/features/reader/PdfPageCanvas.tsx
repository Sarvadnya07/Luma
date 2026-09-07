import React, { useEffect, useRef, useState, useMemo } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2, BookOpen, FileText } from "lucide-react";
import { Annotation } from "@luma/shared-types";
import { perfTelemetry } from "../../lib/perfTelemetry";


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
}

interface TextSpan {
  str: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderState, setRenderState] = useState<"loading" | "rendered" | "error">("loading");
  const [textSpans, setTextSpans] = useState<TextSpan[]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: isThumbnail ? 160 : (targetWidth || 480),
    height: isThumbnail ? 220 : 640,
  });
  const [isScannedOnly, setIsScannedOnly] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(!isThumbnail);

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

  const highlightRects = useMemo(() => {
    if (!pageAnnotations.length || !textSpans.length) return [];
    const rects: Array<{ left: number; top: number; width: number; height: number; color: string; id: string }> = [];

    for (const ann of pageAnnotations) {
      if (!ann.quote || !ann.quote.trim()) continue;
      const quoteWords = ann.quote.trim().toLowerCase();
      const color = ann.color_hex || "#fef08a";

      for (const span of textSpans) {
        const spanLower = span.str.toLowerCase();
        if (spanLower.length > 1 && (quoteWords.includes(spanLower) || spanLower.includes(quoteWords))) {
          rects.push({
            left: span.left,
            top: span.top,
            width: span.width,
            height: span.height,
            color,
            id: ann.id,
          });
        }
      }
    }
    return rects;
  }, [pageAnnotations, textSpans]);

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

  useEffect(() => {
    let isCancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    async function renderPage() {
      if (!isVisible || !pdfDoc || pageNum < 1 || pageNum > pdfDoc.numPages) {
        return;
      }

      try {
        setRenderState("loading");
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        // Check text content availability
        const textContent = await page.getTextContent();
        const hasText = textContent.items.length > 0;
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

        setPageDimensions({ width: logicalWidth, height: logicalHeight });

        // Build text layer overlay spans for text selection
        if (!isThumbnail && hasText) {
          const spans: TextSpan[] = [];
          for (const item of textContent.items) {
            if ("str" in item && typeof item.str === "string" && item.str.length > 0) {
              const [vx, vy] = viewport.convertToViewportPoint(
                item.transform[4] as number,
                item.transform[5] as number
              );
              const fontHeight =
                Math.hypot(item.transform[0] as number, item.transform[1] as number) *
                finalScale;
              const itemWidth = (item.width || 0) * finalScale;
              spans.push({
                str: item.str,
                left: Math.round(vx),
                top: Math.round(vy - fontHeight),
                width: Math.max(1, Math.round(itemWidth)),
                height: Math.max(1, Math.round(fontHeight)),
                fontSize: Math.max(1, fontHeight),
              });
            }
          }
          if (!isCancelled) {
            setTextSpans(spans);
          }
        } else {
          if (!isCancelled) {
            setTextSpans([]);
          }
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        // High-DPI buffer scaling: internal buffer is scaled by DPR while CSS size is logical pixels
        canvas.width = Math.floor(logicalWidth * dpr);
        canvas.height = Math.floor(logicalHeight * dpr);
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        // Reset transform to identity and clear background
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Transform for devicePixelRatio scaling
        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;

        renderTask = page.render({
          canvas: canvas,
          canvasContext: ctx,
          transform: transform,
          viewport: viewport,
        } as any);

        await renderTask.promise;
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
    };
  }, [pdfDoc, pageNum, zoom, isThumbnail, isVisible, onPageLoaded]);

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

      {/* Visual Highlight Overlays */}
      {renderState === "rendered" && highlightRects.length > 0 && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none z-5"
          style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
        >
          {highlightRects.map((rect, idx) => (
            <div
              key={`hl-${rect.id}-${idx}`}
              className="absolute rounded-xs"
              style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                backgroundColor: `${rect.color}55`,
                borderBottom: `2px solid ${rect.color}`,
              }}
            />
          ))}
        </div>
      )}

      {/* Selectable Text Layer Overlay for Selection & Highlighting */}
      {renderState === "rendered" && textSpans.length > 0 && (
        <div
          className="absolute inset-0 overflow-hidden select-text pointer-events-auto leading-none z-10"
          style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
        >
          {textSpans.map((span, idx) => (
            <span
              key={idx}
              style={{
                position: "absolute",
                left: `${span.left}px`,
                top: `${span.top}px`,
                width: `${span.width}px`,
                height: `${span.height}px`,
                fontSize: `${span.fontSize}px`,
                lineHeight: `${span.height}px`,
                fontFamily: "sans-serif",
                color: "transparent",
                userSelect: "text",
                whiteSpace: "pre",
                cursor: "text",
              }}
            >
              {span.str}
            </span>
          ))}
        </div>
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

      {/* Fallback Error or No PDF.js Loaded State */}
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

      {/* Subtle Bottom Status Indicator for Scanned/Image Pages */}
      {renderState === "rendered" && isScannedOnly && hasTextLayer === false && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-[#FAF7F2]/90 border border-[#E5DFD3] text-[9px] font-mono text-[#78716C] flex items-center gap-1 opacity-70 hover:opacity-100 select-none shadow-xs pointer-events-auto">
          <FileText className="w-2.5 h-2.5 text-[#8C8275]" />
          <span>Image / Scanned Page</span>
        </div>
      )}
    </div>
  );
};
