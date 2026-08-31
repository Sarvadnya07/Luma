use luma_anchor::{AnchorEngine, ResolutionResult, TextQuoteAnchor};
use luma_core::models::annotation::Annotation;
use luma_storage::repos::AnnotationRepository;
use luma_storage::Database;
use tauri::State;

#[tauri::command]
pub fn list_annotations(
    db: State<'_, Database>,
    book_id: String,
) -> Result<Vec<Annotation>, String> {
    let parsed_id = book_id
        .parse()
        .map_err(|e: luma_core::error::LumaError| e.to_string())?;
    let repo = AnnotationRepository::new(db.inner().clone());
    repo.list_by_book(&parsed_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_annotation(db: State<'_, Database>, annotation: Annotation) -> Result<(), String> {
    let repo = AnnotationRepository::new(db.inner().clone());
    repo.insert(&annotation).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resolve_anchor(
    quote: String,
    prefix: Option<String>,
    suffix: Option<String>,
    document_text: String,
) -> Result<ResolutionResult, String> {
    let anchor = TextQuoteAnchor::new(quote, prefix, suffix);
    let result = AnchorEngine::resolve_quote(&anchor, &document_text);
    Ok(result)
}
