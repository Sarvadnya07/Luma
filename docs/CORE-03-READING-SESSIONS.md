# LUMA — CORE-03 READING SESSIONS & ANALYTICS ENGINE
## Reading Sessions Persistence, Real Database Aggregation & Synthetic Data Elimination

**Status**: P1 RESOLVED & TESTED  
**Date**: 2026-09-06  

---

### 1. Problem Statement & Reality Audit Findings

In CORE-02, the feature reality audit discovered that:
1. The `reading_sessions` database table existed in SQLite migrations, but was never queried or written to by any service or UI flow.
2. `ReadingIntelligenceDashboard.tsx` and `LibraryView.tsx` displayed synthetic mock data:
   - Bar chart: `timeFocusData: [45, 60, 30, 80, 70, 90]`
   - Heatmap: `weeks = [[1, 2, 0, 3, 2, 4, 1], [2, 3, 1, 0, 2, 3, 2], ...]`
   - Weekly Focus: `hours: Math.max(1.5, books.length * 1.2)`, `change: "+2.4 Hours"`
   - Recent Sessions: Static dummy progress percentages (`25`, `50`) and mock timestamps.

This created the false appearance of reading intelligence while operating completely disconnected from real user activity.

---

### 2. Architecture & Implementation

#### 2.1 Repository & Analytics Engine (`crates/luma-storage/src/repos/session_repo.rs`)
- `ReadingSessionRepository`:
  - `insert`: Records session start with `id`, `book_id`, `device_id`, `started_at`, and initial progress percentage.
  - `complete_session`: Finalizes session with `ended_at`, calculated `duration_seconds`, and ending progress percentage.
  - `list_by_book`: Lists session history for a specific book.
  - `list_recent`: Queries recent reading sessions joined with `books` and `authors`.
  - `get_analytics`: Computes real, live database metrics:
    1. `total_reading_time_seconds`: Total cumulative seconds spent reading across all books.
    2. `weekly_reading_seconds`: Total reading time during the trailing 7 days (`started_at >= datetime('now', '-7 days')`).
    3. `books_completed_count`: Actual count of books marked completed or with progress >= 99%.
    4. `daily_reading_minutes_last_28_days`: 28-day calendar array (4 complete weeks) with actual daily minutes and intensity classification (0: 0m, 1: 1-15m, 2: 16-30m, 3: 31-60m, 4: >60m).
    5. `time_focus_data`: Actual daily minutes for the last 6 recorded days.

#### 2.2 Tauri IPC Commands (`apps/desktop/src-tauri/src/commands/progress.rs`)
- `start_reading_session(book_id, start_progress)`: Initiates session record in SQLite.
- `complete_reading_session(session_id, end_progress, duration_seconds)`: Finalizes session record.
- `get_reading_analytics()`: Returns aggregated `ReadingAnalytics`.

#### 2.3 Runtime Lifecycle Wiring (`apps/desktop/src/state/readerState.ts`)
- `openBook()`: Calls `api.startReadingSession(book.id, startProgress)` and tracks `activeSessionId` and `sessionStartTime`.
- `closeReader()`: Calculates elapsed reading duration, fetches current progress percentage, and calls `api.completeReadingSession(activeSessionId, endProgress, durationSeconds)`.

#### 2.4 Frontend Dashboard Wiring (`apps/desktop/src/features/library/LibraryView.tsx`)
- All synthetic constants (`[45, 60, 30, 80, 70, 90]`, mock weeks, and artificial multipliers) have been removed.
- The `history` tab loads live metrics from `LumaApi.getReadingAnalytics()`, rendering real heatmaps and focus times directly from SQLite session history.
