use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::{BookId, BookmarkId, DeviceId};
use luma_core::models::reading::Bookmark;

use crate::context::LumaAppContext;

#[tauri::command]
pub fn list_bookmarks(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Vec<Bookmark>, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.bookmark_service
        .list_by_book(&bid)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn create_bookmark(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    locator: String,
    title: Option<String>,
    chapter_title: Option<String>,
    page_number: Option<u32>,
) -> Result<Bookmark, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.bookmark_service
        .create_bookmark(
            bid,
            locator,
            title,
            chapter_title,
            page_number,
            DeviceId::new(),
        )
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn delete_bookmark(
    ctx: State<'_, LumaAppContext>,
    bookmark_id: String,
) -> Result<(), BackendError> {
    let bmid = bookmark_id
        .parse::<BookmarkId>()
        .map_err(|_| BackendError::validation("Invalid bookmark_id format"))?;

    ctx.bookmark_service
        .delete_bookmark(&bmid, None)
        .map_err(BackendError::from)
}
