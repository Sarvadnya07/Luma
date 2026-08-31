use serde::Deserialize;
use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::BookId;
use luma_core::models::book::ReadingStatus;
use luma_storage::services::UpdateBookMetadataRequest;

use crate::context::LumaAppContext;

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBookMetadataPayload {
    pub title: String,
    pub subtitle: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub published_date: Option<String>,
    pub language: Option<String>,
    pub isbn: Option<String>,
}

#[tauri::command]
pub async fn update_book_metadata(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    metadata: UpdateBookMetadataPayload,
) -> Result<(), BackendError> {
    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    let req = UpdateBookMetadataRequest {
        title: metadata.title,
        subtitle: metadata.subtitle,
        description: metadata.description,
        publisher: metadata.publisher,
        published_date: metadata.published_date,
        language: metadata.language,
        isbn: metadata.isbn,
    };

    ctx.book_service
        .update_metadata(&parsed_id, req)
        .await
        .map(|_| ())
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn set_reading_status(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    status: String,
) -> Result<(), BackendError> {
    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;
    let parsed_status = status
        .parse::<ReadingStatus>()
        .map_err(|_| BackendError::validation("Invalid reading_status"))?;

    ctx.book_service
        .set_reading_status(&parsed_id, parsed_status)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn trash_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<(), BackendError> {
    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.book_service
        .trash_book(&parsed_id)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn restore_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<(), BackendError> {
    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.book_service
        .restore_book(&parsed_id)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn delete_book_permanently(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    _delete_files: bool,
) -> Result<(), BackendError> {
    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.book_service
        .delete_book_permanently(&parsed_id)
        .await
        .map_err(BackendError::from)
}
