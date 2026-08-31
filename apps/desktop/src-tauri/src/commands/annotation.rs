use tauri::State;

use luma_anchor::ResolutionResult;
use luma_core::error::BackendError;
use luma_core::ids::{AnnotationId, BookId};
use luma_core::models::annotation::Annotation;

use crate::context::LumaAppContext;

#[tauri::command]
pub fn list_annotations(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Vec<Annotation>, BackendError> {
    let parsed_id = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;

    ctx.annotation_service
        .list_by_book(&parsed_id)
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn save_annotation(
    ctx: State<'_, LumaAppContext>,
    annotation: Annotation,
) -> Result<(), BackendError> {
    ctx.annotation_service
        .save_annotation(&annotation)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn update_annotation_note(
    ctx: State<'_, LumaAppContext>,
    annotation_id: String,
    note: Option<String>,
) -> Result<(), BackendError> {
    let aid = annotation_id
        .parse::<AnnotationId>()
        .map_err(|_| BackendError::validation("Invalid annotation_id format"))?;

    ctx.annotation_service
        .update_note(&aid, note.as_deref(), None)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn delete_annotation(
    ctx: State<'_, LumaAppContext>,
    annotation_id: String,
) -> Result<(), BackendError> {
    let aid = annotation_id
        .parse::<AnnotationId>()
        .map_err(|_| BackendError::validation("Invalid annotation_id format"))?;

    ctx.annotation_service
        .delete_annotation(&aid, None)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn resolve_anchor(
    ctx: State<'_, LumaAppContext>,
    quote: String,
    prefix: Option<String>,
    suffix: Option<String>,
    document_text: String,
) -> Result<ResolutionResult, BackendError> {
    Ok(ctx
        .annotation_service
        .resolve_anchor(quote, prefix, suffix, &document_text))
}
