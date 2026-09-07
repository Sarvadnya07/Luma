# Document Lifecycle & Session Management

## 1. Document Lifecycle Stages

Every document managed by Luma traverses five distinct phases:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Ingestion   │ ──> │ Registration │ ──> │ Session Open │ ──> │ Query/Access │ ──> │ Eviction /   │
│  & Hashing   │     │   (SQLite)   │     │  (LRU Cache) │     │  (IPC/Core)  │     │ Reclamation  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Detailed Lifecycle Breakdown

### Phase 1: Ingestion & Cryptographic Hashing
- **Path**: `LibraryService::import_file`
- The file is read in streaming chunks to compute its canonical SHA-256 fingerprint.
- Duplicate detection matches the SHA-256 hash against existing books in SQLite.
- File size, MIME type, format detection, and initial metadata extraction occur.
- Covers are extracted into the application cover cache (`<app_data>/covers/`).

### Phase 2: Metadata & Entity Registration
- The book is persisted to the `books` table in SQLite with format enum (`epub`, `pdf`, `cbz`, `txt`, `markdown`, `html`).
- Reading progress is initialized with zero progress in the `reading_progress` table.
- Initial full-text indexing or metadata indexing is queued via `JobManager`.

### Phase 3: Session Acquisition & Caching
- When the user opens a reader view or requests document structure, `ReaderService::get_or_open_canonical` is invoked.
- **Thread Safety**: `ReaderService` maintains a bounded LRU cache protected by `Arc<Mutex<LruCache<BookId, Arc<CanonicalDocument>>>>`.
- **Cache Hit**: Returns an `Arc<CanonicalDocument>` clone immediately without filesystem access or reparsing.
- **Cache Miss**:
  1. Resolves absolute file path from the `BookRepository`.
  2. Detects format enum (`DocumentFormat`).
  3. Dispatches to `CanonicalDocument::open(path, format)`.
  4. Parses semantic structure, headings, resources, and paragraph offsets.
  5. Inserts the resulting `Arc<CanonicalDocument>` into the LRU cache (default capacity: 16 documents).
  6. Oldest sessions are safely dropped when capacity is exceeded.

### Phase 4: Query & Concurrent Access
- The `Arc<CanonicalDocument>` instance allows concurrent, non-blocking reads across multiple threads and Tauri IPC invocations:
  - `get_document_structure`: Returns hierarchical outline tree.
  - `get_node_text`: Retrieves text for any node ID (`p0`, `heading-1`).
  - `get_range_text`: Slices text across canonical scalar offsets.
  - `get_document_headings`: Retrieves table of contents / outline.
  - `get_document_resources`: Enumerates embedded assets.
  - `read_document_resource`: Fetches byte payload of images/fonts.
  - `get_document_citation`: Constructs academic citations with surrounding context.
  - `search_canonical`: Executes in-memory regex or keyword search across paragraphs.

### Phase 5: Eviction & Resource Reclamation
- When an active reader closes or navigates to the library, memory is reclaimed as follows:
  - Frontend unmounts React components, destroying canvas contexts and releasing blob URLs (`URL.revokeObjectURL`).
  - Backend LRU cache evicts unreferenced documents when newer books are opened.
  - SQLite connections and temporary transaction memory are returned to the pool.
