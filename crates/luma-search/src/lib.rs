pub mod sqlite_fts;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use luma_core::error::Result;
use luma_core::ids::BookId;

pub use sqlite_fts::SqliteFtsSearchEngine;

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

/// Contract for search engine (FTS5 / Tantivy / Metadata index)
#[async_trait]
pub trait SearchEngine: Send + Sync {
    async fn index_book(&self, book_id: &BookId, text_content: &str) -> Result<()>;
    async fn search(&self, query: &SearchQuery) -> Result<SearchResult>;
    async fn remove_book(&self, book_id: &BookId) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_query_creation() {
        let q = SearchQuery {
            raw_query: "annotation integrity".to_string(),
            book_id_filter: None,
            max_results: 20,
        };
        assert_eq!(q.max_results, 20);
    }
}
