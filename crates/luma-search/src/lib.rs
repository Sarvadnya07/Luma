//! # Luma Search
//!
//! Search engine abstraction and implementations for the Luma application.
//! This crate provides:
//!
//! - A `SearchEngine` trait for indexing and searching book content.
//! - A SQLite FTS5 implementation (`SqliteFtsSearchEngine`).
//! - Re‑exports of search‑related models from `luma_core`.
//!
//! ## Prelude
//!
//! For convenience, you can import the most common types via the prelude:
//!
//! ```
//! use luma_search::prelude::*;
//! ```

pub mod sqlite_fts;

use async_trait::async_trait;
use luma_core::error::Result;
use luma_core::ids::BookId;

pub use luma_core::models::search::{SearchHit, SearchQuery, SearchResult};
pub use sqlite_fts::SqliteFtsSearchEngine;

// ============================================================================
// Constants
// ============================================================================

/// Default maximum number of search results when not specified.
pub const DEFAULT_MAX_SEARCH_RESULTS: usize = 50;

// ============================================================================
// SearchEngine Trait
// ============================================================================

/// Contract for search engine (FTS5 / Tantivy / Metadata index).
#[async_trait]
pub trait SearchEngine: Send + Sync {
    /// Index the full text content of a book.
    async fn index_book(&self, book_id: &BookId, text_content: &str) -> Result<()>;

    /// Perform a search query and return matching results.
    async fn search(&self, query: &SearchQuery) -> Result<SearchResult>;

    /// Remove a book from the search index.
    async fn remove_book(&self, book_id: &BookId) -> Result<()>;
}

// ============================================================================
// Prelude
// ============================================================================

/// Convenience prelude module: imports the most frequently used types.
pub mod prelude {
    pub use super::{DEFAULT_MAX_SEARCH_RESULTS, SearchEngine, SearchHit, SearchQuery, SearchResult};
    pub use super::sqlite_fts::SqliteFtsSearchEngine;
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_query_creation() {
        let q = SearchQuery {
            raw_query: "annotation integrity".to_string(),
            book_id_filter: None,
            max_results: DEFAULT_MAX_SEARCH_RESULTS,
        };
        assert_eq!(q.max_results, DEFAULT_MAX_SEARCH_RESULTS);
    }
}