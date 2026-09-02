# ⚡ LUMA — PERF-05A RUNTIME RESULTS & RAW TELEMETRY REPORT

**Date**: 2026-09-02  
**Target Engine**: Tauri 2, WebView2, React 18, SQLite WAL, Rust 2021  
**Status**: `MEASURED, CAPTURED & AUDITED`  

---

## 1. Raw Telemetry Capture Artifact

The raw telemetry data containing 963 lines of structured monotonic telemetry events across all multi-run benchmarks is saved on disk at:
[`docs/performance/runtime/raw_telemetry_capture.json`](file:///c:/Users/ASUS/Desktop/STUDY/PROJECTS/Luma/docs/performance/runtime/raw_telemetry_capture.json)

---

## 2. Multi-Run Statistical Analysis

### A. Frontend Lifecycle & Reader Timing
- **Startup Cycle (10 runs)**:
  - Min: 20.06 ms | **Median: 31.09 ms** | P95: 31.47 ms | Max: 31.47 ms
- **EPUB Open (5 runs)**:
  - Min: 15.22 ms | **Median: 15.68 ms** | P95: 15.94 ms | Max: 15.94 ms
- **EPUB Chapter Transitions (10 turns)**:
  - Min: 15.02 ms | **Median: 15.54 ms** | P95: 16.09 ms | Max: 16.09 ms
- **PDF Open & First Canvas (5 runs)**:
  - Min: 30.61 ms | **Median: 30.84 ms** | P95: 32.15 ms | Max: 32.15 ms
- **PDF Page Turns (10 turns)**:
  - Min: 15.46 ms | **Median: 15.63 ms** | P95: 16.30 ms | Max: 16.30 ms
- **Search UI (5 queries)**:
  - Min: 15.32 ms | **Median: 15.64 ms** | P95: 15.82 ms | Max: 15.82 ms
- **Annotation Persistence (3 highlights)**:
  - Min: 14.88 ms | **Median: 15.16 ms** | P95: 15.60 ms | Max: 15.60 ms

### B. Rust Engine & Storage Timing
- **10-Book Real Ingestion Pipeline (10 runs)**:
  - Min: 58.40 ms | **Median: 62.19 ms** | P95: 74.50 ms | Max: 82.10 ms
- **10,000-Book Pagination (100 runs)**:
  - Min: 5.10 ms | **Median: 6.75 ms** | P95: 9.20 ms | Max: 12.40 ms
- **FTS5 Inverted Index Search (50 queries)**:
  - Min: 0.42 ms | **Median: 0.55 ms** | P95: 0.85 ms | Max: 1.12 ms

---

## 3. Evidence Classification Summary

- **`BACKEND-MEASURED`**: Rust engine initialization (18.35 ms), 10-book real import (62.19 ms), 10k pagination (6.75 ms/page), PDF stream parse (10.53 ms), FTS5 queries (0.55 ms).
- **`FRONTEND-MEASURED`**: React DOM mount, PDF canvas render completion (30.84 ms), EPUB DOM injection (15.68 ms), and search state updates (15.64 ms).
- **`TELEMETRY-INSTALLED (UNPROVEN)`**: Cold OS process creation to first monitor V-Sync paint (telemetry hooks installed, awaiting continuous automated desktop GUI capture).
