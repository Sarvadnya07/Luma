# ⚡ LUMA — PERF-04 FORENSIC EVIDENCE AUDIT & CLAIM CLASSIFICATION

**Date**: 2026-09-02  
**Audit Objective**: Classify every prior performance claim and determine whether it represents a real user-path metric or an isolated backend/synthetic benchmark.

---

## 1. Classification Methodology

Every performance claim is classified into exactly one of six strict tiers:
- **`RUNTIME-PROVEN`**: Empirically measured in the end-to-end desktop runtime (User Action → Visual Result / Paint).
- **`FRONTEND-MEASURED`**: Measured in the React/Vite webview layer (DOM render, React hooks, worker dispatch).
- **`BACKEND-MEASURED`**: Measured inside the Rust backend / Tauri IPC handler with real document files.
- **`SYNTHETIC-BENCHMARK`**: Measured in an isolated unit/integration test using in-memory SQLite or mock data.
- **`INFERENCE`**: Derived mathematically or logically from code structure without direct clock timing.
- **`UNPROVEN`**: Claimed or intended, but lacking rigorous instrumentation or interactive desktop proof.

---

## 2. Claim-by-Claim Forensic Classification Matrix

| Claim / Metric | Prior Reported Value | True Scope & Timing Boundaries | Strict Classification | Correct Relabeled Description |
| :--- | :---: | :--- | :---: | :--- |
| **PDF Cold Open** | 10.53 ms | Starts: `PdfDocument::open` | **`BACKEND-MEASURED`** | **Backend PDF Byte Reading & Outline Parse Latency** (Does not include PDF.js worker load or canvas paint) |
| **PDF Page Cache Hit** | 9.6 µs (">7,000x") | Starts: `doc.get_page(p)` cache hit | **`BACKEND-MEASURED`** | **In-Memory Page AST Lookup Latency** (Mathematical ratio over cold parse, not user-perceived frame rate) |
| **PDF Sequential Nav** | 72.70 ms (20 pgs) | Starts: `doc.get_page(p)` loop | **`BACKEND-MEASURED`** | **Rust Content Stream De-escaping & Regex Latency (3.6 ms/pg)** |
| **PDF Random Access** | 11.85 ms (6 jumps) | Starts: `doc.get_page(p)` jumps | **`BACKEND-MEASURED`** | **Stream Chunk Seek Latency (1.97 ms/jump)** |
| **Sidebar Thumbnails** | "95% task reduction" | IntersectionObserver gate in `PdfPageCanvas` | **`FRONTEND-MEASURED`** | **Thumbnail Worker Dispatch Reduction** (Deferred canvas rendering until viewport intersection) |
| **Application Startup** | 18.35 ms | Starts: `LumaAppContext::new` → DB migrations | **`BACKEND-MEASURED`** | **Backend Service & Database Pool Initialization Latency** (Does not include OS process launch, Tauri, or Webview) |
| **10k Library Ingestion**| 417.47 ms | In-memory SQLite raw SQL transaction | **`SYNTHETIC-BENCHMARK`**| **SQLite Raw Row Batch Insertion Latency (0.04 ms/row)** (Excludes archive hashing, cover extraction, and IPC) |
| **10k Library Pagination**| 6.75 ms / page | `book_repo.list` + single query batch authors | **`BACKEND-MEASURED`** | **SQLite Index Seek & Batch Author Resolution Latency** |
| **10k Filtered Query** | 4.43 ms / page | `book_repo.list` with `reading_status` index | **`BACKEND-MEASURED`** | **SQLite B-Tree Index Scan Latency** |
| **EPUB Chapter Turn** | 40.87 ms (50 chs) | Starts: `session_doc.get_chapter(i)` | **`BACKEND-MEASURED`** | **In-Memory EPUB Session Chapter Extraction Latency (0.81 ms/ch)** |
| **EPUB Cached Revisit** | 0.001 ms | Starts: `EpubDocument.chapter_cache` hit | **`BACKEND-MEASURED`** | **In-Memory DOM String Cache Hit Latency** |
| **FTS5 Search Query** | 1.41 ms / query | Starts: `search_service.search_library` | **`BACKEND-MEASURED`** | **SQLite FTS5 Full-Text Match Latency** |
| **Open Doc IPC Consolidation**| 3 → 1 calls | Tauri command bundle payload | **`INFERENCE`** | **IPC Roundtrip Call Count Reduction (-66.7%)** |
| **Library Search IPC Traffic**| 4 → 1 calls | Separate `loadMetadata` and `loadBooks` | **`FRONTEND-MEASURED`** | **Keystroke IPC Dispatch Reduction (-75%)** |
| **Interactive Desktop UI**| "Smooth" | Visual runtime observation | **`UNPROVEN`** | **Requires interactive GUI frame timing / telemetry** |

---

## 3. Discrepancy Analysis: Backend vs User Experience

```text
WHAT WAS MEASURED (Backend Micro-benchmark):
Rust Engine
  └── PdfDocument::open (10.53 ms)
  └── PdfDocument::get_page (3.6 ms)

WHAT THE USER ACTUALLY EXPERIENCES (End-to-End User Path):
User clicks Book
  ├── 1. Tauri IPC serialization & dispatch (~2 ms)
  ├── 2. Rust ReaderService::open_document + DB read (~5 ms)
  ├── 3. IPC response deserialization in Webview (~3 ms)
  ├── 4. React readerState state transition & mount (~8 ms)
  ├── 5. PDF.js Web Worker instantiation & byte transfer (~30-60 ms)
  ├── 6. PDF.js font parsing, glyph layout, and stream execution (~25-50 ms)
  ├── 7. HTML5 Canvas drawImage & textLayer DOM sync (~15-30 ms)
  └── 8. Monitor V-Sync & Compositor Paint (~16 ms)
  Total User-Visible First Paint: ~100 - 180 ms (Realistic target) vs 10.53 ms (Rust-only)
```

The distinction between **Backend Latency** and **User-Visible Frame Paint** is strictly maintained for all PERF-04 reporting.
