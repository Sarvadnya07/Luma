use luma_core::ids::{DeviceId, SeriesId};
use luma_core::models::metadata::Series;
use luma_core::version::{EntityVersion, SyncMetadata};
use rusqlite::params;

use crate::db::Database;
use crate::error::StorageResult;

pub struct SeriesRepository {
    db: Database,
}

impl SeriesRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_or_create_by_title(
        &self,
        title: &str,
        device_id: DeviceId,
    ) -> StorageResult<Series> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, title, description, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM series WHERE title = ?1 AND is_deleted = 0")?;
            let mut rows = stmt.query(params![title])?;
            if let Some(row) = rows.next()? {
                return Ok(Self::row_to_series(row)?);
            }
            drop(rows);
            drop(stmt);

            let series = Series::new(title, device_id);
            conn.execute(
                "INSERT INTO series (id, title, description, version, created_at, updated_at, device_id, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    series.id.to_string(),
                    series.title,
                    series.description,
                    series.sync.version.0 as i64,
                    series.sync.created_at.to_rfc3339(),
                    series.sync.updated_at.to_rfc3339(),
                    series.sync.device_id.to_string(),
                    0,
                ],
            )?;

            Ok(series)
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Series>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, title, description, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM series WHERE is_deleted = 0 ORDER BY title ASC")?;
            let rows = stmt.query_map([], Self::row_to_series)?;
            let mut series_list = Vec::new();
            for r in rows {
                series_list.push(r?);
            }
            Ok(series_list)
        })
    }

    pub fn get_by_id(&self, id: &SeriesId) -> StorageResult<Option<Series>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, title, description, version, created_at, updated_at, device_id, is_deleted, deleted_at FROM series WHERE id = ?1 AND is_deleted = 0")?;
            let mut rows = stmt.query(params![id.to_string()])?;
            if let Some(row) = rows.next()? {
                Ok(Some(Self::row_to_series(row)?))
            } else {
                Ok(None)
            }
        })
    }

    fn row_to_series(row: &rusqlite::Row) -> rusqlite::Result<Series> {
        let id_str: String = row.get(0)?;
        let title: String = row.get(1)?;
        let description: Option<String> = row.get(2)?;
        let version_num: i64 = row.get(3)?;
        let created_at_str: String = row.get(4)?;
        let updated_at_str: String = row.get(5)?;
        let device_id_str: String = row.get(6)?;
        let is_deleted_int: i32 = row.get(7)?;
        let deleted_at_str: Option<String> = row.get(8)?;

        let id: SeriesId = id_str.parse().unwrap_or_default();
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

        Ok(Series {
            id,
            title,
            description,
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
