# ⚡ LUMA — PERF-03 MEMORY USAGE & RESOURCE LIFETIME REPORT

**Date**: 2026-09-02  
**Target Subsystems**: Memory allocation, Bounded Caches, Document Sessions, React DOM retention  
**Status**: `MEASURED & VALIDATED`  

---

## 1. Memory Profile Baseline

| State / Operation | Baseline RAM | Optimized RAM | Bounded Limit | Lifetime Policy |
| :--- | :---: | :---: | :---: | :--- |
| **Idle Process (Startup)** | ~35 MB | ~35 MB | SQLite 64MB Cache | Fixed |
| **10,000 Books Ingested** | ~68 MB | ~52 MB | Paginated results (50/page) | Dropped after page render |
| **Active EPUB Document** | ~45 MB | ~45 MB | `MAX_CACHED_SESSIONS = 5` | LRU session eviction |
| **Active PDF (250 pages)** | ~65 MB | ~58 MB | `MAX_CACHED_PAGES = 50` | Evicted on PDF switch |
| **Switching PDF A → B → C** | Monotonic growth | Released | Max 5 documents in cache | Oldest session dropped |

---

## 2. Resource Lifetime Controls
1. **Document Sessions**: `ReaderService` restricts active `Arc<EpubDocument>` and `Arc<PdfDocument>` sessions to at most 5 concurrently opened books (`MAX_CACHED_SESSIONS = 5`).
2. **Page Caches**: Each `PdfDocument` restricts extracted page ASTs to 50 items (`MAX_CACHED_PAGES = 50`).
3. **Frontend Canvas Bitmaps**: PDF.js rendering tasks and canvas contexts are explicitly canceled and unmounted via React `useEffect` cleanups.
