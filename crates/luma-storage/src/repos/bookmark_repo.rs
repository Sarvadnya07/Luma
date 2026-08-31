use luma_core::ids::{BookId, BookmarkId, DeviceId};
use luma_core::models::reading::Bookmark;
use luma_core::version::{EntityVersion, SyncMetadata};
use rusqlite::params;

use crate::db::Database;
use crate::error::StorageResult;

pub struct BookmarkRepository {
    db: Database,
}

impl BookmarkRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, bookmark: &Bookmark) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO bookmarks (
                    id, book_id, locator, title, chapter_title, page_number,
                    version, created_at, updated_at, device_id, is_deleted, deleted_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "#,
                params![
                    bookmark.id.to_string(),
                    bookmark.book_id.to_string(),
                    bookmark.locator,
                    bookmark.title,
                    bookmark.chapter_title,
                    bookmark.page_number,
                    bookmark.sync.version.0 as i64,
                    bookmark.sync.created_at.to_rfc3339(),
                    bookmark.sync.updated_at.to_rfc3339(),
                    bookmark.sync.device_id.to_string(),
                    if bookmark.sync.is_deleted { 1 } else { 0 },
                    bookmark.sync.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Bookmark>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, locator, title, chapter_title, page_number,
                       version, created_at, updated_at, device_id, is_deleted, deleted_at
                FROM bookmarks
                WHERE is_deleted = 0
                ORDER BY created_at DESC
                "#,
            )?;
            let rows = stmt.query_map([], Self::row_to_bookmark)?;
            let mut list = Vec::new();
            for r in rows {
                list.push(r?);
            }
            Ok(list)
        })
    }

    pub fn list_by_book_id(&self, book_id: &BookId) -> StorageResult<Vec<Bookmark>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, locator, title, chapter_title, page_number,
                       version, created_at, updated_at, device_id, is_deleted, deleted_at
                FROM bookmarks
                WHERE book_id = ?1 AND is_deleted = 0
                ORDER BY created_at DESC
                "#,
            )?;
            let rows = stmt.query_map(params![book_id.to_string()], Self::row_to_bookmark)?;
            let mut list = Vec::new();
            for r in rows {
                list.push(r?);
            }
            Ok(list)
        })
    }

    pub fn delete(&self, id: &BookmarkId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE bookmarks SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now'), version = version + 1 WHERE id = ?1",
                params![id.to_string()],
            )?;
            Ok(())
        })
    }

    fn row_to_bookmark(row: &rusqlite::Row) -> rusqlite::Result<Bookmark> {
        let id_str: String = row.get(0)?;
        let book_id_str: String = row.get(1)?;
        let locator: String = row.get(2)?;
        let title: Option<String> = row.get(3)?;
        let chapter_title: Option<String> = row.get(4)?;
        let page_number: Option<u32> = row.get(5)?;
        let version_num: i64 = row.get(6)?;
        let created_at_str: String = row.get(7)?;
        let updated_at_str: String = row.get(8)?;
        let device_id_str: String = row.get(9)?;
        let is_deleted_int: i32 = row.get(10)?;
        let deleted_at_str: Option<String> = row.get(11)?;

        let id: BookmarkId = id_str.parse().unwrap_or_default();
        let book_id: BookId = book_id_str.parse().unwrap_or_default();
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

        Ok(Bookmark {
            id,
            book_id,
            locator,
            title,
            chapter_title,
            page_number,
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
