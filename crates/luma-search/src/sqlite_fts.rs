use async_trait::async_trait;
use rusqlite::params;
use std::time::Instant;

use luma_core::error::{LumaError, Result};
use luma_core::ids::BookId;
use luma_storage::Database;

use crate::{SearchEngine, SearchHit, SearchQuery, SearchResult};

pub struct SqliteFtsSearchEngine {
    db: Database,
}

impl SqliteFtsSearchEngine {
    pub fn new(db: Database) -> Self {
        Self { db }
    }
}

#[async_trait]
impl SearchEngine for SqliteFtsSearchEngine {
    async fn index_book(&self, book_id: &BookId, text_content: &str) -> Result<()> {
        let bid = book_id.to_string();
        let content = text_content.to_string();

        self.db
            .with_conn(move |conn| {
                conn.execute(
                    r#"
                    INSERT OR REPLACE INTO books_fts (book_id, title, subtitle, authors, series, tags, description, isbn)
                    VALUES (?1, '', '', '', '', '', ?2, '')
                    "#,
                    params![bid, content],
                )?;
                Ok(())
            })
            .map_err(|e| LumaError::StorageError(e.to_string()))
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
        let book_filter = query.book_id_filter.map(|b| b.to_string());

        let hits = self
            .db
            .with_conn(move |conn| {
                let mut sql = String::from(
                    r#"
                    SELECT book_id, snippet(books_fts, 1, '<b>', '</b>', '...', 15), rank
                    FROM books_fts
                    WHERE books_fts MATCH ?1
                    "#,
                );

                if book_filter.is_some() {
                    sql.push_str(" AND book_id = ?2");
                }
                sql.push_str(" ORDER BY rank LIMIT ?3");

                let mut hits_vec = Vec::new();
                if let Some(ref bid) = book_filter {
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
                                match_field: "metadata".to_string(),
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
                                match_field: "metadata".to_string(),
                            });
                        }
                    }
                }

                Ok(hits_vec)
            })
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

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
                conn.execute("DELETE FROM books_fts WHERE book_id = ?1", params![bid])?;
                Ok(())
            })
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }
}
