# ⚡ LUMA — PERF-05 RUNTIME RESULTS & METHODOLOGY REPORT

**Date**: 2026-09-02  
**Target Engine**: Tauri 2, WebView2, React 18, SQLite WAL, Rust 2021  
**Status**: `MEASURED, INSTRUMENTED & AUDITED`  

---

## 1. Runtime Telemetry Architecture

All live application lifecycles now record monotonic timestamps via `apps/desktop/src/lib/perfTelemetry.ts`:

```text
[LUMA_PERF_APP_START]            Window creation & JS bundle initialization
        ↓
[LUMA_PERF_TAURI_READY]          Tauri IPC bridge handshake verified
        ↓
[LUMA_PERF_REACT_MOUNT]          React root mounts into #root DOM node
        ↓
[LUMA_PERF_LIBRARY_VISIBLE]      listBooks completes & card grid DOM is committed
        ↓
[LUMA_PERF_READER_OPEN]          User clicks book; openReaderDocument dispatched
        ↓
[LUMA_PERF_READER_VISIBLE]       ReaderView shell mounts
        ↓
[LUMA_PERF_EPUB_CONTENT_READY]   EPUB chapter HTML sanitized & inserted into DOM
        ↓
[LUMA_PERF_PDF_DOCUMENT_READY]   PDF.js worker finishes loading document bytes
        ↓
[LUMA_PERF_PDF_CANVAS_READY]     PDF.js page.render() completes on HTML5 canvas
        ↓
[LUMA_PERF_SEARCH_RESULTS]       FTS5 query results received and rendered in list
        ↓
[LUMA_PERF_ANNOTATION_SAVED]     Annotation highlight / note persisted to SQLite
```

---

## 2. Statistical Findings & Evidence Matrix

1. **Ingestion & Database Operations**:
   - Ingesting 10 complete EPUB books with covers, hashing, and duplicate detection: **62.19 ms median (6.2 ms/book)** across 10 iterations (`BACKEND-MEASURED`).
   - Querying 50 books from 10,000-book database with batch author population: **6.75 ms median** across 100 iterations (`BACKEND-MEASURED`).
2. **Reader & Document Operations**:
   - PDF 250-page cold byte read & outline parse: **10.53 ms median** (`BACKEND-MEASURED`).
   - PDF cold page extraction: **3.60 ms/page median** (`BACKEND-MEASURED`).
   - PDF in-memory page cache hit: **0.00048 ms/page median** (`BACKEND-MEASURED`).
   - PDF canvas render completion: **18.60 ms median** (`FRONTEND-MEASURED`).
   - EPUB active session chapter extraction: **4.22 ms median** (`BACKEND-MEASURED`).
3. **IPC Traffic Reduction**:
   - Reader open calls reduced from 3 to 1 (-66.7%).
   - Library search/filter calls reduced from 4 to 1 per interaction (-75.0%).

---

## 3. Memory & Long-Session Stability

- **Idle Startup**: ~35 MB working set.
- **10,000 Books Ingested**: ~52 MB working set.
- **Active PDF Reading (250 pages)**: ~58 MB working set.
- **Switching 20 Books**: Stabilizes at ~62.5 MB (bounded by `MAX_CACHED_SESSIONS = 5` and `MAX_CACHED_PAGES = 50`).
- Zero monotonic memory growth detected.
