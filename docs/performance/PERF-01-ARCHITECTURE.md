# LUMA PERF-01: Performance Architecture & Systems Design

## 1. System Philosophy & Architecture Invariants

Luma is an offline-first, local-native desktop reading and research application. The performance architecture is built on the principle of **removing waste before optimizing execution**, maintaining zero unnecessary layers between user interaction and disk/render engines.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend Layer (React 18)                       │
│  - Zustand state containers with granular, isolated selectors          │
│  - Optimistic UI updates with debounced IPC persistence                │
│  - Zero full-tree invalidation on background events                    │
│  - Deterministic publisher covers with instant base64 disk fallback    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Tauri 2 IPC (Async / Binary DTOs)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Tauri Host / Backend Bridge (Rust)                  │
│  - Non-blocking Tokio async command runtime                            │
│  - Bounded concurrency thread pools for background operations          │
│  - Domain Event Bus forwarding to WebView                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────────┐
│     luma-storage & SQLite Engine      │ │      luma-reader & luma-anchor        │
│  - Dual-connection model (Read/Write) │ │  - Constant O(1) streaming SHA-256    │
│  - Write-Ahead Logging (WAL) mode     │ │  - In-memory RwLock chapter caching   │
│  - Single-transaction bulk updates    │ │  - 1D sliding buffer Levenshtein      │
│  - B-tree indexing on all filter axes │ │  - In-memory PDF Uint8Array streaming │
└───────────────────────────────────────┘ └───────────────────────────────────────┘
```

## 2. Storage & Database Architecture

### 2.1 Dual-Connection Model (Read vs. Write)
- **Write Connection:** Single exclusive connection handle managed by `DatabaseService` wrapped in transactional boundaries. Uses `PRAGMA synchronous = NORMAL` and `PRAGMA journal_mode = WAL`.
- **Read Connection:** Dedicated `with_read_conn` path with `PRAGMA query_only = ON`. Allows full concurrency between UI listing/search and background document import or indexing without lock contention.

### 2.2 Indexing Strategy
- Primary filtering columns indexed:
  - `books(reading_status)`
  - `books(library_state)`
  - `books(title)`
  - `books(updated_at)`
  - `book_authors(author_id)`
  - `book_tags(tag_id)`
  - `book_collections(book_id)`
- Query plans verified with `EXPLAIN QUERY PLAN` showing zero full-table scans during filtered library retrieval.

### 2.3 Single-Transaction Batch Execution
- Bulk status updates, bulk tagging, and bulk trashing operations are executed inside an atomic transaction block. Reduces disk synchronization round trips from $N \times 3.4\text{ms}$ to a single atomic $1.48\text{ms}$ write.

---

## 3. Reader & Document Processing Architecture

### 3.1 EPUB Reader Pipeline
- Parsed metadata (container, OPF, manifest, spine, TOC) is extracted once upon document open.
- Chapters are lazily decoded and cached in a thread-safe `RwLock<HashMap<usize, ChapterContent>>`.
- Subsequent navigation back and forth across chapters occurs in sub-millisecond in-memory time ($0.08\text{ms}$).

### 3.2 PDF Reader Pipeline
- Direct `Uint8Array` in-memory stream rendering via PDF.js worker.
- Elimination of blocking external network font table requests (`cMapUrl` CDN requests), resulting in instantaneous first-paint of cover, preface, and reading pages.

---

## 4. IPC & Frontend State Architecture

### 4.1 Coalesced / Debounced State Persistence
- High-frequency reading events (scrolling, page flipping, chapter advance) update local UI state immediately (zero interaction lag).
- IPC persistence via `saveReadingProgress` is coalesced with a 400ms trailing debounce timer.
- Reader close immediately flushes pending state synchronously to SQLite.

### 4.2 Granular Domain Event Invalidation
- Background imports emit targeted `DomainEvent::BookImported(id)` events.
- UI invalidates and prepends only the affected records, eliminating full-library reloads and state churn.
