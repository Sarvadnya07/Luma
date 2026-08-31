# Luma Backend Services Architecture

## Overview
Luma's backend is a local-first, native application service layer embedded directly inside the Tauri 2 desktop shell using Rust, SQLite with WAL mode, and a bounded file staging area. It adheres strictly to desktop-first local computing without remote HTTP backends, auth microservices, or external database engines.

```
┌─────────────────────────────────────────────────────────────┐
│                   React Frontend UI                         │
│   (Reader, Library, Collections, Annotations, Settings)     │
└───────────────────────────┬─────────────────────────────────┘
                            │ Tauri IPC (Commands & Events)
┌───────────────────────────▼─────────────────────────────────┐
│                    Tauri Command Layer                      │
│   (Thin Adapters: library, books, import, reader, etc.)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     LumaAppContext                          │
├─────────────────────────────────────────────────────────────┤
│  • LibraryService         • ReaderService                   │
│  • BookService            • BookmarkService                 │
│  • ImportService          • AnnotationService               │
│  • ReadingProgressService • SearchService                   │
│  • SettingsService        • BackupService                   │
│  • MaintenanceService     • DiagnosticsService              │
├─────────────────────────────────────────────────────────────┤
│  • EventBus (Domain Events & Webview Bridge)                │
│  • JobManager (Cooperative Cancellation & Persistence)      │
│  • CacheManager (LRU Bounded Memory Caches)                 │
│  • FileService (Sandbox Roots, Atomic Staging, SHA-256)     │
│  • Database (SQLite WAL, Busy Timeout, Foreign Keys)        │
└─────────────────────────────────────────────────────────────┘
```

## Core Subsystems

### 1. Database & Migrations
- SQLite configured with `PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`, and `PRAGMA busy_timeout = 5000;`.
- Schema Versioning:
  - **V1**: Books, Files, Authors, Series, Tags, Collections, Sync tracking.
  - **V2**: In-document Reading Progress, Bookmarks, Highlights, Anchors.
  - **V3 (Backend-01)**: Key-value `settings`, `backup_records`, and `background_jobs` table.

### 2. Domain Event Bus & Tauri Bridge
- Rust `tokio::sync::broadcast` channel delivering strongly-typed `DomainEvent` variants.
- Event Bridge forwards domain events to the frontend via `luma://...` channels:
  - `luma://library/book-imported`
  - `luma://library/book-updated`
  - `luma://library/state-changed`
  - `luma://annotation/changed`
  - `luma://reading/progress-changed`
  - `luma://job/progress`
  - `luma://settings/changed`
  - `luma://backup/completed`

### 3. Background Job Subsystem
- In-memory `active_jobs` table with `CancellationToken` for responsive cooperative cancellation.
- SQLite persistence in `background_jobs` for durability and recent job history.
- Real-time progress updates with percentage calculation and status transitions (`queued` -> `running` -> `completed` / `failed` / `cancelled`).

### 4. Bounded In-Memory Caches
- `BoundedCache<K, V>` with LRU capacity limits and TTL expiration.
- Managed by `CacheManager`:
  - `cover_cache` (max 500 items, 1-hour TTL)
  - `metadata_cache` (max 200 items, 30-min TTL)
  - `search_queries` (max 100 items, 5-min TTL)
- Event-driven automatic cache invalidation on book updates or library mutations.

### 5. Secure Filesystem & File Staging Service
- Sandboxed directory roots: `library/`, `covers/`, `staging/`, `backups/`, `exports/`.
- Safe temporary staging (`StagedFile`) with automatic RAII cleanup upon abort.
- SHA-256 verification and atomic rename into canonical library storage.

### 6. Thin Tauri Command Handlers
- All Tauri handlers validate inputs, invoke services via `LumaAppContext`, map internal errors into structured `BackendError` DTOs, and emit domain events without embedding business logic inside commands.
