use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::{BookId, FileId};
use luma_reader::{ChapterContent, DocumentSearchMatch, PdfPageData};
use luma_storage::services::OpenDocumentResult;

use crate::context::LumaAppContext;

#[tauri::command]
pub async fn open_reader_document(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    file_id: Option<String>,
) -> Result<OpenDocumentResult, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;
    let fid = file_id.and_then(|s| s.parse::<FileId>().ok());

    ctx.reader_service
        .open_document(&bid, fid.as_ref())
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn get_reader_chapter(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    spine_index: usize,
) -> Result<ChapterContent, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.reader_service
        .get_chapter(&bid, spine_index)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn get_reader_pdf_page(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    page_number: u32,
) -> Result<PdfPageData, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.reader_service
        .get_pdf_page(&bid, page_number)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn search_document(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    query: String,
) -> Result<Vec<DocumentSearchMatch>, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.reader_service
        .search_document(&bid, &query)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn get_book_file_bytes(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    file_id: Option<String>,
) -> Result<Vec<u8>, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;
    let fid = file_id.and_then(|s| s.parse::<FileId>().ok());

    ctx.reader_service
        .get_file_bytes(&bid, fid.as_ref())
        .map_err(BackendError::from)
}
