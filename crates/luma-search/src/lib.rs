pub mod sqlite_fts;

use async_trait::async_trait;
use luma_core::error::Result;
use luma_core::ids::BookId;

pub use luma_core::models::search::{SearchHit, SearchQuery, SearchResult};
pub use sqlite_fts::SqliteFtsSearchEngine;

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
