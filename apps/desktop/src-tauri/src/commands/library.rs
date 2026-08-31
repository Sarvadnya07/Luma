use serde::Deserialize;
use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::{AuthorId, BookId, CollectionId, DeviceId};
use luma_core::models::book::{Book, DocumentFormat, LibraryState, ReadingStatus};
use luma_storage::repos::{LibraryFilterOptions, LibrarySortBy, LibrarySortOptions};
use luma_storage::services::{BookDetailViewData, BulkOperationResult};

use crate::context::LumaAppContext;

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
            format: f.format.and_then(|s| s.parse::<DocumentFormat>().ok()),
            reading_status: f
                .reading_status
                .and_then(|s| s.parse::<ReadingStatus>().ok()),
            library_state: f.library_state.and_then(|s| s.parse::<LibraryState>().ok()),
            author_id: f.author_id.and_then(|s| s.parse::<AuthorId>().ok()),
            series_id: f.series_id.and_then(|s| s.parse().ok()),
            tag_id: f.tag_id,
            collection_id: f.collection_id,
        }
    } else {
        LibraryFilterOptions::default()
    };

    let sort_opts = if let Some(s) = sort {
        let sort_by = match s.sort_by.to_lowercase().as_str() {
            "author" => LibrarySortBy::Author,
            "created_at" => LibrarySortBy::CreatedAt,
            "last_read_at" => LibrarySortBy::LastReadAt,
            "published_date" => LibrarySortBy::PublishedDate,
            "file_size" => LibrarySortBy::FileSize,
            _ => LibrarySortBy::Title,
        };
        LibrarySortOptions {
            sort_by,
            ascending: s.ascending,
        }
    } else {
        LibrarySortOptions::default()
    };

    ctx.library_service
        .list_books(
            &filter_opts,
            &sort_opts,
            page.unwrap_or(0),
            page_size.unwrap_or(100),
        )
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn get_book_details(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Option<BookDetailViewData>, BackendError> {
    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.library_service
        .get_book_details(&parsed_id)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn bulk_add_tags(
    ctx: State<'_, LumaAppContext>,
    payload: BulkTagPayload,
) -> Result<BulkOperationResult, BackendError> {
    let book_ids: Vec<BookId> = payload
        .book_ids
        .into_iter()
        .filter_map(|s| s.parse().ok())
        .collect();

    ctx.library_service
        .bulk_add_tags(&book_ids, &payload.tag_names, DeviceId::new())
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn bulk_add_to_collection(
    ctx: State<'_, LumaAppContext>,
    payload: BulkCollectionPayload,
) -> Result<BulkOperationResult, BackendError> {
    let col_id = payload
        .collection_id
        .parse::<CollectionId>()
        .map_err(|_| BackendError::validation("Invalid collection_id"))?;

    let book_ids: Vec<BookId> = payload
        .book_ids
        .into_iter()
        .filter_map(|s| s.parse().ok())
        .collect();

    ctx.library_service
        .bulk_add_to_collection(&col_id, &book_ids)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn bulk_trash_books(
    ctx: State<'_, LumaAppContext>,
    book_ids: Vec<String>,
) -> Result<BulkOperationResult, BackendError> {
    let parsed_ids: Vec<BookId> = book_ids
        .into_iter()
        .filter_map(|s| s.parse().ok())
        .collect();

    ctx.library_service
        .bulk_trash(&parsed_ids)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn bulk_set_reading_status(
    ctx: State<'_, LumaAppContext>,
    payload: BulkStatusPayload,
) -> Result<BulkOperationResult, BackendError> {
    let status = payload
        .status
        .parse::<ReadingStatus>()
        .map_err(|_| BackendError::validation("Invalid reading_status"))?;

    let parsed_ids: Vec<BookId> = payload
        .book_ids
        .into_iter()
        .filter_map(|s| s.parse().ok())
        .collect();

    ctx.library_service
        .bulk_set_status(&parsed_ids, status)
        .map_err(BackendError::from)
}
