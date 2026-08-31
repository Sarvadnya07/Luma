use luma_core::ids::{BookId, FileId};
use luma_core::models::book::{BookFile, DocumentFormat, FileAvailability};
use rusqlite::params;

use crate::db::Database;
use crate::error::StorageResult;

pub struct BookFileRepository {
    db: Database,
}

impl BookFileRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, file: &BookFile) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO book_files (
                    id, book_id, original_filename, relative_path, canonical_path,
                    format, mime_type, file_size_bytes, sha256_hash, imported_at,
                    created_at, modified_at, availability
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11, ?12)
                "#,
                params![
                    file.id.to_string(),
                    file.book_id.to_string(),
                    file.original_filename,
                    file.relative_path,
                    file.canonical_path,
                    file.format.to_string(),
                    file.mime_type,
                    file.file_size_bytes as i64,
                    file.sha256_hash,
                    file.imported_at.to_rfc3339(),
                    file.modified_at.map(|d| d.to_rfc3339()),
                    file.availability.to_string(),
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_by_id(&self, id: &FileId) -> StorageResult<Option<BookFile>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, original_filename, relative_path, canonical_path,
                       format, mime_type, file_size_bytes, sha256_hash, imported_at,
                       modified_at, availability
                FROM book_files
                WHERE id = ?1
                "#,
            )?;

            let mut rows = stmt.query(params![id.to_string()])?;
            if let Some(row) = rows.next()? {
                Ok(Some(Self::row_to_book_file(row)?))
            } else {
                Ok(None)
            }
        })
    }

    pub fn get_by_hash(&self, sha256_hash: &str) -> StorageResult<Option<BookFile>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, original_filename, relative_path, canonical_path,
                       format, mime_type, file_size_bytes, sha256_hash, imported_at,
                       modified_at, availability
                FROM book_files
                WHERE sha256_hash = ?1
                "#,
            )?;

            let mut rows = stmt.query(params![sha256_hash])?;
            if let Some(row) = rows.next()? {
                Ok(Some(Self::row_to_book_file(row)?))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_by_book_id(&self, book_id: &BookId) -> StorageResult<Vec<BookFile>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, original_filename, relative_path, canonical_path,
                       format, mime_type, file_size_bytes, sha256_hash, imported_at,
                       modified_at, availability
                FROM book_files
                WHERE book_id = ?1
                ORDER BY imported_at ASC
                "#,
            )?;

            let rows = stmt.query_map(params![book_id.to_string()], Self::row_to_book_file)?;
            let mut files = Vec::new();
            for r in rows {
                files.push(r?);
            }
            Ok(files)
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<BookFile>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, original_filename, relative_path, canonical_path,
                       format, mime_type, file_size_bytes, sha256_hash, imported_at,
                       modified_at, availability
                FROM book_files
                "#,
            )?;

            let rows = stmt.query_map([], Self::row_to_book_file)?;
            let mut files = Vec::new();
            for r in rows {
                files.push(r?);
            }
            Ok(files)
        })
    }

    pub fn update_availability(
        &self,
        id: &FileId,
        availability: FileAvailability,
    ) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE book_files SET availability = ?1, modified_at = datetime('now') WHERE id = ?2",
                params![availability.to_string(), id.to_string()],
            )?;
            Ok(())
        })
    }

    fn row_to_book_file(row: &rusqlite::Row) -> rusqlite::Result<BookFile> {
        let id_str: String = row.get(0)?;
        let book_id_str: String = row.get(1)?;
        let original_filename: String = row.get(2)?;
        let relative_path: String = row.get(3)?;
        let canonical_path: Option<String> = row.get(4)?;
        let format_str: String = row.get(5)?;
        let mime_type: Option<String> = row.get(6)?;
        let file_size_bytes: i64 = row.get(7)?;
        let sha256_hash: String = row.get(8)?;
        let imported_at_str: String = row.get(9)?;
        let modified_at_str: Option<String> = row.get(10)?;
        let availability_str: String = row.get(11)?;

        let id: FileId = id_str.parse().unwrap_or_default();
        let book_id: BookId = book_id_str.parse().unwrap_or_default();
        let format = format_str.parse().unwrap_or(DocumentFormat::Epub);
        let availability = availability_str.parse().unwrap_or_default();

        let imported_at = chrono::DateTime::parse_from_rfc3339(&imported_at_str)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let modified_at = modified_at_str.and_then(|s| {
            chrono::DateTime::parse_from_rfc3339(&s)
                .map(|d| d.with_timezone(&chrono::Utc))
                .ok()
        });

        Ok(BookFile {
            id,
            book_id,
            original_filename,
            relative_path,
            canonical_path,
            format,
            mime_type,
            file_size_bytes: file_size_bytes as u64,
            sha256_hash,
            imported_at,
            modified_at,
            availability,
        })
    }
}
