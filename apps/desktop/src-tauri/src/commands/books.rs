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

#[tauri::command]
pub async fn get_book_cover_data_url(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Option<String>, BackendError> {
    use base64::Engine;

    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    let book_repo = luma_storage::repos::BookRepository::new(ctx.db.clone());
    let book = match book_repo.get_by_id(&parsed_id) {
        Ok(Some(b)) => b,
        _ => return Ok(None),
    };

    // 1. If stored cover image file exists on disk
    if let Some(ref rel_path) = book.cover_image_path {
        let full_path = ctx.cover_store.get_cover_path(rel_path);
        if full_path.exists() {
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
                let b64 = base64::prelude::BASE64_STANDARD.encode(&bytes);
                return Ok(Some(format!("data:{};base64,{}", mime, b64)));
            }
        }
    }

    // 2. Fallback: on-demand extraction from book file if not previously extracted
    let file_repo = luma_storage::repos::BookFileRepository::new(ctx.db.clone());
    if let Ok(files) = file_repo.list_by_book_id(&parsed_id) {
        if let Some(first_file) = files.first() {
            let p = std::path::Path::new(&first_file.relative_path);
            if p.exists() {
                let cover_opt = match first_file.format {
                    luma_core::models::book::DocumentFormat::Epub => {
                        luma_reader::extractors::EpubExtractor::extract(p)
                            .ok()
                            .and_then(|pkg| pkg.cover)
                    }
                    luma_core::models::book::DocumentFormat::Pdf => {
                        luma_reader::extractors::PdfExtractor::extract(p)
                            .ok()
                            .and_then(|pkg| pkg.cover)
                    }
                    _ => None,
                };
                if let Some(cover) = cover_opt {
                    if let Ok(saved_cover) =
                        ctx.cover_store
                            .save_cover(Some(book.id), &cover.data, &cover.mime_type)
                    {
                        let cover_repo = luma_storage::repos::CoverRepository::new(ctx.db.clone());
                        let _ = cover_repo.insert(&saved_cover);
                        let mut updated_book = book.clone();
                        updated_book.cover_image_id = Some(saved_cover.id);
                        updated_book.cover_image_path = Some(saved_cover.relative_path);
                        let _ = book_repo.update(&updated_book);
                    }
                    let b64 = base64::prelude::BASE64_STANDARD.encode(&cover.data);
                    return Ok(Some(format!("data:{};base64,{}", cover.mime_type, b64)));
                }
            }
        }
    }

    Ok(None)
}
