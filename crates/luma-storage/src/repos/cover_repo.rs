use rusqlite::params;
use luma_core::ids::{BookId, CoverImageId};
use luma_core::models::ingest::CoverImage;

use crate::db::Database;
use crate::error::StorageResult;

pub struct CoverRepository {
    db: Database,
}

impl CoverRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, cover: &CoverImage) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO cover_images (
                    id, book_id, file_size_bytes, sha256_hash, mime_type, relative_path,
                    width, height, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    cover.id.to_string(),
                    cover.book_id.map(|b| b.to_string()),
                    cover.file_size_bytes as i64,
                    cover.sha256_hash,
                    cover.mime_type,
                    cover.relative_path,
                    cover.width,
                    cover.height,
                    cover.created_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_by_id(&self, id: &CoverImageId) -> StorageResult<Option<CoverImage>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, file_size_bytes, sha256_hash, mime_type, relative_path,
                       width, height, created_at
                FROM cover_images
                WHERE id = ?1
                "#,
            )?;
            let mut rows = stmt.query(params![id.to_string()])?;
            if let Some(row) = rows.next()? {
                Ok(Some(Self::row_to_cover(row)?))
            } else {
                Ok(None)
            }
        })
    }

    pub fn get_by_hash(&self, sha256_hash: &str) -> StorageResult<Option<CoverImage>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, file_size_bytes, sha256_hash, mime_type, relative_path,
                       width, height, created_at
                FROM cover_images
                WHERE sha256_hash = ?1
                "#,
            )?;
            let mut rows = stmt.query(params![sha256_hash])?;
            if let Some(row) = rows.next()? {
                Ok(Some(Self::row_to_cover(row)?))
            } else {
                Ok(None)
            }
        })
    }

    fn row_to_cover(row: &rusqlite::Row) -> rusqlite::Result<CoverImage> {
        let id_str: String = row.get(0)?;
        let book_id_str: Option<String> = row.get(1)?;
        let file_size_bytes: i64 = row.get(2)?;
        let sha256_hash: String = row.get(3)?;
        let mime_type: String = row.get(4)?;
        let relative_path: String = row.get(5)?;
        let width: Option<u32> = row.get(6)?;
        let height: Option<u32> = row.get(7)?;
        let created_at_str: String = row.get(8)?;

        let id: CoverImageId = id_str.parse().unwrap_or_default();
        let book_id = book_id_str.and_then(|s| s.parse::<BookId>().ok());
        let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());

        Ok(CoverImage {
            id,
            book_id,
            file_size_bytes: file_size_bytes as u64,
            sha256_hash,
            mime_type,
            relative_path,
            width,
            height,
            created_at,
        })
    }
}
