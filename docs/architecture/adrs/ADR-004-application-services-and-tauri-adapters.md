# ADR-004: Application Service Layer & Thin Tauri Adapters

## Status
Accepted

## Context
In previous revisions of Luma, Tauri commands directly instantiated ad-hoc database queries or monolithic service objects, creating tight coupling between desktop transport and core business logic.

## Decision
1. Introduce standalone application service structs (`LibraryService`, `BookService`, `ImportService`, `ReaderService`, `ReadingProgressService`, `BookmarkService`, `AnnotationService`, `SearchService`, `SettingsService`, `BackupService`, `MaintenanceService`, `DiagnosticsService`) inside `crates/luma-storage/src/services/`.
2. Manage all services centrally through `LumaAppContext` registered in Tauri state.
3. Keep all Tauri command functions strictly thin: validate incoming parameters, forward requests to `LumaAppContext` services, and return typed `Result<T, BackendError>`.
4. Ensure domain models in `luma-core` and `luma-anchor` remain pure and compile to `wasm32-unknown-unknown`.

## Consequences
- **Positive**: Clean separation of concerns, testable application services without Tauri runtime dependencies, deterministic error contracts with error codes.
- **Negative**: Additional layer of indirection and DTO mapping.
