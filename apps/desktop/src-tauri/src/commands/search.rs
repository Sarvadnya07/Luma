use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::BookId;
use luma_core::models::search::SearchResult;

use crate::context::LumaAppContext;

#[tauri::command]
pub async fn search_library(
    ctx: State<'_, LumaAppContext>,
    query: String,
    book_id_filter: Option<String>,
    max_results: Option<usize>,
) -> Result<SearchResult, BackendError> {
    let filter = book_id_filter.and_then(|s| s.parse::<BookId>().ok());
    ctx.search_service
        .search_library(&query, filter, max_results.unwrap_or(50))
        .await
        .map_err(BackendError::from)
}
