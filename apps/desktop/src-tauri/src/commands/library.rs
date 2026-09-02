use std::str::FromStr;
use serde::Deserialize;
use tauri::State;
use tracing::{debug, error, info, instrument, warn};

use luma_core::error::BackendError;
use luma_core::ids::{AuthorId, BookId, CollectionId, DeviceId, SeriesId};
use luma_core::models::book::{Book, DocumentFormat, LibraryState, ReadingStatus};
use luma_storage::repos::{LibraryFilterOptions, LibrarySortBy, LibrarySortOptions};
use luma_storage::services::{BookDetailViewData, BulkOperationResult};

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages and configuration
// ============================================================================

const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const INVALID_COLLECTION_ID_MSG: &str = "Invalid collection_id format. Expected a valid CollectionId.";
const INVALID_READING_STATUS_MSG: &str = "Invalid reading_status format. Expected one of: unread, reading, completed, want_to_read, on_hold, did_not_finish.";
const INVALID_AUTHOR_ID_MSG: &str = "Invalid author_id format. Expected a valid AuthorId.";
const INVALID_SERIES_ID_MSG: &str = "Invalid series_id format. Expected a valid SeriesId.";
const INVALID_LIBRARY_STATE_MSG: &str = "Invalid library_state format. Expected 'active' or 'trashed'.";
const INVALID_FORMAT_MSG: &str = "Invalid format. Expected one of: epub, pdf, cbz, cbr, txt, md, html, htm.";

const BOOKS_LISTED_MSG: &str = "Books listed successfully.";
const BOOK_DETAILS_RETRIEVED_MSG: &str = "Book details retrieved successfully.";
const BULK_TAGS_ADDED_MSG: &str = "Bulk tags added successfully.";
const BULK_COLLECTION_ADDED_MSG: &str = "Bulk books added to collection successfully.";
const BULK_TRASHED_MSG: &str = "Bulk books trashed successfully.";
const BULK_STATUS_UPDATED_MSG: &str = "Bulk reading status updated successfully.";

const DEFAULT_PAGE: usize = 0;
const DEFAULT_PAGE_SIZE: usize = 100;

// ============================================================================
// Payload Types
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryFilterPayload {
    pub search_query: Option<String>,
    pub format: Option<String>,
    pub reading_status: Option<String>,
    pub library_state: Option<String>,
    pub author_id: Option<String>,
    pub series_id: Option<String>,
    pub tag_id: Option<String>,
    pub collection_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibrarySortPayload {
    pub sort_by: String,
    pub ascending: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkTagPayload {
    pub book_ids: Vec<String>,
    pub tag_names: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkCollectionPayload {
    pub collection_id: String,
    pub book_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkStatusPayload {
    pub book_ids: Vec<String>,
    pub status: String,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

fn parse_collection_id(id: &str) -> Result<CollectionId, BackendError> {
    CollectionId::from_str(id).map_err(|_| BackendError::validation(INVALID_COLLECTION_ID_MSG))
}

fn parse_author_id(id: &str) -> Result<AuthorId, BackendError> {
    AuthorId::from_str(id).map_err(|_| BackendError::validation(INVALID_AUTHOR_ID_MSG))
}

fn parse_series_id(id: &str) -> Result<SeriesId, BackendError> {
    SeriesId::from_str(id).map_err(|_| BackendError::validation(INVALID_SERIES_ID_MSG))
}

fn parse_reading_status(status: &str) -> Result<ReadingStatus, BackendError> {
    status.parse::<ReadingStatus>().map_err(|_| BackendError::validation(INVALID_READING_STATUS_MSG))
}

fn parse_library_state(state: &str) -> Result<LibraryState, BackendError> {
    state.parse::<LibraryState>().map_err(|_| BackendError::validation(INVALID_LIBRARY_STATE_MSG))
}

fn parse_format(format: &str) -> Result<DocumentFormat, BackendError> {
    format.parse::<DocumentFormat>().map_err(|_| BackendError::validation(INVALID_FORMAT_MSG))
}

fn parse_sort_by(sort: &str) -> LibrarySortBy {
    match sort.to_lowercase().as_str() {
        "author" => LibrarySortBy::Author,
        "created_at" => LibrarySortBy::CreatedAt,
        "last_read_at" => LibrarySortBy::LastReadAt,
        "published_date" => LibrarySortBy::PublishedDate,
        "file_size" => LibrarySortBy::FileSize,
        _ => LibrarySortBy::Title,
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(filter = ?filter, sort = ?sort, page = ?page, page_size = ?page_size))]
#[tauri::command]
pub fn list_books(
    ctx: State<'_, LumaAppContext>,
    filter: Option<LibraryFilterPayload>,
    sort: Option<LibrarySortPayload>,
    page: Option<usize>,
    page_size: Option<usize>,
) -> Result<Vec<Book>, BackendError> {
    let filter_opts = if let Some(f) = filter {
        LibraryFilterOptions {
            search_query: f.search_query,
            format: f.format.and_then(|s| parse_format(&s).ok()),
            reading_status: f.reading_status.and_then(|s| parse_reading_status(&s).ok()),
            library_state: f.library_state.and_then(|s| parse_library_state(&s).ok()),
            author_id: f.author_id.and_then(|s| parse_author_id(&s).ok()),
            series_id: f.series_id.and_then(|s| parse_series_id(&s).ok()),
            tag_id: f.tag_id,
            collection_id: f.collection_id,
        }
    } else {
        LibraryFilterOptions::default()
    };

    let sort_opts = if let Some(s) = sort {
        LibrarySortOptions {
            sort_by: parse_sort_by(&s.sort_by),
            ascending: s.ascending,
        }
    } else {
        LibrarySortOptions::default()
    };

    let page = page.unwrap_or(DEFAULT_PAGE);
    let page_size = page_size.unwrap_or(DEFAULT_PAGE_SIZE);

    debug!(?filter_opts, ?sort_opts, page, page_size, "Listing books");

    let books = ctx.library_service
        .list_books(&filter_opts, &sort_opts, page, page_size)
        .map_err(|e| {
            error!(error = %e, "Failed to list books");
            BackendError::from(e)
        })?;

    debug!(count = books.len(), BOOKS_LISTED_MSG);
    Ok(books)
}

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub fn get_book_details(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Option<BookDetailViewData>, BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    debug!(?parsed_id, "Getting book details");

    let details = ctx.library_service
        .get_book_details(&parsed_id)
        .map_err(|e| {
            error!(error = %e, "Failed to get book details");
            BackendError::from(e)
        })?;

    if details.is_some() {
        debug!(BOOK_DETAILS_RETRIEVED_MSG);
    } else {
        debug!("Book not found");
    }
    Ok(details)
}

#[instrument(skip(ctx), fields(book_count = payload.book_ids.len(), tag_count = payload.tag_names.len()))]
#[tauri::command]
pub fn bulk_add_tags(
    ctx: State<'_, LumaAppContext>,
    payload: BulkTagPayload,
) -> Result<BulkOperationResult, BackendError> {
    debug!("Adding tags in bulk");

    let book_ids: Vec<BookId> = payload
        .book_ids
        .into_iter()
        .filter_map(|s| {
            match parse_book_id(&s) {
                Ok(id) => Some(id),
                Err(e) => {
                    warn!(book_id = %s, error = %e, "Invalid book_id skipped in bulk operation");
                    None
                }
            }
        })
        .collect();

    if book_ids.is_empty() {
        return Err(BackendError::validation("No valid book IDs provided"));
    }

    let result = ctx.library_service
        .bulk_add_tags(&book_ids, &payload.tag_names, DeviceId::new())
        .map_err(|e| {
            error!(error = %e, "Failed to bulk add tags");
            BackendError::from(e)
        })?;

    info!(BULK_TAGS_ADDED_MSG);
    Ok(result)
}

#[instrument(skip(ctx), fields(collection_id = %payload.collection_id, book_count = payload.book_ids.len()))]
#[tauri::command]
pub fn bulk_add_to_collection(
    ctx: State<'_, LumaAppContext>,
    payload: BulkCollectionPayload,
) -> Result<BulkOperationResult, BackendError> {
    let col_id = parse_collection_id(&payload.collection_id)?;
    debug!(?col_id, "Adding books to collection in bulk");

    let book_ids: Vec<BookId> = payload
        .book_ids
        .into_iter()
        .filter_map(|s| match parse_book_id(&s) {
            Ok(id) => Some(id),
            Err(e) => {
                warn!(book_id = %s, error = %e, "Invalid book_id skipped in bulk operation");
                None
            }
        })
        .collect();

    if book_ids.is_empty() {
        return Err(BackendError::validation("No valid book IDs provided"));
    }

    let result = ctx.library_service
        .bulk_add_to_collection(&col_id, &book_ids)
        .map_err(|e| {
            error!(error = %e, "Failed to bulk add to collection");
            BackendError::from(e)
        })?;

    info!(BULK_COLLECTION_ADDED_MSG);
    Ok(result)
}

#[instrument(skip(ctx), fields(book_count = book_ids.len()))]
#[tauri::command]
pub fn bulk_trash_books(
    ctx: State<'_, LumaAppContext>,
    book_ids: Vec<String>,
) -> Result<BulkOperationResult, BackendError> {
    let parsed_ids: Vec<BookId> = book_ids
        .into_iter()
        .filter_map(|s| match parse_book_id(&s) {
            Ok(id) => Some(id),
            Err(e) => {
                warn!(book_id = %s, error = %e, "Invalid book_id skipped in bulk operation");
                None
            }
        })
        .collect();

    if parsed_ids.is_empty() {
        return Err(BackendError::validation("No valid book IDs provided"));
    }

    let result = ctx.library_service
        .bulk_trash(&parsed_ids)
        .map_err(|e| {
            error!(error = %e, "Failed to bulk trash books");
            BackendError::from(e)
        })?;

    info!(BULK_TRASHED_MSG);
    Ok(result)
}

#[instrument(skip(ctx), fields(book_count = payload.book_ids.len()))]
#[tauri::command]
pub fn bulk_set_reading_status(
    ctx: State<'_, LumaAppContext>,
    payload: BulkStatusPayload,
) -> Result<BulkOperationResult, BackendError> {
    let status = parse_reading_status(&payload.status)?;
    let parsed_ids: Vec<BookId> = payload
        .book_ids
        .into_iter()
        .filter_map(|s| match parse_book_id(&s) {
            Ok(id) => Some(id),
            Err(e) => {
                warn!(book_id = %s, error = %e, "Invalid book_id skipped in bulk operation");
                None
            }
        })
        .collect();

    if parsed_ids.is_empty() {
        return Err(BackendError::validation("No valid book IDs provided"));
    }

    let result = ctx.library_service
        .bulk_set_status(&parsed_ids, status)
        .map_err(|e| {
            error!(error = %e, "Failed to bulk set reading status");
            BackendError::from(e)
        })?;

    info!(BULK_STATUS_UPDATED_MSG);
    Ok(result)
}