use async_trait::async_trait;
use rusqlite::params;
use std::time::Instant;

use luma_core::error::{LumaError, Result};
use luma_core::ids::BookId;
use luma_storage::Database;

use crate::{SearchEngine, SearchHit, SearchQuery, SearchResult};

// ============================================================================
// Constants – configuration and SQL templates
// ============================================================================

/// Default number of words for snippet context.
pub const SNIPPET_WORDS: u32 = 15;

/// Prefix and suffix for highlighted snippets.
pub const SNIPPET_PREFIX: &str = "<b>";
pub const SNIPPET_SUFFIX: &str = "</b>";

/// Placeholder for snippet ellipsis.
pub const SNIPPET_ELLIPSIS: &str = "...";

/// Fallback match field name.
pub const DEFAULT_MATCH_FIELD: &str = "metadata";

/// Base SQL for FTS5 search (without book filter).
pub const FTS_SEARCH_SQL_BASE: &str = r#"
    SELECT book_id, snippet(books_fts, 1, '<b>', '</b>', '...', 15), rank
    FROM books_fts
    WHERE books_fts MATCH ?1
"#;

/// Additional clause for book filter.
pub const FTS_BOOK_FILTER_CLAUSE: &str = " AND book_id = ?2";

/// Order by rank and limit.
pub const FTS_ORDER_LIMIT_CLAUSE: &str = " ORDER BY rank LIMIT ?3";

/// SQL for removing a book from the FTS index.
pub const FTS_DELETE_BOOK_SQL: &str = "DELETE FROM books_fts WHERE book_id = ?1";

/// SQL for inserting/replacing a book in the FTS index.
pub const FTS_INSERT_BOOK_SQL: &str = r#"
    INSERT OR REPLACE INTO books_fts (book_id, title, subtitle, authors, series, tags, description, isbn)
    VALUES (?1, '', '', '', '', '', ?2, '')
"#;

// ============================================================================
// SqliteFtsSearchEngine
// ============================================================================

pub struct SqliteFtsSearchEngine {
    db: Database,
}

impl SqliteFtsSearchEngine {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Helper to build the full SQL query for search, with optional book filter.
    fn build_search_sql(book_filter: &Option<BookId>) -> (String, bool) {
        let has_filter = book_filter.is_some();
        let mut sql = String::from(FTS_SEARCH_SQL_BASE);
        if has_filter {
            sql.push_str(FTS_BOOK_FILTER_CLAUSE);
        }
        sql.push_str(FTS_ORDER_LIMIT_CLAUSE);
        (sql, has_filter)
    }

    /// Helper to execute the search query and collect results.
    fn execute_search_query(&self, fts_query: &str, book_filter: &Option<BookId>, max: i64) -> Result<Vec<SearchHit>> {
        let (sql, has_filter) = Self::build_search_sql(book_filter);

        self.db.with_read_conn(move |conn| {
            let mut hits_vec = Vec::new();

            if has_filter {
                let bid = book_filter.as_ref().unwrap().to_string();
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![fts_query, bid, max], |r| {
                    let id_str: String = r.get(0)?;
                    let snippet: String = r.get(1)?;
                    let rank: f64 = r.get(2)?;
                    Ok((id_str, snippet, rank))
                })?;
                for item in rows {
                    let (id_str, snip, rank) = item?;
                    if let Ok(parsed_id) = id_str.parse::<BookId>() {
                        hits_vec.push(SearchHit {
                            book_id: parsed_id,
                            snippet: snip,
                            locator: String::new(),
                            score: (-rank) as f32,
                            match_field: DEFAULT_MATCH_FIELD.to_string(),
                        });
                    }
                }
            } else {
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![fts_query, max], |r| {
                    let id_str: String = r.get(0)?;
                    let snippet: String = r.get(1)?;
                    let rank: f64 = r.get(2)?;
                    Ok((id_str, snippet, rank))
                })?;
                for item in rows {
                    let (id_str, snip, rank) = item?;
                    if let Ok(parsed_id) = id_str.parse::<BookId>() {
                        hits_vec.push(SearchHit {
                            book_id: parsed_id,
                            snippet: snip,
                            locator: String::new(),
                            score: (-rank) as f32,
                            match_field: DEFAULT_MATCH_FIELD.to_string(),
                        });
                    }
                }
            }

            Ok(hits_vec)
        })
        .map_err(|e| LumaError::StorageError(format!("FTS storage error: {e}")))
    }
}

#[async_trait]
impl SearchEngine for SqliteFtsSearchEngine {
    async fn index_book(&self, book_id: &BookId, text_content: &str) -> Result<()> {
        let bid = book_id.to_string();
        let content = text_content.to_string();

        self.db
            .with_conn(move |conn| {
                conn.execute(FTS_INSERT_BOOK_SQL, params![bid, content])?;
                Ok(())
            })
            .map_err(|e| LumaError::StorageError(format!("FTS storage error: {e}")))
    }

    async fn search(&self, query: &SearchQuery) -> Result<SearchResult> {
        let start = Instant::now();
        let clean_query = query.raw_query.trim().replace('"', "\"\"");
        if clean_query.is_empty() {
            return Ok(SearchResult {
                hits: Vec::new(),
                total_count: 0,
                query_duration_ms: 0.0,
            });
        }

        // Build FTS5 query with wildcard prefix matching
        let fts_query = format!("\"{}\"*", clean_query);
        let max = query.max_results as i64;
        let book_filter = query.book_id_filter;

        let hits = self.execute_search_query(&fts_query, &book_filter, max)?;

        let duration = start.elapsed().as_secs_f64() * 1000.0;
        let total = hits.len();

        Ok(SearchResult {
            hits,
            total_count: total,
            query_duration_ms: duration,
        })
    }

    async fn remove_book(&self, book_id: &BookId) -> Result<()> {
        let bid = book_id.to_string();
        self.db
            .with_conn(move |conn| {
                conn.execute(FTS_DELETE_BOOK_SQL, params![bid])?;
                Ok(())
            })
            .map_err(|e| LumaError::StorageError(format!("FTS storage error: {e}")))
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use luma_storage::Database;

    #[tokio::test]
    async fn test_index_and_search() -> Result<()> {
        let db = Database::open_in_memory()
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        // Create FTS table
        db.with_conn(|conn| {
            conn.execute(
                "CREATE VIRTUAL TABLE books_fts USING fts5(book_id, title, subtitle, authors, series, tags, description, isbn)",
                [],
            )?;
            Ok(())
        })
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        let engine = SqliteFtsSearchEngine::new(db);
        let book_id = BookId::new();
        engine.index_book(&book_id, "Luma is a modern reading platform.").await?;

        let query = SearchQuery {
            raw_query: "reading".to_string(),
            book_id_filter: None,
            max_results: 10,
        };
        let result = engine.search(&query).await?;
        assert!(result.total_count > 0);
        assert_eq!(result.hits[0].book_id, book_id);
        Ok(())
    }
}