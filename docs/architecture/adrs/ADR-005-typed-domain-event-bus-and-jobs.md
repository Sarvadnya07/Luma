# ADR-005: Typed Domain Event Bus & Background Jobs

## Status
Accepted

## Context
Long-running operations (batch imports, directory scans, library indexing) and cross-cutting notifications (cache invalidation, UI state synchronization) required an asynchronous, non-blocking mechanism within the desktop application.

## Decision
1. Implement an in-process `EventBus` leveraging Tokio broadcast channels with strongly typed `DomainEvent` variants.
2. Build an async `JobManager` supporting cooperative cancellation via `CancellationToken`, atomic progress stage reporting, persistence in SQLite `background_jobs`, and automatic domain event emission.
3. Bridge `DomainEvent` directly to the frontend webview via `app.emit("luma://...")` channels.

## Consequences
- **Positive**: Real-time progress updates, cooperative non-destructive job cancellation, resilient cache invalidation, decoupled cross-service side effects.
- **Negative**: Async runtime management required for background tasks and event listeners.
