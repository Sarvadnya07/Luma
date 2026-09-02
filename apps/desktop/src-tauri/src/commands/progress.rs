use std::str::FromStr;
use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_core::ids::BookId;
use luma_core::models::reading::ReadingProgress;

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

    let progress = ctx
        .progress_service
        .get_progress(&bid)
        .map_err(|e| {
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

    ctx
        .progress_service
        .save_progress(&progress)
        .map_err(|e| {
            error!(error = %e, "Failed to save reading progress");
            BackendError::from(e)
        })?;

    info!(PROGRESS_SAVED_MSG);
    Ok(())
}