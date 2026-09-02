use std::str::FromStr;
use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_core::ids::{BookId, FileId};
use luma_reader::{ChapterContent, DocumentSearchMatch, PdfPageData};
use luma_storage::services::OpenDocumentResult;

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages
// ============================================================================

const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const INVALID_FILE_ID_MSG: &str = "Invalid file_id format. Expected a valid FileId.";
const DOCUMENT_OPENED_MSG: &str = "Document opened successfully.";
const CHAPTER_RETRIEVED_MSG: &str = "Chapter retrieved successfully.";
const PDF_PAGE_RETRIEVED_MSG: &str = "PDF page retrieved successfully.";
const DOCUMENT_SEARCHED_MSG: &str = "Document search completed successfully.";
const FILE_BYTES_RETRIEVED_MSG: &str = "File bytes retrieved successfully.";

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

fn parse_file_id(id: &str) -> Result<FileId, BackendError> {
    FileId::from_str(id).map_err(|_| BackendError::validation(INVALID_FILE_ID_MSG))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(book_id = %book_id, file_id = ?file_id))]
#[tauri::command]
pub async fn open_reader_document(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    file_id: Option<String>,
) -> Result<OpenDocumentResult, BackendError> {
    let bid = parse_book_id(&book_id)?;
    let fid = file_id
        .map(|s| parse_file_id(&s))
        .transpose()?;

    debug!(?bid, ?fid, "Opening reader document");

    let result = ctx
        .reader_service
        .open_document(&bid, fid.as_ref())
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to open document");
            BackendError::from(e)
        })?;

    info!(file_format = %result.file.format, total_pages = result.total_pages_or_spines, DOCUMENT_OPENED_MSG);
    Ok(result)
}

#[instrument(skip(ctx), fields(book_id = %book_id, spine_index = spine_index))]
#[tauri::command]
pub async fn get_reader_chapter(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    spine_index: usize,
) -> Result<ChapterContent, BackendError> {
    let bid = parse_book_id(&book_id)?;
    debug!(?bid, spine_index, "Retrieving chapter");

    let chapter = ctx
        .reader_service
        .get_chapter(&bid, spine_index)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to retrieve chapter");
            BackendError::from(e)
        })?;

    info!(chapter_title = %chapter.title, spine_index, CHAPTER_RETRIEVED_MSG);
    Ok(chapter)
}

#[instrument(skip(ctx), fields(book_id = %book_id, page_number = page_number))]
#[tauri::command]
pub async fn get_reader_pdf_page(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    page_number: u32,
) -> Result<PdfPageData, BackendError> {
    let bid = parse_book_id(&book_id)?;
    debug!(?bid, page_number, "Retrieving PDF page");

    let page = ctx
        .reader_service
        .get_pdf_page(&bid, page_number)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to retrieve PDF page");
            BackendError::from(e)
        })?;

    info!(page_number, PDF_PAGE_RETRIEVED_MSG);
    Ok(page)
}

#[instrument(skip(ctx), fields(book_id = %book_id, query = %query))]
#[tauri::command]
pub async fn search_document(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    query: String,
) -> Result<Vec<DocumentSearchMatch>, BackendError> {
    let bid = parse_book_id(&book_id)?;
    debug!(?bid, ?query, "Searching document");

    let matches = ctx
        .reader_service
        .search_document(&bid, &query)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to search document");
            BackendError::from(e)
        })?;

    info!(match_count = matches.len(), DOCUMENT_SEARCHED_MSG);
    Ok(matches)
}

#[instrument(skip(ctx), fields(book_id = %book_id, file_id = ?file_id))]
#[tauri::command]
pub fn get_book_file_bytes(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    file_id: Option<String>,
) -> Result<Vec<u8>, BackendError> {
    let bid = parse_book_id(&book_id)?;
    let fid = file_id
        .map(|s| parse_file_id(&s))
        .transpose()?;

    debug!(?bid, ?fid, "Retrieving file bytes");

    let bytes = ctx
        .reader_service
        .get_file_bytes(&bid, fid.as_ref())
        .map_err(|e| {
            error!(error = %e, "Failed to retrieve file bytes");
            BackendError::from(e)
        })?;

    info!(bytes_len = bytes.len(), FILE_BYTES_RETRIEVED_MSG);
    Ok(bytes)
}