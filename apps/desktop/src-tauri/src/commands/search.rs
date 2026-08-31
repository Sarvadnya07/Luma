use luma_search::{SearchEngine, SearchQuery, SearchResult, SqliteFtsSearchEngine};
use luma_storage::Database;
use tauri::State;

#[tauri::command]
pub async fn search_library(
    db: State<'_, Database>,
    query: String,
    max_results: Option<usize>,
) -> Result<SearchResult, String> {
    let engine = SqliteFtsSearchEngine::new(db.inner().clone());
    let sq = SearchQuery {
        raw_query: query,
        book_id_filter: None,
        max_results: max_results.unwrap_or(50),
    };
    engine.search(&sq).await.map_err(|e| e.to_string())
}
