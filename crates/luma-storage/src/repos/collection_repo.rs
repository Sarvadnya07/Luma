use rusqlite::params;
use luma_core::ids::{BookId, CollectionId, DeviceId};
use luma_core::models::metadata::Collection;
use luma_core::version::{EntityVersion, SyncMetadata};

use crate::db::Database;
use crate::error::StorageResult;

pub struct CollectionRepository {
    db: Database,
}

impl CollectionRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn create(&self, name: &str, description: Option<&str>, device_id: DeviceId) -> StorageResult<Collection> {
        self.db.with_conn(|conn| {
            let mut collection = Collection::new(name, device_id);
            collection.description = description.map(|s| s.to_string());

            conn.execute(
                "INSERT INTO collections (id, name, description, version, created_at, updated_at, device_id, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    collection.id.to_string(),
                    collection.name,
                    collection.description,
                    collection.sync.version.0 as i64,
                    collection.sync.created_at.to_rfc3339(),
                    collection.sync.updated_at.to_rfc3339(),
                    collection.sync.device_id.to_string(),
                    0,
                ],
            )?;

            Ok(collection)
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Collection>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, name, description, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM collections WHERE is_deleted = 0 ORDER BY name ASC")?;
            let rows = stmt.query_map([], Self::row_to_collection)?;
            let mut collections = Vec::new();
            for r in rows {
                let mut col = r?;
                // Load book IDs
                let mut bstmt = conn.prepare("SELECT book_id FROM book_collections WHERE collection_id = ?1 ORDER BY position ASC")?;
                let brows = bstmt.query_map(params![col.id.to_string()], |br| {
                    let bid_str: String = br.get(0)?;
                    Ok(bid_str.parse::<BookId>().unwrap_or_default())
                })?;
                for bid in brows {
                    col.book_ids.push(bid?);
                }
                collections.push(col);
            }
            Ok(collections)
        })
    }

    pub fn add_book_to_collection(&self, collection_id: &CollectionId, book_id: &BookId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            let max_pos: i32 = conn.query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM book_collections WHERE collection_id = ?1",
                params![collection_id.to_string()],
                |r| r.get(0),
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO book_collections (collection_id, book_id, position) VALUES (?1, ?2, ?3)",
                params![collection_id.to_string(), book_id.to_string(), max_pos],
            )?;
            Ok(())
        })
    }

    pub fn remove_book_from_collection(&self, collection_id: &CollectionId, book_id: &BookId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "DELETE FROM book_collections WHERE collection_id = ?1 AND book_id = ?2",
                params![collection_id.to_string(), book_id.to_string()],
            )?;
            Ok(())
        })
    }

    pub fn get_collections_for_book(&self, book_id: &BookId) -> StorageResult<Vec<Collection>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT c.id, c.name, c.description, c.version, c.created_at, c.updated_at, c.device_id, c.is_deleted, c.deleted_at
                FROM collections c
                JOIN book_collections bc ON c.id = bc.collection_id
                WHERE bc.book_id = ?1 AND c.is_deleted = 0
                ORDER BY c.name ASC
                "#,
            )?;
            let rows = stmt.query_map(params![book_id.to_string()], Self::row_to_collection)?;
            let mut collections = Vec::new();
            for r in rows {
                collections.push(r?);
            }
            Ok(collections)
        })
    }

    fn row_to_collection(row: &rusqlite::Row) -> rusqlite::Result<Collection> {
        let id_str: String = row.get(0)?;
        let name: String = row.get(1)?;
        let description: Option<String> = row.get(2)?;
        let version_num: i64 = row.get(3)?;
        let created_at_str: String = row.get(4)?;
        let updated_at_str: String = row.get(5)?;
        let device_id_str: String = row.get(6)?;
        let is_deleted_int: i32 = row.get(7)?;
        let deleted_at_str: Option<String> = row.get(8)?;

        let id: CollectionId = id_str.parse().unwrap_or_default();
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

        Ok(Collection {
            id,
            name,
            description,
            book_ids: Vec::new(),
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
