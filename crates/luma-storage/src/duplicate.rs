use luma_core::ids::{BookId, FileId};
use luma_core::models::book::Book;
use luma_core::models::ingest::{DuplicateAssessment, DuplicateMatchLevel};
use unicode_normalization::UnicodeNormalization;

use crate::db::Database;
use crate::error::StorageResult;
use crate::repos::{BookFileRepository, BookRepository};

pub struct DuplicateDetector {
    db: Database,
}

impl DuplicateDetector {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Assess duplicate status against existing library
    pub fn assess(
        &self,
        sha256_hash: &str,
        isbn: Option<&str>,
        title: &str,
        author: Option<&str>,
    ) -> StorageResult<DuplicateAssessment> {
        let file_repo = BookFileRepository::new(self.db.clone());
        let book_repo = BookRepository::new(self.db.clone());

        // LEVEL 1: Exact physical file hash (SHA-256)
        if let Some(existing_file) = file_repo.get_by_hash(sha256_hash)? {
            return Ok(DuplicateAssessment {
                level: DuplicateMatchLevel::ExactDuplicate,
                existing_book_id: Some(existing_file.book_id),
                existing_file_id: Some(existing_file.id),
                confidence_score: 1.0,
                reason: format!("Identical file with matching SHA-256 hash already exists (file {})", existing_file.id),
            });
        }

        // LEVEL 2: Publication Identifier (ISBN or standard identifier)
        if let Some(isbn_val) = isbn {
            let clean_isbn = isbn_val.replace(['-', ' '], "");
            if !clean_isbn.is_empty() {
                let match_by_isbn = self.db.with_conn(|conn| {
                    let mut stmt = conn.prepare("SELECT id FROM books WHERE REPLACE(REPLACE(isbn, '-', ''), ' ', '') = ?1 AND is_deleted = 0")?;
                    let mut rows = stmt.query([clean_isbn])?;
                    if let Some(r) = rows.next()? {
                        let id_str: String = r.get(0)?;
                        Ok(id_str.parse::<BookId>().ok())
                    } else {
                        Ok(None)
                    }
                })?;

                if let Some(bid) = match_by_isbn {
                    return Ok(DuplicateAssessment {
                        level: DuplicateMatchLevel::LikelyDuplicate,
                        existing_book_id: Some(bid),
                        existing_file_id: None,
                        confidence_score: 0.95,
                        reason: format!("Matching publication ISBN identifier ({}) with existing book {}", isbn_val, bid),
                    });
                }
            }
        }

        // LEVEL 3: Normalized metadata match (title + primary author)
        let norm_title = Self::normalize_string(title);
        if !norm_title.is_empty() {
            let matched_book_id = self.db.with_conn(|conn| {
                let mut stmt = conn.prepare("SELECT id, title FROM books WHERE is_deleted = 0")?;
                let rows = stmt.query_map([], |r| {
                    let id_str: String = r.get(0)?;
                    let t: String = r.get(1)?;
                    Ok((id_str, t))
                })?;

                for r in rows {
                    let (id_str, t) = r?;
                    if Self::normalize_string(&t) == norm_title {
                        return Ok(id_str.parse::<BookId>().ok());
                    }
                }
                Ok(None)
            })?;

            if let Some(bid) = matched_book_id {
                return Ok(DuplicateAssessment {
                    level: DuplicateMatchLevel::PossibleDuplicate,
                    existing_book_id: Some(bid),
                    existing_file_id: None,
                    confidence_score: 0.80,
                    reason: format!("Normalized title '{}' matches existing book {}", title, bid),
                });
            }
        }

        // LEVEL 4: Unrelated publication
        Ok(DuplicateAssessment {
            level: DuplicateMatchLevel::Unrelated,
            existing_book_id: None,
            existing_file_id: None,
            confidence_score: 0.0,
            reason: "No duplicate signals detected in library".to_string(),
        })
    }

    fn normalize_string(input: &str) -> String {
        input
            .nfkd()
            .filter(|c| !c.is_whitespace() && !c.is_ascii_punctuation())
            .flat_map(|c| c.to_lowercase())
            .collect()
    }
}
