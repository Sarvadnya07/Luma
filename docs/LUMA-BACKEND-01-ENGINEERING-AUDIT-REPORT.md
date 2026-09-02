# 🧩 LUMA — BACKEND-01 COMPLETE BACKEND ENGINEERING AUDIT REPORT

**Date**: 2026-09-02  
**Auditor**: Principal Backend & Systems Architecture Reviewer  
**Repository**: `C:\Users\ASUS\Desktop\STUDY\PROJECTS\Luma`  
**Target Crates**: `luma-core`, `luma-storage`, `luma-reader`, `luma-search`, `luma-anchor`, `luma-security`, `luma-sync`, `luma-ai`, `luma-desktop` (src-tauri)  
**Status**: `AUDIT-FIRST COMPLETE`  

---

## 1. Executive Backend Assessment

Luma's backend is implemented as an **embedded local-first desktop application service layer in Rust**, interfacing with a React 19 / TypeScript frontend via **Tauri 2 capability-isolated IPC** and backed by a local **SQLite database operating in Write-Ahead Logging (WAL) mode** with **FTS5 full-text indexing**.

The system is **architecturally sound for its intended local-first single-user / multi-device desktop paradigm**, avoiding the severe failure modes of premature microservices, distributed transactions, or unneeded network middleware. The separation into domain crates (`luma-core`, `luma-anchor`, `luma-reader`, `luma-security`) and storage/orchestration services (`luma-storage`) establishes clear compile-time boundaries.

### Summary Verdict
- **Core Correctness**: **HIGH**. Document parsing, cryptographic hashing (streaming SHA-256), path traversal guards, zip-bomb heuristics, and annotation fuzzy anchoring are robust and independently tested.
- **Concurrency & WAL Separation**: **SOLID**. Dedicated reader (`PRAGMA query_only = ON`) and writer connections protect against lock contention and database corruptions during concurrent UI reads and background writes.
- **API & IPC Evolution**: **CLEAN**. 33 strongly typed Tauri IPC commands map directly to structured application services with typed error classification (`BackendError`).
- **Areas for Production Hardening**: Connection pool saturation under high concurrency, explicit database transaction rollback logging, background job worker queue persistence bounds, and IPC payload rate bounding.

---

## 2. Architecture Style

**Current Style**: **Modular Monolith (Embedded Native Engine)**.
- **Transport Layer**: Tauri 2 IPC Command Handlers (`apps/desktop/src-tauri/src/commands/*.rs`).
- **Application / Use Case Layer**: Service structs in `crates/luma-storage/src/services/*.rs` (`ImportService`, `LibraryService`, `AnnotationService`, `ReaderService`, `BackupService`, `MaintenanceService`, `DiagnosticsService`).
- **Domain Layer**: Strongly-typed entities and value objects in `crates/luma-core/src/models/*.rs` with immutable version tracking and ID types (`BookId`, `AnnotationId`, `DeviceId`).
- **Data Access Layer**: Repositories in `crates/luma-storage/src/repos/*.rs` utilizing parameterized SQL on `rusqlite`.
- **Infrastructure / Storage Edge**: SQLite WAL database (`luma.db`), filesystem sandbox (`FileService`), LRU memory cache (`CacheManager`), and in-process broadcast event bus (`EventBus`).

### Style Evaluation
- **Strengths**: Zero network latency overhead, zero cloud operational cost, memory safety guarantees via Rust, strict compile-time dependency inversion, atomic single-file SQLite database portability.
- **Costs**: Cross-platform file path quirks (Windows UNC/backslash normalization vs Unix slashes), single-process memory boundaries.
- **Boundary Quality**: High. Rust crate boundaries prevent `luma-core` or `luma-reader` from depending on `luma-storage` or `tauri`.
- **Operational Complexity**: Minimal. No external daemon or broker required.

---

## 3. Boundaries / Ownership & Layering

```text
IPC Handlers (apps/desktop/src-tauri/src/commands)
  ├── Input Parsing & Parameter Validation
  └── Delegation to Context Services (No business rules in handlers)
        ↓
Application Services (crates/luma-storage/src/services)
  ├── Orchestration, Workflows, Job Registration, Domain Events
  └── Transaction Boundaries (LibraryService, ImportService, BackupService)
        ↓
Domain Models & Core Engines (crates/luma-core, luma-anchor, luma-reader, luma-security)
  ├── Entities: Book, BookFile, Annotation, Bookmark, ReadingProgress
  ├── Invariants: Typed UUIDv7 IDs, SyncMetadata versioning, Multi-signal Anchoring
  └── Document Decoders: EPUB 3/2 XML-tree NAV, PDF BT...ET parser, Security Sanitizer
        ↓
Repositories & Persistence (crates/luma-storage/src/repos)
  ├── Parameterized SQL queries, CRUD operations, FTS5 updates
  └── Schema Migrations (V1, V2, V3 in migrations.rs)
        ↓
Infrastructure Edge (SQLite WAL + Sandboxed Filesystem)
```

---

## 4. Domain / Business Logic Audit

1. **Entity Invariants**:
   - `Book`: Requires a non-empty `title`, valid `DeviceId`, and initialized `SyncMetadata`. Trashed state (`trashed_at`) is isolated from soft deletion (`deleted_at`).
   - `BookFile`: Strongly associated to `BookId` with `ON DELETE CASCADE`. File hash (SHA-256) and exact byte length are strictly enforced.
   - `Annotation`: Contains quote, optional note, color hex, and JSON-serialized `anchor_payload`. Multi-signal fuzzy anchoring survives document reflows.
2. **Business Workflows**:
   - **Ingestion Pipeline**: Staging file -> SHA-256 calculation -> Duplicate detection (Exact vs Near) -> Metadata extraction -> Cover persistence -> Permanent library move -> SQLite commit -> FTS5 indexing -> Event emission.
   - **Backup & Restore**: Zip archive with strict JSON manifests, atomic extraction, and SHA-256 checksum verification.

---

## 5. Controllers / Handlers (Tauri IPC)

- **Audit Finding**: All 33 command handlers in `apps/desktop/src-tauri/src/commands/*.rs` are **strictly thin adapters**.
- **Execution Pattern**:
  ```rust
  #[tauri::command]
  pub async fn save_annotation(
      state: State<'_, LumaAppContext>,
      annotation: Annotation,
  ) -> std::result::Result<(), BackendError> {
      state.annotation_service
          .save_annotation(&annotation)
          .await
          .map_err(BackendError::from)
  }
  ```
- **Evaluation**: Zero direct SQL manipulation, zero business logic leaking into handlers, and 100% typed error translation via `BackendError`.

---

## 6. Data Access & Database Design

### SQLite Configuration & Concurrency Pragmas
- `PRAGMA foreign_keys = ON;` (Referential integrity enforced)
- `PRAGMA journal_mode = WAL;` (Concurrent readers during writes)
- `PRAGMA synchronous = NORMAL;` (High throughput with power-loss durability)
- `PRAGMA busy_timeout = 5000;` (5-second lock queue before error)
- `PRAGMA query_only = ON;` (Enforced on dedicated reader connection pool)
- `PRAGMA cache_size = -64000;` (64 MB page cache in memory)

### Schema & Indexing Inspection
- **`books`**: Primary key `id`. Indexes: `idx_books_title`, `idx_books_updated_at`, `idx_books_is_deleted`, `idx_books_reading_status`, `idx_books_library_state`.
- **`book_files`**: Foreign key to `books(id)` with `CASCADE`. Indexes: `idx_book_files_book_id`, `idx_book_files_hash`.
- **`annotations`**: Foreign key to `books(id)` with `CASCADE`. Indexes: `idx_annotations_book_id`, `idx_annotations_updated_at`.
- **`books_fts`**: Virtual FTS5 table with `unicode61` tokenizer for instant title, author, series, tag, and description search.

---

## 7. Concurrency, Transactions & Idempotency

1. **Transaction Boundaries**:
   - Multi-row operations (`bulk_add_tags`, `bulk_trash`, `import_single_file`, `restore_backup`) are wrapped in explicit `conn.transaction()?` blocks.
2. **Read/Write Pool Separation**:
   - `Database::with_read_conn` dispatches queries to `reader_conn` with `PRAGMA query_only = ON`, allowing concurrent UI rendering while background imports write to `writer_conn`.
3. **Idempotent Operations**:
   - Settings: `INSERT INTO settings ... ON CONFLICT(key) DO UPDATE`.
   - Tags & Collections: `INSERT OR IGNORE INTO book_tags`, `INSERT OR IGNORE INTO book_collections`.
   - Duplicate Imports: Exact duplicates return existing book entity without duplicate file duplication.

---

## 8. Background Jobs & Asynchronous Work

1. **`JobManager` Architecture**:
   - In-memory active job map (`Arc<RwLock<HashMap<String, ActiveJobState>>>`) paired with persistent SQLite job records (`background_jobs` table).
   - Cooperative cancellation tokens (`CancellationToken` using `AtomicBool`).
   - Granular progress reporting (`stage`, `completed_units`, `total_units`, `percent`, `message`).
2. **Event Bridge**:
   - Broadcast channel (`tokio::sync::broadcast`) bridges internal domain events (`DomainEvent::BookImported`, `DomainEvent::JobProgressUpdated`) to Tauri webview events (`app.emit(...)`).

---

## 9. Security, Validation & Threat Mitigation

1. **Path Traversal Mitigation**: `sanitize_relative_path` rejects `..`, absolute paths, and root drive prefixes.
2. **Zip Bomb Mitigation**: `verify_archive_safety` enforces max uncompressed size (500 MB), max entries (100,000), and max compression expansion ratio (100:1).
3. **HTML / SVG Sanitization**: `sanitize_untrusted_html` strips `<script>`, `<iframe>`, `<object>`, inline event handlers (`onload=`, `onerror=`), and `javascript:` URIs.
4. **Binary Resource Isolation**: `is_binary_resource` strictly guards binary assets (JPEG, WOFF2, TTF) from string/HTML processing.

---

## 10. Observability, Diagnostics & Health

1. **Structured Diagnostics**: `DiagnosticsService::run_diagnostics` evaluates health across:
   - **Database**: Version verification, entity counts, schema status.
   - **Filesystem**: Directory presence (`library`, `staging`, `covers`, `backups`).
   - **Search**: FTS5 table availability and indexed row count.
   - **Cache**: Cover, metadata, and search cache hit/miss metrics.
   - **Jobs**: Active and recent job execution records.
2. **Structured Logging**: `tracing` and `tracing-subscriber` with configurable `RUST_LOG` levels.

---

## 11. Testing & Quality Assurance Verification

- `cargo test --workspace` — **46 passed, 0 failed**.
- `cargo clippy --workspace --all-targets -- -D warnings` — **0 warnings**.
- `cargo check -p luma-core -p luma-anchor --target wasm32-unknown-unknown` — **0 errors**.
- `pnpm typecheck` — **7 packages clean**.
- `pnpm lint` — **0 errors**.
- `pnpm test` — **17 tests passed**.
- `pnpm build` — **Production bundle built cleanly**.

---

## 12. Detailed Forensic Findings Matrix

### Finding 1: Single Writer Mutex Lock Granularity
```text
ID: BE-FIND-01
Area: Database & Concurrency
Component: luma-storage::db::Database
Current State: Writer connection uses Arc<Mutex<rusqlite::Connection>> which locks during long write transactions.
Evidence: crates/luma-storage/src/db.rs:80
Requirement: Keep write transactions short and bounded to prevent thread starvation.
Problem: During large bulk imports, the writer lock is held for the duration of the batch if not chunked.
User Impact: Low in normal desktop usage; potentially noticeable UI delay if heavy background indexing blocks settings writes.
Security Impact: None.
Reliability Impact: Low (busy_timeout 5000ms mitigates lock collision).
Performance Impact: Medium during 100+ book bulk imports.
Maintainability Impact: Low.
Root Cause: SQLite single-writer constraint.
Recommended Direction: Batch imports in chunks of 25 items with yield points between transactions.
Implementation Complexity: Low.
Validation Method: cargo test --test test_concurrency_fitness
Priority: 🟡 MEDIUM
Owner: Storage / Core Team
```

### Finding 2: In-Memory EventBus Unbounded Receiver Queue
```text
ID: BE-FIND-02
Area: Messaging & Events
Component: luma-storage::events::EventBus
Current State: Uses tokio::sync::broadcast::channel(1024).
Evidence: crates/luma-storage/src/events/mod.rs:17
Requirement: Prevent lagging receivers from dropping critical UI events.
Problem: If webview is throttled or suspended, broadcast channel could return RecvError::Lagged.
User Impact: UI might miss a progress event if thousands of events are emitted in milliseconds.
Security Impact: None.
Reliability Impact: Low (Job progress updates throttled by file import speed).
Performance Impact: None.
Maintainability Impact: Low.
Root Cause: Default broadcast channel capacity.
Recommended Direction: Throttle high-frequency progress event publishing to 50ms intervals per job.
Implementation Complexity: Low.
Validation Method: Vitest UI event listener stress test.
Priority: 🔵 LOW
Owner: Infrastructure Team
```

---

## 13. Explicitly Rejected Complexity

1. **Distributed Microservices / gRPC / Remote Web Backend**: Completely rejected. Luma is an embedded local-first application where process distribution introduces severe operational latency and failure modes with zero benefits.
2. **Heavyweight ORMs (SeaORM / Diesel)**: Rejected in favor of pure, explicit, high-performance parameterized SQL with `rusqlite`.
3. **External Message Brokers (RabbitMQ / Redis / Kafka)**: Rejected. In-process Tokio broadcast and SQLite `background_jobs` table fulfill all local desktop asynchronous requirements.
4. **GraphQL / Complex Web API Gateways**: Rejected in favor of thin, type-safe Tauri 2 IPC commands with TypeScript interface mirroring.

---

## 14. Prioritized Backend Roadmap

1. **Phase 1 (Immediate Maintenance)**:
   - Chunk large batch imports (batches of 25) with cooperative yield points.
   - Add periodic WAL checkpoint execution to `MaintenanceService::vacuum_database`.
2. **Phase 2 (Sync Readiness - SYNC-01)**:
   - Expand `change_records` table integration across all mutation services for peer-to-peer and cloud backup synchronization.
3. **Phase 3 (Search Enhancement - SEARCH-01)**:
   - Add incremental document content indexing for EPUB/PDF chapter text in background jobs.
