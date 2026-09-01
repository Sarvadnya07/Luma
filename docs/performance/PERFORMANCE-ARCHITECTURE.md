# Luma Performance & Scalability Architecture

## 1. High-Performance Architecture Overview

Luma is engineered as a local-first desktop reading application designed for instantaneous interactions, low memory overhead, and resilience across massive libraries (50,000+ publications).

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React 18 + Zustand)            │
│  - Virtualized rendering & lazy card thumbnails        │
│  - Optimistic UI updates with debounced progress saves │
│  - Dynamic aesthetic book cover rendering fallback     │
└──────────────────────────┬─────────────────────────────┘
                           │ Tauri IPC (Async / Binary)
┌──────────────────────────▼─────────────────────────────┐
│                 Tauri Desktop Host (Rust)              │
│  - Non-blocking async commands                         │
│  - Event Bridge forwarding DomainEvents to WebView     │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  luma-storage (SQLite WAL)   │ │   luma-reader & luma-anchor  │
│  - Dedicated Read/Write Conns│ │  - Streaming SHA256 (64KB)   │
│  - B-tree indexing on filters│ │  - In-memory chapter cache   │
│  - Single-tx bulk operations │ │  - 1D sliding Levenshtein    │
└──────────────────────────────┘ └──────────────────────────────┘
```

## 2. Core Architectural Guarantees

### 2.1 Database & Concurrency
- **WAL Mode with Dual Connection Model:** SQLite operates in Write-Ahead Logging (`PRAGMA journal_mode = WAL`) with `PRAGMA synchronous = NORMAL`. Read queries execute concurrently via `with_read_conn` (`PRAGMA query_only = ON`) without lock contention against ongoing background imports.
- **Batched Transactions:** Bulk operations (tagging, collections, status updates, imports) execute within a single atomic SQLite transaction, reducing multi-thousand millisecond loops to single-digit milliseconds.

### 2.2 Memory Bounds
- **Streaming Hashing ($O(1)$ Memory):** Document hashing uses chunked streaming (`std::io::BufReader` with 64KB buffers) via `luma_security::compute_sha256_reader`, preventing multi-hundred megabyte buffer allocations.
- **In-Memory Chapter Caching:** Opened EPUB documents cache decoded spine chapters in memory (`RwLock<HashMap<usize, ChapterContent>>`), eliminating repeated zip central directory parses during reading sessions.

### 2.3 IPC & State Coalescing
- **Debounced Persistence:** Progress updates during rapid flipping or scrolling are updated immediately in the local UI state and flushed to SQLite via a 400ms trailing debounce timer. Closing the reader immediately cancels the timer and synchronously persists the latest state.
