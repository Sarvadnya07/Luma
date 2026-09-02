use std::str::FromStr;
use tauri::State;
use tracing::{debug, error, info, instrument, warn};

use luma_core::error::BackendError;
use luma_core::ids::BookId;
use luma_core::models::search::SearchResult;

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages and configuration
// ============================================================================

const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const SEARCH_SUCCESS_MSG: &str = "Library search completed successfully.";
const DEFAULT_MAX_RESULTS: usize = 50;

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

// ============================================================================
// Tauri Command
// ============================================================================

#[instrument(skip(ctx), fields(query = %query, book_id_filter = ?book_id_filter, max_results = ?max_results))]
#[tauri::command]
pub async fn search_library(
    ctx: State<'_, LumaAppContext>,
    query: String,
    book_id_filter: Option<String>,
    max_results: Option<usize>,
) -> Result<SearchResult, BackendError> {
    let effective_max = max_results.unwrap_or(DEFAULT_MAX_RESULTS);
    debug!("Searching library");

    // Parse optional book_id_filter
    let filter = match book_id_filter {
        Some(id_str) => match parse_book_id(&id_str) {
            Ok(id) => Some(id),
            Err(e) => {
                warn!(book_id = %id_str, error = %e, "Invalid book_id_filter provided; ignoring filter");
                None
            }
        },
        None => None,
    };

    debug!(?filter, effective_max, "Search parameters");

    let result = ctx
        .search_service
        .search_library(&query, filter, effective_max)
        .await
        .map_err(|e| {
            error!(error = %e, "Library search failed");
            BackendError::from(e)
        })?;

    info!(hit_count = result.total_count, query_duration_ms = result.query_duration_ms, SEARCH_SUCCESS_MSG);
    Ok(result)
}