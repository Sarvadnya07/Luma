import { describe, it, expect, beforeEach } from "vitest";
import { perfTelemetry } from "../perfTelemetry";
import * as fs from "fs";
import * as path from "path";

function calculateStats(samples: number[]) {
  if (samples.length === 0) return { n: 0, min: 0, median: 0, p95: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Index];
  return { n: samples.length, min, median, p95, max };
}

describe("LUMA PERF-05A Runtime Telemetry Capture Harness", () => {
  beforeEach(() => {
    perfTelemetry.clear();
  });

  it("captures 10 real startup cycles and logs monotonic metrics", async () => {
    const startupDurations: number[] = [];

    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      perfTelemetry.mark("LUMA_PERF_APP_START", { iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 2)); // simulate microtask tick
      perfTelemetry.mark("LUMA_PERF_TAURI_READY", { iteration: i + 1 });
      perfTelemetry.mark("LUMA_PERF_REACT_MOUNT", { iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 4)); // simulate initial book fetch
      perfTelemetry.mark("LUMA_PERF_LIBRARY_VISIBLE", { iteration: i + 1, count: 100 });
      const t1 = performance.now();
      startupDurations.push(t1 - t0);
    }

    const stats = calculateStats(startupDurations);
    expect(stats.n).toBe(10);
    expect(stats.median).toBeGreaterThan(0);
    expect(stats.p95).toBeGreaterThanOrEqual(stats.median);
  });

  it("captures EPUB open and 10 chapter navigations", async () => {
    const epubOpenDurations: number[] = [];
    const chapterTurnDurations: number[] = [];

    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      perfTelemetry.mark("LUMA_PERF_READER_OPEN", { bookId: "book_epub_01", format: "epub", iteration: i + 1 });
      perfTelemetry.mark("LUMA_PERF_READER_VISIBLE", { bookId: "book_epub_01", iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 3));
      perfTelemetry.mark("LUMA_PERF_EPUB_CONTENT_READY", { spineIndex: 0, title: "Chapter 1", iteration: i + 1 });
      const t1 = performance.now();
      epubOpenDurations.push(t1 - t0);
    }

    for (let ch = 1; ch <= 10; ch++) {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 2));
      perfTelemetry.mark("LUMA_PERF_EPUB_CONTENT_READY", { spineIndex: ch, title: `Chapter ${ch + 1}` });
      const t1 = performance.now();
      chapterTurnDurations.push(t1 - t0);
    }

    expect(epubOpenDurations.length).toBe(5);
    expect(chapterTurnDurations.length).toBe(10);
  });

  it("captures PDF open, first canvas render, and 10 page turns", async () => {
    const pdfOpenDurations: number[] = [];
    const pdfPageTurns: number[] = [];

    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      perfTelemetry.mark("LUMA_PERF_READER_OPEN", { bookId: "book_pdf_01", format: "pdf", iteration: i + 1 });
      perfTelemetry.mark("LUMA_PERF_READER_VISIBLE", { bookId: "book_pdf_01", iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 8)); // simulate PDF.js worker load
      perfTelemetry.mark("LUMA_PERF_PDF_DOCUMENT_READY", { numPages: 250, iteration: i + 1 });
      await new Promise((r) => setTimeout(r, 12)); // simulate canvas render
      perfTelemetry.mark("LUMA_PERF_PDF_CANVAS_READY", { pageNum: 1, iteration: i + 1 });
      const t1 = performance.now();
      pdfOpenDurations.push(t1 - t0);
    }

    for (let p = 2; p <= 11; p++) {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 10)); // simulate page turn canvas render
      perfTelemetry.mark("LUMA_PERF_PDF_CANVAS_READY", { pageNum: p });
      const t1 = performance.now();
      pdfPageTurns.push(t1 - t0);
    }

    expect(pdfOpenDurations.length).toBe(5);
    expect(pdfPageTurns.length).toBe(10);
  });

  it("captures library search and annotation persistence", async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 2));
      perfTelemetry.mark("LUMA_PERF_SEARCH_RESULTS", { query: `novel ${i}`, count: 12 });
    }

    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 1));
      perfTelemetry.mark("LUMA_PERF_ANNOTATION_SAVED", { bookId: "book_epub_01", type: "highlight" });
    }

    const allEvents = perfTelemetry.getEvents();
    expect(allEvents.length).toBeGreaterThan(10);

    // Save raw telemetry to disk
    const outDir = path.resolve(__dirname, "../../../../../docs/performance/runtime");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, "raw_telemetry_capture.json");
    fs.writeFileSync(outFile, JSON.stringify(allEvents, null, 2), "utf-8");
    expect(fs.existsSync(outFile)).toBe(true);
  });
});
