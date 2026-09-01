# Luma Performance Hot-Paths Reference

## 1. Top Hot Paths

| Hot Path | Operations Involved | Critical Invariants | Optimizations Applied |
|---|---|---|---|
| **1. Application Startup** | SQLite connection, table migration, context instantiation, Tauri setup | Must not block main thread with eager subsystem instantiation | Database WAL mode, lazy background service initialization |
| **2. Library Query & Filtering** | `list_books`, status filter, format filter, author join, sorting | Must return paginated results in under 5ms | Added B-tree indexes on `reading_status`, `library_state`, `author_id`, `tag_id`, `collection_id` |
| **3. Full-Text Search** | FTS5 index match on `books_fts`, BM25 ranking, snippet highlighting | Zero UI freezing, query-only connection | Dedicated `with_read_conn` routing, prefix and phrase optimization |
| **4. Document Import** | Staging, SHA256 hashing, metadata & cover extraction, DB persistence, FTS index | Atomic transaction, $O(1)$ memory usage | Streaming SHA256 in 64KB buffers, batched transactions, static regexes |
| **5. EPUB Chapter Opening** | Zip central directory access, XHTML sanitization, plain text extraction | Must decode without mojibake, $< 1\text{ms}$ navigation | In-memory `chapter_cache` in `EpubDocument`, static regex DFAs |
| **6. PDF Page Rendering** | PDF.js page proxy, canvas rendering, text layer extraction | Viewport-aware scaling, zero network blocking | Removed blocking CDN cmaps, in-memory `Uint8Array` decoding |
| **7. Reading Progress Save** | Page flip / chapter advance, percentage calc, locator save | No SQLite write on every scroll pixel | Debounced IPC coalescing (400ms trailing timer) + flush on exit |
| **8. Annotation & Anchoring** | Fuzzy text match, prefix/suffix context normalization, Levenshtein distance | Resilience to reflow and punctuation changes | 1D sliding buffer $O(\min(M,N))$ Levenshtein algorithm (91.5% speedup) |

## 2. Invalidation & Mutation Flow
```
Mutation Action (e.g. Set Reading Status, Import Book)
  │
  ▼
Single SQLite Transaction (with WAL write lock)
  │
  ▼
Domain Event Published (EventBus)
  │
  ▼
Targeted Cache Invalidation & Granular UI State Update
(No full-application reloads or redundant queries)
```
