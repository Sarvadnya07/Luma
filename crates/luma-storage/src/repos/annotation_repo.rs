use rusqlite::params;
use luma_core::ids::{AnnotationId, BookId, DeviceId};
use luma_core::models::annotation::{Annotation, AnnotationType};
use luma_core::version::{EntityVersion, SyncMetadata};

use crate::db::Database;
use crate::error::{StorageError, StorageResult};

pub struct AnnotationRepository {
    db: Database,
}

impl AnnotationRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, annotation: &Annotation) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            let type_str = match annotation.annotation_type {
                AnnotationType::Highlight => "highlight",
                AnnotationType::Underline => "underline",
                AnnotationType::Note => "note",
                AnnotationType::Bookmark => "bookmark",
            };

            conn.execute(
                r#"
                INSERT INTO annotations (
                    id, book_id, annotation_type, color_hex, quote, note,
                    anchor_payload_json, version, created_at, updated_at,
                    device_id, is_deleted, deleted_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                "#,
                params![
                    annotation.id.to_string(),
                    annotation.book_id.to_string(),
                    type_str,
                    annotation.color_hex,
                    annotation.quote,
                    annotation.note,
                    annotation.anchor_payload_json,
                    annotation.sync.version.0 as i64,
                    annotation.sync.created_at.to_rfc3339(),
                    annotation.sync.updated_at.to_rfc3339(),
                    annotation.sync.device_id.to_string(),
                    if annotation.sync.is_deleted { 1 } else { 0 },
                    annotation.sync.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_by_book(&self, book_id: &BookId) -> StorageResult<Vec<Annotation>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, annotation_type, color_hex, quote, note,
                       anchor_payload_json, version, created_at, updated_at,
                       device_id, is_deleted, deleted_at
                FROM annotations
                WHERE book_id = ?1 AND is_deleted = 0
                ORDER BY created_at ASC
                "#,
            )?;

            let rows = stmt.query_map(params![book_id.to_string()], |row| {
                let id_str: String = row.get(0)?;
                let book_id_str: String = row.get(1)?;
                let type_str: String = row.get(2)?;
                let color_hex: String = row.get(3)?;
                let quote: String = row.get(4)?;
                let note: Option<String> = row.get(5)?;
                let anchor_payload_json: String = row.get(6)?;
                let version_num: i64 = row.get(7)?;
                let created_at_str: String = row.get(8)?;
                let updated_at_str: String = row.get(9)?;
                let device_id_str: String = row.get(10)?;
                let is_deleted_int: i32 = row.get(11)?;
                let deleted_at_str: Option<String> = row.get(12)?;

                let ann_id: AnnotationId = id_str.parse().unwrap_or_default();
                let b_id: BookId = book_id_str.parse().unwrap_or_default();
                let device_id: DeviceId = device_id_str.parse().unwrap_or_default();

                let annotation_type = match type_str.as_str() {
                    "underline" => AnnotationType::Underline,
                    "note" => AnnotationType::Note,
                    "bookmark" => AnnotationType::Bookmark,
                    _ => AnnotationType::Highlight,
                };

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

                Ok(Annotation {
                    id: ann_id,
                    book_id: b_id,
                    annotation_type,
                    color_hex,
                    quote,
                    note,
                    anchor_payload_json,
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

            let mut annotations = Vec::new();
            for r in rows {
                annotations.push(r?);
            }
            Ok(annotations)
        })
    }

    pub fn delete(&self, id: &AnnotationId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE annotations SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now'), version = version + 1 WHERE id = ?1",
                params![id.to_string()],
            )?;
            Ok(())
        })
    }

    pub fn update_note(&self, id: &AnnotationId, note: Option<&str>) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE annotations SET note = ?1, updated_at = datetime('now'), version = version + 1 WHERE id = ?2",
                params![note, id.to_string()],
            )?;
            Ok(())
        })
    }
}
