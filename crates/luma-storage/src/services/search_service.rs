use rusqlite::params;
use std::time::Instant;

use luma_core::error::{LumaError, Result};
use luma_core::ids::BookId;
use luma_core::models::search::{SearchHit, SearchResult};

use crate::cache::CacheManager;
use crate::db::Database;
use crate::events::{DomainEvent, EventBus};

#[derive(Clone)]
pub struct SearchService {
    db: Database,
    event_bus: EventBus,
    cache: CacheManager,
}

impl SearchService {
    pub const MAX_QUERY_LENGTH: usize = 256;

    pub fn new(db: Database, event_bus: EventBus, cache: CacheManager) -> Self {
        Self {
            db,
            event_bus,
            cache,
        }
    }

    pub async fn search_library(
        &self,
        query: &str,
        book_id_filter: Option<BookId>,
        max_results: usize,
    ) -> Result<SearchResult> {
        let start = Instant::now();
        let bounded_query = if query.len() > Self::MAX_QUERY_LENGTH {
            &query[..Self::MAX_QUERY_LENGTH]
        } else {
            query
        };

        let clean_query = bounded_query
            .trim()
            .replace('"', "\"\"")
            .replace(['*', '^', ':', '(', ')'], " ");

        let sanitized = clean_query.split_whitespace().collect::<Vec<_>>().join(" ");
        if sanitized.is_empty() {
            return Ok(SearchResult {
                hits: Vec::new(),
                total_count: 0,
                query_duration_ms: 0.0,
            });
        }

        let fts_query = format!("\"{}\"*", sanitized);
        let max = if max_results == 0 {
            50
        } else {
            max_results.min(500) as i64
        };

        let book_filter = book_id_filter.map(|b| b.to_string());

        let hits = self
            .db
            .with_conn(move |conn| {
                let mut hits_vec = Vec::new();
                if let Some(ref bid) = book_filter {
                    let sql = r#"
                        SELECT book_id, snippet(books_fts, 1, '<b>', '</b>', '...', 15), rank
                        FROM books_fts
                        WHERE books_fts MATCH ?1 AND book_id = ?2
                        ORDER BY rank LIMIT ?3
                    "#;
                    let mut stmt = conn.prepare(sql)?;
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
                    let sql = r#"
                        SELECT book_id, snippet(books_fts, 1, '<b>', '</b>', '...', 15), rank
                        FROM books_fts
                        WHERE books_fts MATCH ?1
                        ORDER BY rank LIMIT ?2
                    "#;
                    let mut stmt = conn.prepare(sql)?;
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

    /// Rebuild entire FTS5 search index from all books in database
    pub async fn rebuild_index(&self) -> Result<usize> {
        let count = self.db.with_conn(|conn| {
            let tx = conn.transaction()?;

            // Clear existing FTS5 records
            tx.execute("DELETE FROM books_fts", [])?;

            // Populate from books, authors, series, and tags
            let mut stmt = tx.prepare(
                r#"
                SELECT b.id, b.title, b.subtitle, b.description, b.isbn,
                       COALESCE(s.title, '') AS series_title
                FROM books b
                LEFT JOIN series s ON s.id = b.series_id
                WHERE b.is_deleted = 0
                "#,
            )?;

            let book_rows = stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    r.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    r.get::<_, String>(5)?,
                ))
            })?;

            let mut books_data = Vec::new();
            for b in book_rows.flatten() {
                books_data.push(b);
            }
            drop(stmt);

            let mut inserted = 0;
            for (id, title, subtitle, description, isbn, series_title) in books_data {
                // Fetch authors
                let mut authors_stmt = tx.prepare(
                    r#"
                    SELECT a.name FROM authors a
                    JOIN book_authors ba ON ba.author_id = a.id
                    WHERE ba.book_id = ?1
                    "#,
                )?;
                let a_rows = authors_stmt.query_map([&id], |r| r.get::<_, String>(0))?;
                let mut authors_vec = Vec::new();
                for a in a_rows.flatten() {
                    authors_vec.push(a);
                }
                let authors_str = authors_vec.join(", ");
                drop(authors_stmt);

                // Fetch tags
                let mut tags_stmt = tx.prepare(
                    r#"
                    SELECT t.name FROM tags t
                    JOIN book_tags bt ON bt.tag_id = t.id
                    WHERE bt.book_id = ?1
                    "#,
                )?;
                let t_rows = tags_stmt.query_map([&id], |r| r.get::<_, String>(0))?;
                let mut tags_vec = Vec::new();
                for t in t_rows.flatten() {
                    tags_vec.push(t);
                }
                let tags_str = tags_vec.join(", ");
                drop(tags_stmt);

                tx.execute(
                    r#"
                    INSERT INTO books_fts (book_id, title, subtitle, authors, series, tags, description, isbn)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                    "#,
                    params![id, title, subtitle, authors_str, series_title, tags_str, description, isbn],
                )?;
                inserted += 1;
            }

            tx.commit()?;
            Ok(inserted)
        }).map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.cache.search_queries.clear().await;
        self.event_bus
            .publish(DomainEvent::SearchIndexUpdated { book_id: None });

        Ok(count)
    }
}
