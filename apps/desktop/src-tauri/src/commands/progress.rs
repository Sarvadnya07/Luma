use std::str::FromStr;
use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_core::ids::{BookId, DeviceId, SessionId};
use luma_core::models::reading::{ReadingProgress, ReadingSession};
use luma_storage::repos::{ReadingAnalytics, ReadingSessionRepository};

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages
// ============================================================================

const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const PROGRESS_RETRIEVED_MSG: &str = "Reading progress retrieved successfully.";
const PROGRESS_SAVED_MSG: &str = "Reading progress saved successfully.";
const PROGRESS_NOT_FOUND_MSG: &str = "No reading progress found for this book.";

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub fn get_reading_progress(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Option<ReadingProgress>, BackendError> {
    let bid = parse_book_id(&book_id)?;
    debug!(?bid, "Getting reading progress");

    let progress = ctx.progress_service.get_progress(&bid).map_err(|e| {
        error!(error = %e, "Failed to get reading progress");
        BackendError::from(e)
    })?;

    if progress.is_some() {
        debug!(PROGRESS_RETRIEVED_MSG);
    } else {
        debug!(PROGRESS_NOT_FOUND_MSG);
    }
    Ok(progress)
}

#[instrument(skip(ctx, progress), fields(book_id = %progress.book_id, percentage = progress.progress_percentage))]
#[tauri::command]
pub fn save_reading_progress(
    ctx: State<'_, LumaAppContext>,
    progress: ReadingProgress,
) -> Result<(), BackendError> {
    debug!(?progress, "Saving reading progress");

    ctx.progress_service.save_progress(&progress).map_err(|e| {
        error!(error = %e, "Failed to save reading progress");
        BackendError::from(e)
    })?;

    info!(PROGRESS_SAVED_MSG);
    Ok(())
}

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub fn start_reading_session(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    start_progress: f32,
) -> Result<ReadingSession, BackendError> {
    let bid = parse_book_id(&book_id)?;
    let dev_id = DeviceId::new();
    let session = ReadingSession::start(bid, dev_id, start_progress);
    debug!(session_id = %session.id, "Starting reading session");

    let repo = ReadingSessionRepository::new(ctx.db.clone());
    repo.insert(&session).map_err(|e| {
        error!(error = %e, "Failed to record start of reading session");
        BackendError::storage(e.to_string())
    })?;

    info!(session_id = %session.id, "Reading session started");
    Ok(session)
}

#[instrument(skip(ctx), fields(session_id = %session_id))]
#[tauri::command]
pub fn complete_reading_session(
    ctx: State<'_, LumaAppContext>,
    session_id: String,
    end_progress: f32,
    duration_seconds: u32,
) -> Result<(), BackendError> {
    let sid: SessionId = session_id
        .parse()
        .map_err(|_| BackendError::validation("Invalid session_id format"))?;
    debug!(session_id = %sid, duration = duration_seconds, "Completing reading session");

    let repo = ReadingSessionRepository::new(ctx.db.clone());
    repo.complete_session(&sid, end_progress, duration_seconds)
        .map_err(|e| {
            error!(error = %e, "Failed to complete reading session");
            BackendError::storage(e.to_string())
        })?;

    info!(session_id = %sid, "Reading session completed");
    Ok(())
}

#[instrument(skip(ctx))]
#[tauri::command]
pub fn get_reading_analytics(
    ctx: State<'_, LumaAppContext>,
) -> Result<ReadingAnalytics, BackendError> {
    debug!("Aggregating reading analytics");
    let repo = ReadingSessionRepository::new(ctx.db.clone());
    repo.get_analytics().map_err(|e| {
        error!(error = %e, "Failed to compute reading analytics");
        BackendError::storage(e.to_string())
    })
}
