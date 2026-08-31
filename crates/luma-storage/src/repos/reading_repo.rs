use luma_core::ids::{BookId, DeviceId};
use luma_core::models::reading::ReadingProgress;
use luma_core::version::{EntityVersion, SyncMetadata};
use rusqlite::params;

use crate::db::Database;
use crate::error::StorageResult;

pub struct ReadingProgressRepository {
    db: Database,
}

impl ReadingProgressRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn save(&self, progress: &ReadingProgress) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO reading_progress (
                    book_id, progress_percentage, current_locator, current_chapter_title,
                    current_page_number, total_pages, last_read_at, version,
                    created_at, updated_at, device_id, is_deleted, deleted_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                ON CONFLICT(book_id) DO UPDATE SET
                    progress_percentage = excluded.progress_percentage,
                    current_locator = excluded.current_locator,
                    current_chapter_title = excluded.current_chapter_title,
                    current_page_number = excluded.current_page_number,
                    total_pages = excluded.total_pages,
                    last_read_at = excluded.last_read_at,
                    version = excluded.version,
                    updated_at = excluded.updated_at,
                    device_id = excluded.device_id
                "#,
                params![
                    progress.book_id.to_string(),
                    progress.progress_percentage,
                    progress.current_locator,
                    progress.current_chapter_title,
                    progress.current_page_number,
                    progress.total_pages,
                    progress.last_read_at.to_rfc3339(),
                    progress.sync.version.0 as i64,
                    progress.sync.created_at.to_rfc3339(),
                    progress.sync.updated_at.to_rfc3339(),
                    progress.sync.device_id.to_string(),
                    if progress.sync.is_deleted { 1 } else { 0 },
                    progress.sync.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )?;
            Ok(())
        })
    }

    pub fn get(&self, book_id: &BookId) -> StorageResult<Option<ReadingProgress>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT book_id, progress_percentage, current_locator, current_chapter_title,
                       current_page_number, total_pages, last_read_at, version,
                       created_at, updated_at, device_id, is_deleted, deleted_at
                FROM reading_progress
                WHERE book_id = ?1 AND is_deleted = 0
                "#,
            )?;

            let mut rows = stmt.query(params![book_id.to_string()])?;
            if let Some(row) = rows.next()? {
                let b_id_str: String = row.get(0)?;
                let progress_percentage: f32 = row.get(1)?;
                let current_locator: String = row.get(2)?;
                let current_chapter_title: Option<String> = row.get(3)?;
                let current_page_number: Option<u32> = row.get(4)?;
                let total_pages: Option<u32> = row.get(5)?;
                let last_read_str: String = row.get(6)?;
                let version_num: i64 = row.get(7)?;
                let created_at_str: String = row.get(8)?;
                let updated_at_str: String = row.get(9)?;
                let device_id_str: String = row.get(10)?;
                let is_deleted_int: i32 = row.get(11)?;
                let deleted_at_str: Option<String> = row.get(12)?;

                let b_id: BookId = b_id_str.parse().unwrap_or_default();
                let device_id: DeviceId = device_id_str.parse().unwrap_or_default();

                let last_read_at = chrono::DateTime::parse_from_rfc3339(&last_read_str)
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
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

                Ok(Some(ReadingProgress {
                    book_id: b_id,
                    progress_percentage,
                    current_locator,
                    current_chapter_title,
                    current_page_number,
                    total_pages,
                    last_read_at,
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
}
