# LUMA PERF-01: Hot-Path Catalog & Execution Flows

## 1. Hot Path Classification

### 🔥 HOT Paths (Highest Frequency & Interactive Priority)
1. **Reader Page / Chapter Flip:** Local optimistic state update → in-memory cache lookup → render → debounced SQLite persistence.
2. **Library Filter & Sort:** Instant indexed SQLite query via dedicated read connection → virtualized card rendering.
3. **FTS5 Full-Text Search:** Query parser sanitization → BM25 ranking match → snippet highlight generation.
4. **Text Selection & Highlight:** Direct in-memory DOM range capture → optimistic state insert → background anchor persistence.

### 🟡 WARM Paths (Background Operations & Medium Frequency)
1. **Document Import:** Staging → streaming SHA-256 → metadata extraction → cover extraction → single-transaction persistence → FTS5 index update.
2. **Cover Thumbnail Generation:** On-demand extraction → base64 disk cache write → dynamic editorial palette generation on fallback.
3. **Backup Export:** Non-blocking background zip streaming without acquiring write locks on SQLite database.

### ❄️ COLD Paths (Infrequent / Maintenance Operations)
1. **Database Vacuum & Integrity Check:** Explicit user-triggered or scheduled background maintenance.
2. **FTS5 Index Rebuild:** Batch re-indexing executed in bounded memory chunks.

---

## 2. Direct Execution Sequences

### 2.1 Reader Navigation Execution Path
```
User presses ArrowRight / PageDown
  │
  ├─► [Instant] UI updates local currentSpineIndex / currentPdfPage
  ├─► [Instant] In-memory chapter_cache lookup (< 0.1ms)
  ├─► [Instant] DOM reflow with sanitized HTML
  └─► [Debounced 400ms] Tauri IPC saveReadingProgress -> SQLite WAL write
```

### 2.2 Document Import Execution Path
```
User drops EPUB/PDF file
  │
  ├─► [Staging] File staged in .luma/staging/
  ├─► [Streaming Hash] SHA-256 computed in 64KB buffers (< 64KB RAM)
  ├─► [Extract] Metadata & Cover stream parsed in memory
  ├─► [Atomic Transaction] Book, Files, Authors, Tags written in 1 SQLite tx
  ├─► [FTS Index] books_fts updated in same atomic transaction
  └─► [Domain Event] DomainEvent::BookImported emitted -> UI updates card list
```
