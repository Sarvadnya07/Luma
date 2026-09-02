use std::str::FromStr;
use std::path::Path;
use tauri::State;
use tracing::{debug, error, info, instrument};

use base64::engine::Engine as _;
use base64::prelude::BASE64_STANDARD;
use serde::Deserialize;

use luma_core::error::BackendError;
use luma_core::ids::BookId;
use luma_core::models::book::ReadingStatus;
use luma_storage::services::UpdateBookMetadataRequest;
use luma_storage::repos::{BookRepository, BookFileRepository, CoverRepository};

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised error messages
// ============================================================================

const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const INVALID_READING_STATUS_MSG: &str = "Invalid reading_status. Expected one of: unread, reading, completed, want_to_read, on_hold, did_not_finish.";
const METADATA_UPDATED_MSG: &str = "Book metadata updated successfully.";
const READING_STATUS_UPDATED_MSG: &str = "Reading status updated successfully.";
const BOOK_TASHED_MSG: &str = "Book moved to trash successfully.";
const BOOK_RESTORED_MSG: &str = "Book restored from trash successfully.";
const BOOK_DELETED_MSG: &str = "Book permanently deleted successfully.";
const COVER_EXTRACTION_FAILED_MSG: &str = "Failed to extract cover from book file.";

// ============================================================================
// Payload Types
// ============================================================================

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

// ============================================================================
// Helpers
// ============================================================================

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

fn parse_reading_status(status: &str) -> Result<ReadingStatus, BackendError> {
    status
        .parse::<ReadingStatus>()
        .map_err(|_| BackendError::validation(INVALID_READING_STATUS_MSG))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub async fn update_book_metadata(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    metadata: UpdateBookMetadataPayload,
) -> Result<(), BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    debug!(?parsed_id, ?metadata, "Updating book metadata");

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
        .map_err(|e| {
            error!(error = %e, "Failed to update metadata");
            BackendError::from(e)
        })?;
    info!(METADATA_UPDATED_MSG);
    Ok(())
}

#[instrument(skip(ctx), fields(book_id = %book_id, status = %status))]
#[tauri::command]
pub async fn set_reading_status(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    status: String,
) -> Result<(), BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    let parsed_status = parse_reading_status(&status)?;
    debug!(?parsed_id, ?parsed_status, "Setting reading status");

    ctx.book_service
        .set_reading_status(&parsed_id, parsed_status)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to set reading status");
            BackendError::from(e)
        })?;
    info!(READING_STATUS_UPDATED_MSG);
    Ok(())
}

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub async fn trash_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<(), BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    debug!(?parsed_id, "Trashing book");

    ctx.book_service
        .trash_book(&parsed_id)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to trash book");
            BackendError::from(e)
        })?;
    info!(BOOK_TASHED_MSG);
    Ok(())
}

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub async fn restore_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<(), BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    debug!(?parsed_id, "Restoring book");

    ctx.book_service
        .restore_book(&parsed_id)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to restore book");
            BackendError::from(e)
        })?;
    info!(BOOK_RESTORED_MSG);
    Ok(())
}

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub async fn delete_book_permanently(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    _delete_files: bool, // Kept for compatibility; may be used in future
) -> Result<(), BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    debug!(?parsed_id, "Permanently deleting book");

    ctx.book_service
        .delete_book_permanently(&parsed_id)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to delete book permanently");
            BackendError::from(e)
        })?;
    info!(BOOK_DELETED_MSG);
    Ok(())
}

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub async fn get_book_cover_data_url(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Option<String>, BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    debug!(?parsed_id, "Fetching book cover");

    let book_repo = BookRepository::new(ctx.db.clone());
    let book = match book_repo.get_by_id(&parsed_id) {
        Ok(Some(b)) => b,
        Ok(None) => return Ok(None),
        Err(e) => {
            error!(error = %e, "Failed to fetch book from database");
            return Err(BackendError::storage(e.to_string()));
        }
    };

    // 1. If stored cover image file exists on disk
    if let Some(ref rel_path) = book.cover_image_path {
        let full_path = ctx.cover_store.get_cover_path(rel_path);
        if full_path.exists() {
            debug!(path = %full_path.display(), "Found stored cover");
            if let Ok(bytes) = std::fs::read(&full_path) {
                let ext = full_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("jpg");
                let mime = match ext {
                    "png" => "image/png",
                    "webp" => "image/webp",
                    _ => "image/jpeg",
                };
                let b64 = BASE64_STANDARD.encode(&bytes);
                return Ok(Some(format!("data:{};base64,{}", mime, b64)));
            }
        }
    }

    // 2. Fallback: on-demand extraction from book file
    debug!("No stored cover found; attempting extraction from file");
    let file_repo = BookFileRepository::new(ctx.db.clone());
    let files = file_repo
        .list_by_book_id(&parsed_id)
        .map_err(|e| {
            error!(error = %e, "Failed to list book files");
            BackendError::storage(e.to_string())
        })?;

    if let Some(first_file) = files.first() {
        let file_path = Path::new(&first_file.relative_path);
        if file_path.exists() {
            debug!(path = %file_path.display(), "Extracting cover from file");
            let cover_opt = match first_file.format {
                luma_core::models::book::DocumentFormat::Epub => {
                    luma_reader::extractors::EpubExtractor::extract(file_path)
                        .ok()
                        .and_then(|pkg| pkg.cover)
                }
                luma_core::models::book::DocumentFormat::Pdf => {
                    luma_reader::extractors::PdfExtractor::extract(file_path)
                        .ok()
                        .and_then(|pkg| pkg.cover)
                }
                _ => None,
            };

            if let Some(cover) = cover_opt {
                debug!("Cover extracted, saving to store");
                // Save cover
                let saved_cover = ctx
                    .cover_store
                    .save_cover(Some(book.id), &cover.data, &cover.mime_type)
                    .map_err(|e| {
                        error!(error = %e, "Failed to save extracted cover");
                        BackendError::storage(e.to_string())
                    })?;

                // Update cover repository and book record
                let cover_repo = CoverRepository::new(ctx.db.clone());
                cover_repo
                    .insert(&saved_cover)
                    .map_err(|e| {
                        error!(error = %e, "Failed to insert cover record");
                        BackendError::storage(e.to_string())
                    })?;

                let mut updated_book = book.clone();
                updated_book.cover_image_id = Some(saved_cover.id);
                updated_book.cover_image_path = Some(saved_cover.relative_path);
                book_repo
                    .update(&updated_book)
                    .map_err(|e| {
                        error!(error = %e, "Failed to update book with cover");
                        BackendError::storage(e.to_string())
                    })?;

                let b64 = BASE64_STANDARD.encode(&cover.data);
                return Ok(Some(format!("data:{};base64,{}", cover.mime_type, b64)));
            } else {
                debug!(COVER_EXTRACTION_FAILED_MSG);
            }
        } else {
            debug!(path = %file_path.display(), "Book file does not exist");
        }
    }


    debug!("No cover found");
    Ok(None)
}