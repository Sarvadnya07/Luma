use rusqlite::params;
use luma_core::ids::{AuthorId, BookId, DeviceId};
use luma_core::models::metadata::Author;
use luma_core::version::{EntityVersion, SyncMetadata};

use crate::db::Database;
use crate::error::StorageResult;

pub struct AuthorRepository {
    db: Database,
}

impl AuthorRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_or_create_by_name(&self, name: &str, device_id: DeviceId) -> StorageResult<Author> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, name, sort_name, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM authors WHERE name = ?1 AND is_deleted = 0")?;
            let mut rows = stmt.query(params![name])?;
            if let Some(row) = rows.next()? {
                return Ok(Self::row_to_author(row)?);
            }
            drop(rows);
            drop(stmt);

            let author = Author::new(name, device_id);
            conn.execute(
                "INSERT INTO authors (id, name, sort_name, version, created_at, updated_at, device_id, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    author.id.to_string(),
                    author.name,
                    author.sort_name,
                    author.sync.version.0 as i64,
                    author.sync.created_at.to_rfc3339(),
                    author.sync.updated_at.to_rfc3339(),
                    author.sync.device_id.to_string(),
                    0,
                ],
            )?;

            Ok(author)
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Author>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, name, sort_name, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM authors WHERE is_deleted = 0 ORDER BY name ASC")?;
            let rows = stmt.query_map([], Self::row_to_author)?;
            let mut authors = Vec::new();
            for r in rows {
                authors.push(r?);
            }
            Ok(authors)
        })
    }

    pub fn get_authors_for_book(&self, book_id: &BookId) -> StorageResult<Vec<Author>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT a.id, a.name, a.sort_name, a.version, a.created_at, a.updated_at, a.device_id, a.is_deleted, a.deleted_at
                FROM authors a
                JOIN book_authors ba ON a.id = ba.author_id
                WHERE ba.book_id = ?1 AND a.is_deleted = 0
                ORDER BY ba.position ASC
                "#,
            )?;
            let rows = stmt.query_map(params![book_id.to_string()], Self::row_to_author)?;
            let mut authors = Vec::new();
            for r in rows {
                authors.push(r?);
            }
            Ok(authors)
        })
    }

    fn row_to_author(row: &rusqlite::Row) -> rusqlite::Result<Author> {
        let id_str: String = row.get(0)?;
        let name: String = row.get(1)?;
        let sort_name: Option<String> = row.get(2)?;
        let version_num: i64 = row.get(3)?;
        let created_at_str: String = row.get(4)?;
        let updated_at_str: String = row.get(5)?;
        let device_id_str: String = row.get(6)?;
        let is_deleted_int: i32 = row.get(7)?;
        let deleted_at_str: Option<String> = row.get(8)?;

        let id: AuthorId = id_str.parse().unwrap_or_default();
        let device_id: DeviceId = device_id_str.parse().unwrap_or_default();

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

        Ok(Author {
            id,
            name,
            sort_name,
            sync: SyncMetadata {
                version: EntityVersion(version_num as u64),
                created_at,
                updated_at,
                device_id,
                is_deleted: is_deleted_int != 0,
                deleted_at,
            },
        })
    }
}
