use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::BookId;
use luma_core::models::reading::ReadingProgress;

use crate::context::LumaAppContext;

#[tauri::command]
pub fn get_reading_progress(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Option<ReadingProgress>, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.progress_service
        .get_progress(&bid)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn save_reading_progress(
    ctx: State<'_, LumaAppContext>,
    progress: ReadingProgress,
) -> Result<(), BackendError> {
    ctx.progress_service
        .save_progress(&progress)
        .map_err(BackendError::from)
}
