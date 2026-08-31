use luma_core::ids::{BookId, DeviceId, TagId};
use luma_core::models::metadata::Tag;
use luma_core::version::{EntityVersion, SyncMetadata};
use rusqlite::params;

use crate::db::Database;
use crate::error::StorageResult;

pub struct TagRepository {
    db: Database,
}

impl TagRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_or_create_by_name(&self, name: &str, device_id: DeviceId) -> StorageResult<Tag> {
        self.db.with_conn(|conn| {
            let normalized = name.trim().to_lowercase();
            let mut stmt = conn.prepare("SELECT id, name, color_hex, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM tags WHERE LOWER(name) = ?1 AND is_deleted = 0")?;
            let mut rows = stmt.query(params![normalized])?;
            if let Some(row) = rows.next()? {
                return Ok(Self::row_to_tag(row)?);
            }
            drop(rows);
            drop(stmt);

            let tag = Tag::new(name.trim(), device_id);
            conn.execute(
                "INSERT INTO tags (id, name, color_hex, version, created_at, updated_at, device_id, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    tag.id.to_string(),
                    tag.name,
                    tag.color_hex,
                    tag.sync.version.0 as i64,
                    tag.sync.created_at.to_rfc3339(),
                    tag.sync.updated_at.to_rfc3339(),
                    tag.sync.device_id.to_string(),
                    0,
                ],
            )?;

            Ok(tag)
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Tag>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, name, color_hex, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM tags WHERE is_deleted = 0 ORDER BY name ASC")?;
            let rows = stmt.query_map([], Self::row_to_tag)?;
            let mut tags = Vec::new();
            for r in rows {
                tags.push(r?);
            }
            Ok(tags)
        })
    }

    pub fn add_tag_to_book(&self, book_id: &BookId, tag_id: &TagId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?1, ?2)",
                params![book_id.to_string(), tag_id.to_string()],
            )?;
            Ok(())
        })
    }

    pub fn remove_tag_from_book(&self, book_id: &BookId, tag_id: &TagId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "DELETE FROM book_tags WHERE book_id = ?1 AND tag_id = ?2",
                params![book_id.to_string(), tag_id.to_string()],
            )?;
            Ok(())
        })
    }

    pub fn get_tags_for_book(&self, book_id: &BookId) -> StorageResult<Vec<Tag>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT t.id, t.name, t.color_hex, t.version, t.created_at, t.updated_at, t.device_id, t.is_deleted, t.deleted_at
                FROM tags t
                JOIN book_tags bt ON t.id = bt.tag_id
                WHERE bt.book_id = ?1 AND t.is_deleted = 0
                ORDER BY t.name ASC
                "#,
            )?;
            let rows = stmt.query_map(params![book_id.to_string()], Self::row_to_tag)?;
            let mut tags = Vec::new();
            for r in rows {
                tags.push(r?);
            }
            Ok(tags)
        })
    }

    fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<Tag> {
        let id_str: String = row.get(0)?;
        let name: String = row.get(1)?;
        let color_hex: Option<String> = row.get(2)?;
        let version_num: i64 = row.get(3)?;
        let created_at_str: String = row.get(4)?;
        let updated_at_str: String = row.get(5)?;
        let device_id_str: String = row.get(6)?;
        let is_deleted_int: i32 = row.get(7)?;
        let deleted_at_str: Option<String> = row.get(8)?;

        let id: TagId = id_str.parse().unwrap_or_default();
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

        Ok(Tag {
            id,
            name,
            color_hex,
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
