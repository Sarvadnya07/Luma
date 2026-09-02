# ⚡ LUMA — PERF-03 LARGE-SCALE VALIDATION & QUERY BENCHMARKS

**Date**: 2026-09-02  
**Dataset**: 10,000 Books, 50 Authors, Multiple Reading Statuses & Junction Links  
**Status**: `MEASURED & VALIDATED`  

---

## 1. 10,000 Books Database Benchmarks

| Query / Operation | Total Units | Total Time | Average Latency | Measurement Proof |
| :--- | :---: | :---: | :---: | :--- |
| **10,000 Books Bulk Ingestion** | 10,000 items | 417.47 ms | **0.04 ms/book** | `test_benchmark_large_scale_10k_library` |
| **Paginated List (Page size 50)** | 100 pages (5,000 items) | 675.45 ms | **6.75 ms/page** | B-tree index seeks + batch authors |
| **Filtered List (status = Reading)** | 20 pages (1,000 items) | 88.60 ms | **4.43 ms/page** | `idx_books_reading_status` index scan |
| **FTS5 Full-Text Search Queries** | 50 queries | 70.50 ms | **1.41 ms/query** | `test_benchmark_search_hot_path` |

---

## 2. Query Plan Verification (`EXPLAIN QUERY PLAN`)

- **Books Listing**: Uses `SEARCH books USING INDEX idx_books_library_state (library_state=?)` and `ORDER BY b.title ASC`. Zero full table scans.
- **Batch Authors**: Uses `SEARCH book_authors USING PRIMARY KEY (book_id=?)`. Single query batch lookup in O(N).
- **FTS5 Search**: Uses `SCAN books_fts VIRTUAL TABLE INDEX 0:`. Bounded query length with unicode61 tokenizer.
