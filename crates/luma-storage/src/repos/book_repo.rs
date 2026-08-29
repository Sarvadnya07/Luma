use rusqlite::params;
use luma_core::ids::{BookId, DeviceId, FileId};
use luma_core::models::book::{Book, BookFile, DocumentFormat};
use luma_core::version::{EntityVersion, SyncMetadata};

use crate::db::Database;
use crate::error::{StorageError, StorageResult};

pub struct BookRepository {
    db: Database,
}

impl BookRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, book: &Book) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO books (
                    id, title, subtitle, series_id, series_index, description,
                    publisher, published_date, language, isbn, cover_image_path,
                    primary_file_id, version, created_at, updated_at, device_id,
                    is_deleted, deleted_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
                "#,
                params![
                    book.id.to_string(),
                    book.title,
                    book.subtitle,
                    book.series_id.map(|s| s.to_string()),
                    book.series_index,
                    book.description,
                    book.publisher,
                    book.published_date,
                    book.language,
                    book.isbn,
                    book.cover_image_path,
                    book.primary_file_id.map(|f| f.to_string()),
                    book.sync.version.0 as i64,
                    book.sync.created_at.to_rfc3339(),
                    book.sync.updated_at.to_rfc3339(),
                    book.sync.device_id.to_string(),
                    if book.sync.is_deleted { 1 } else { 0 },
                    book.sync.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_by_id(&self, id: &BookId) -> StorageResult<Option<Book>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, title, subtitle, series_id, series_index, description,
                       publisher, published_date, language, isbn, cover_image_path,
                       primary_file_id, version, created_at, updated_at, device_id,
                       is_deleted, deleted_at
                FROM books
                WHERE id = ?1 AND is_deleted = 0
                "#,
            )?;

            let mut rows = stmt.query(params![id.to_string()])?;
            if let Some(row) = rows.next()? {
                let id_str: String = row.get(0)?;
                let title: String = row.get(1)?;
                let subtitle: Option<String> = row.get(2)?;
                let series_id_str: Option<String> = row.get(3)?;
                let series_index: Option<f32> = row.get(4)?;
                let description: Option<String> = row.get(5)?;
                let publisher: Option<String> = row.get(6)?;
                let published_date: Option<String> = row.get(7)?;
                let language: Option<String> = row.get(8)?;
                let isbn: Option<String> = row.get(9)?;
                let cover_image_path: Option<String> = row.get(10)?;
                let primary_file_id_str: Option<String> = row.get(11)?;
                let version_num: i64 = row.get(12)?;
                let created_at_str: String = row.get(13)?;
                let updated_at_str: String = row.get(14)?;
                let device_id_str: String = row.get(15)?;
                let is_deleted_int: i32 = row.get(16)?;
                let deleted_at_str: Option<String> = row.get(17)?;

                let book_id: BookId = id_str.parse().map_err(|e| StorageError::NotFound(format!("{:?}", e)))?;
                let device_id: DeviceId = device_id_str.parse().map_err(|e| StorageError::NotFound(format!("{:?}", e)))?;
                let primary_file_id = primary_file_id_str.and_then(|s| s.parse::<FileId>().ok());
                let series_id = series_id_str.and_then(|s| s.parse().ok());

                let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
                let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
                let deleted_at = deleted_at_str.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .map(|d| d.with_timezone(&chrono::Utc))
                        .ok()
                });

                Ok(Some(Book {
                    id: book_id,
                    title,
                    subtitle,
                    author_ids: Vec::new(),
                    series_id,
                    series_index,
                    description,
                    publisher,
                    published_date,
                    language,
                    isbn,
                    cover_image_path,
                    primary_file_id,
                    sync: SyncMetadata {
                        version: EntityVersion(version_num as u64),
                        created_at,
                        updated_at,
                        device_id,
                        is_deleted: is_deleted_int != 0,
                        deleted_at,
                    },
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Book>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, title, subtitle, series_id, series_index, description,
                       publisher, published_date, language, isbn, cover_image_path,
                       primary_file_id, version, created_at, updated_at, device_id,
                       is_deleted, deleted_at
                FROM books
                WHERE is_deleted = 0
                ORDER BY updated_at DESC
                "#,
            )?;

            let rows = stmt.query_map([], |row| {
                let id_str: String = row.get(0)?;
                let title: String = row.get(1)?;
                let subtitle: Option<String> = row.get(2)?;
                let series_id_str: Option<String> = row.get(3)?;
                let series_index: Option<f32> = row.get(4)?;
                let description: Option<String> = row.get(5)?;
                let publisher: Option<String> = row.get(6)?;
                let published_date: Option<String> = row.get(7)?;
                let language: Option<String> = row.get(8)?;
                let isbn: Option<String> = row.get(9)?;
                let cover_image_path: Option<String> = row.get(10)?;
                let primary_file_id_str: Option<String> = row.get(11)?;
                let version_num: i64 = row.get(12)?;
                let created_at_str: String = row.get(13)?;
                let updated_at_str: String = row.get(14)?;
                let device_id_str: String = row.get(15)?;
                let is_deleted_int: i32 = row.get(16)?;
                let deleted_at_str: Option<String> = row.get(17)?;

                let book_id: BookId = id_str.parse().unwrap_or_default();
                let device_id: DeviceId = device_id_str.parse().unwrap_or_default();
                let primary_file_id = primary_file_id_str.and_then(|s| s.parse::<FileId>().ok());
                let series_id = series_id_str.and_then(|s| s.parse().ok());

                let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
                let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
                let deleted_at = deleted_at_str.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .map(|d| d.with_timezone(&chrono::Utc))
                        .ok()
                });

                Ok(Book {
                    id: book_id,
                    title,
                    subtitle,
                    author_ids: Vec::new(),
                    series_id,
                    series_index,
                    description,
                    publisher,
                    published_date,
                    language,
                    isbn,
                    cover_image_path,
                    primary_file_id,
                    sync: SyncMetadata {
                        version: EntityVersion(version_num as u64),
                        created_at,
                        updated_at,
                        device_id,
                        is_deleted: is_deleted_int != 0,
                        deleted_at,
                    },
                })
            })?;

            let mut books = Vec::new();
            for r in rows {
                books.push(r?);
            }
            Ok(books)
        })
    }
}
