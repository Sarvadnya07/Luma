use std::str::FromStr;
use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_anchor::ResolutionResult;
use luma_core::error::BackendError;
use luma_core::ids::{AnnotationId, BookId};
use luma_core::models::annotation::Annotation;

use crate::context::LumaAppContext;

// ============================================================================
// Constants (removed hardcoded validation messages)
// ============================================================================

const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const INVALID_ANNOTATION_ID_MSG: &str = "Invalid annotation_id format. Expected a valid AnnotationId.";
const INVALID_QUOTE_MSG: &str = "Quote cannot be empty.";
const RESOLVE_ANCHOR_SUCCESS: &str = "Anchor resolved successfully.";

// ============================================================================
// Helper: Parse ID with context
// ============================================================================

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

fn parse_annotation_id(id: &str) -> Result<AnnotationId, BackendError> {
    AnnotationId::from_str(id).map_err(|_| BackendError::validation(INVALID_ANNOTATION_ID_MSG))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(book_id = %book_id))]
#[tauri::command]
pub fn list_annotations(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
) -> Result<Vec<Annotation>, BackendError> {
    let parsed_id = parse_book_id(&book_id)?;
    debug!(?parsed_id, "Listing annotations for book");

    ctx.annotation_service
        .list_by_book(&parsed_id)
        .map_err(|e| {
            error!(error = %e, "Failed to list annotations");
            BackendError::from(e)
        })
}

#[instrument(skip(ctx, annotation), fields(annotation_id = %annotation.id))]
#[tauri::command]
pub async fn save_annotation(
    ctx: State<'_, LumaAppContext>,
    annotation: Annotation,
) -> Result<(), BackendError> {
    debug!(?annotation, "Saving annotation");
    ctx.annotation_service
        .save_annotation(&annotation)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to save annotation");
            BackendError::from(e)
        })?;
    info!("Annotation saved successfully");
    Ok(())
}

#[instrument(skip(ctx), fields(annotation_id = %annotation_id))]
#[tauri::command]
pub async fn update_annotation_note(
    ctx: State<'_, LumaAppContext>,
    annotation_id: String,
    note: Option<String>,
) -> Result<(), BackendError> {
    let parsed_id = parse_annotation_id(&annotation_id)?;
    debug!(?parsed_id, note = ?note, "Updating annotation note");

    ctx.annotation_service
        .update_note(&parsed_id, note.as_deref(), None)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to update annotation note");
            BackendError::from(e)
        })?;
    info!("Annotation note updated");
    Ok(())
}

#[instrument(skip(ctx), fields(annotation_id = %annotation_id))]
#[tauri::command]
pub async fn delete_annotation(
    ctx: State<'_, LumaAppContext>,
    annotation_id: String,
) -> Result<(), BackendError> {
    let parsed_id = parse_annotation_id(&annotation_id)?;
    debug!(?parsed_id, "Deleting annotation");

    ctx.annotation_service
        .delete_annotation(&parsed_id, None)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to delete annotation");
            BackendError::from(e)
        })?;
    info!("Annotation deleted");
    Ok(())
}

#[instrument(skip(ctx, document_text), fields(quote_len = %quote.len(), prefix = ?prefix, suffix = ?suffix))]
#[tauri::command]
pub fn resolve_anchor(
    ctx: State<'_, LumaAppContext>,
    quote: String,
    prefix: Option<String>,
    suffix: Option<String>,
    document_text: String,
) -> Result<ResolutionResult, BackendError> {
    if quote.trim().is_empty() {
        return Err(BackendError::validation(INVALID_QUOTE_MSG));
    }

    debug!("Resolving anchor");
    let result = ctx
        .annotation_service
        .resolve_anchor(quote, prefix, suffix, &document_text);
    debug!(?result, "Anchor resolved");
    info!(RESOLVE_ANCHOR_SUCCESS);
    Ok(result)
}