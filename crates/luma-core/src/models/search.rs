use crate::ids::BookId;
use serde::{Deserialize, Serialize};

// ============================================================================
// Constants – default values and validation messages
// ============================================================================

pub const DEFAULT_MAX_RESULTS: usize = 50;
pub const EMPTY_QUERY_MSG: &str = "Search query cannot be empty";

// ============================================================================
// SearchQuery
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SearchQuery {
    pub raw_query: String,
    pub book_id_filter: Option<BookId>,
    pub max_results: usize,
}

impl SearchQuery {
    /// Creates a new search query with the given raw text.
    pub fn new(query: impl Into<String>) -> Self {
        Self {
            raw_query: query.into(),
            book_id_filter: None,
            max_results: DEFAULT_MAX_RESULTS,
        }
    }

    /// Sets a filter to restrict search to a specific book.
    pub fn with_book_filter(mut self, book_id: BookId) -> Self {
        self.book_id_filter = Some(book_id);
        self
    }

    /// Sets the maximum number of results to return.
    pub fn with_max_results(mut self, max: usize) -> Self {
        self.max_results = max;
        self
    }

    /// Validates that the query is not empty.
    pub fn validate(&self) -> Result<(), String> {
        if self.raw_query.trim().is_empty() {
            return Err(EMPTY_QUERY_MSG.to_string());
        }
        Ok(())
    }
}

impl Default for SearchQuery {
    fn default() -> Self {
        Self {
            raw_query: String::new(),
            book_id_filter: None,
            max_results: DEFAULT_MAX_RESULTS,
        }
    }
}

// ============================================================================
// SearchHit
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SearchHit {
    pub book_id: BookId,
    pub snippet: String,
    pub locator: String,
    pub score: f32,
    pub match_field: String,
}

impl SearchHit {
    /// Creates a new search hit with default values.
    pub fn new(book_id: BookId, snippet: impl Into<String>, locator: impl Into<String>, score: f32) -> Self {
        Self {
            book_id,
            snippet: snippet.into(),
            locator: locator.into(),
            score,
            match_field: String::new(),
        }
    }

    /// Sets the match field (e.g., "title", "author", "content").
    pub fn with_match_field(mut self, field: impl Into<String>) -> Self {
        self.match_field = field.into();
        self
    }
}

// ============================================================================
// SearchResult
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SearchResult {
    pub hits: Vec<SearchHit>,
    pub total_count: usize,
    pub query_duration_ms: f64,
}

impl SearchResult {
    /// Creates an empty search result with zero hits.
    pub fn empty() -> Self {
        Self {
            hits: Vec::new(),
            total_count: 0,
            query_duration_ms: 0.0,
        }
    }

    /// Creates a new search result with the given hits and metadata.
    pub fn new(hits: Vec<SearchHit>, total_count: usize, query_duration_ms: f64) -> Self {
        Self {
            hits,
            total_count,
            query_duration_ms,
        }
    }
}