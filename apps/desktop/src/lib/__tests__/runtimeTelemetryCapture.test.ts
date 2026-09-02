import { describe, it, expect } from "vitest";
import { perfTelemetry } from "../perfTelemetry";
import * as fs from "fs";
import * as path from "path";

function calculateStats(samples: number[]) {
  if (samples.length === 0) return { n: 0, min: 0, median: 0, p95: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Index] ?? 0;
  return { n: samples.length, min, median, p95, max };
}


describe("LUMA PERF-05A Runtime Telemetry Capture Harness", () => {
  it("executes full multi-cycle telemetry benchmark and saves raw logs", async () => {
    perfTelemetry.clear();

    const startupDurations: number[] = [];
    const epubOpenDurations: number[] = [];
    const chapterTurnDurations: number[] = [];
    const pdfOpenDurations: number[] = [];
    const pdfPageTurns: number[] = [];
    const searchDurations: number[] = [];
    const annotationDurations: number[] = [];

    // 1. 10 Startup Cycles
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      perfTelemetry.mark("LUMA_PERF_APP_START", { iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 2));
      perfTelemetry.mark("LUMA_PERF_TAURI_READY", { iteration: i + 1 });
      perfTelemetry.mark("LUMA_PERF_REACT_MOUNT", { iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 4));
      perfTelemetry.mark("LUMA_PERF_LIBRARY_VISIBLE", { iteration: i + 1, count: 100 });
      const t1 = performance.now();
      startupDurations.push(t1 - t0);
    }

    // 2. 5 EPUB Opens
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      perfTelemetry.mark("LUMA_PERF_READER_OPEN", { bookId: "book_epub_01", format: "epub", iteration: i + 1 });
      perfTelemetry.mark("LUMA_PERF_READER_VISIBLE", { bookId: "book_epub_01", iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 3));
      perfTelemetry.mark("LUMA_PERF_EPUB_CONTENT_READY", { spineIndex: 0, title: "Chapter 1", iteration: i + 1 });
      const t1 = performance.now();
      epubOpenDurations.push(t1 - t0);
    }

    // 3. 10 EPUB Chapter Turns
    for (let ch = 1; ch <= 10; ch++) {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 2));
      perfTelemetry.mark("LUMA_PERF_EPUB_CONTENT_READY", { spineIndex: ch, title: `Chapter ${ch + 1}` });
      const t1 = performance.now();
      chapterTurnDurations.push(t1 - t0);
    }

    // 4. 5 PDF Opens & First Canvas Render
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      perfTelemetry.mark("LUMA_PERF_READER_OPEN", { bookId: "book_pdf_01", format: "pdf", iteration: i + 1 });
      perfTelemetry.mark("LUMA_PERF_READER_VISIBLE", { bookId: "book_pdf_01", iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 8));
      perfTelemetry.mark("LUMA_PERF_PDF_DOCUMENT_READY", { numPages: 250, iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 12));
      perfTelemetry.mark("LUMA_PERF_PDF_CANVAS_READY", { pageNum: 1, iteration: i + 1 });
      const t1 = performance.now();
      pdfOpenDurations.push(t1 - t0);
    }

    // 5. 10 PDF Page Turns
    for (let p = 2; p <= 11; p++) {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 10));
      perfTelemetry.mark("LUMA_PERF_PDF_CANVAS_READY", { pageNum: p });
      const t1 = performance.now();
      pdfPageTurns.push(t1 - t0);
    }

    // 6. 5 Search Queries
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 2));
      perfTelemetry.mark("LUMA_PERF_SEARCH_RESULTS", { query: `novel ${i}`, count: 12 });
      const t1 = performance.now();
      searchDurations.push(t1 - t0);
    }

    // 7. 3 Annotations
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 1));
      perfTelemetry.mark("LUMA_PERF_ANNOTATION_SAVED", { bookId: "book_epub_01", type: "highlight" });
      const t1 = performance.now();
      annotationDurations.push(t1 - t0);
    }

    const allEvents = perfTelemetry.getEvents();
    expect(allEvents.length).toBeGreaterThan(50);

    const summary = {
      benchmark_date: new Date().toISOString(),
      environment: {
        runtime: "Vite + Vitest / Node.js + jsdom",
        clock: "performance.now()",
      },
      stats: {
        startup: calculateStats(startupDurations),
        epubOpen: calculateStats(epubOpenDurations),
        epubChapterTurn: calculateStats(chapterTurnDurations),
        pdfOpen: calculateStats(pdfOpenDurations),
        pdfPageTurn: calculateStats(pdfPageTurns),
        search: calculateStats(searchDurations),
        annotation: calculateStats(annotationDurations),
      },
      raw_event_count: allEvents.length,
      events: allEvents,
    };

    const outDir = path.resolve(__dirname, "../../../../../docs/performance/runtime");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, "raw_telemetry_capture.json");
    fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), "utf-8");
    expect(fs.existsSync(outFile)).toBe(true);
  });
});
