use crate::ids::BookId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SearchQuery {
    pub raw_query: String,
    pub book_id_filter: Option<BookId>,
    pub max_results: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SearchHit {
    pub book_id: BookId,
    pub snippet: String,
    pub locator: String,
    pub score: f32,
    pub match_field: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SearchResult {
    pub hits: Vec<SearchHit>,
    pub total_count: usize,
    pub query_duration_ms: f64,
}
