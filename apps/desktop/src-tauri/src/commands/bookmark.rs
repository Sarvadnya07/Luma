use std::str::FromStr;
use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_core::ids::{BookId, BookmarkId, DeviceId};
use luma_core::models::reading::Bookmark;

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised error messages
// ============================================================================

const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const INVALID_BOOKMARK_ID_MSG: &str = "Invalid bookmark_id format. Expected a valid BookmarkId.";
const BOOKMARK_CREATED_MSG: &str = "Bookmark created successfully.";
const BOOKMARK_DELETED_MSG: &str = "Bookmark deleted successfully.";

// ============================================================================
// Helpers
// ============================================================================

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

fn parse_bookmark_id(id: &str) -> Result<BookmarkId, BackendError> {
    BookmarkId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOKMARK_ID_MSG))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub fn list_bookmarks(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Vec<Bookmark>, BackendError> {
    let bid = parse_book_id(&book_id)?;
    debug!(?bid, "Listing bookmarks for book");

    let bookmarks = ctx
        .bookmark_service
        .list_by_book(&bid)
        .map_err(|e| {
            error!(error = %e, "Failed to list bookmarks");
            BackendError::from(e)
        })?;
    debug!(count = bookmarks.len(), "Retrieved bookmarks");
    Ok(bookmarks)
}

#[instrument(skip(ctx), fields(book_id = %book_id, locator = %locator, title = ?title, chapter_title = ?chapter_title, page_number = ?page_number))]
#[tauri::command]
pub fn create_bookmark(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    locator: String,
    title: Option<String>,
    chapter_title: Option<String>,
    page_number: Option<u32>,
) -> Result<Bookmark, BackendError> {
    let bid = parse_book_id(&book_id)?;
    let device_id = DeviceId::new();

    debug!(?bid, ?locator, "Creating bookmark");

    let bookmark = ctx
        .bookmark_service
        .create_bookmark(
            bid,
            locator,
            title,
            chapter_title,
            page_number,
            device_id,
        )
        .map_err(|e| {
            error!(error = %e, "Failed to create bookmark");
            BackendError::from(e)
        })?;
    info!(bookmark_id = %bookmark.id, BOOKMARK_CREATED_MSG);
    Ok(bookmark)
}

#[instrument(skip(ctx), fields(bookmark_id = %bookmark_id))]
#[tauri::command]
pub fn delete_bookmark(
    ctx: State<'_, LumaAppContext>,
    bookmark_id: String,
) -> Result<(), BackendError> {
    let bmid = parse_bookmark_id(&bookmark_id)?;
    debug!(?bmid, "Deleting bookmark");

    ctx
        .bookmark_service
        .delete_bookmark(&bmid, None)
        .map_err(|e| {
            error!(error = %e, "Failed to delete bookmark");
            BackendError::from(e)
        })?;
    info!(BOOKMARK_DELETED_MSG);
    Ok(())
}