use luma_core::ids::{AnnotationId, BookId, DeviceId};
use luma_core::models::annotation::{Annotation, AnnotationType};
use luma_core::version::{EntityVersion, SyncMetadata};
use rusqlite::params;

use crate::db::Database;
use crate::error::StorageResult;

// ============================================================================
// Constants – table and column names, SQL templates, fallback values
// ============================================================================

const TABLE_ANNOTATIONS: &str = "annotations";
const TABLE_CHANGE_RECORDS: &str = "change_records";

// Column names used in queries
const COL_ID: &str = "id";
const COL_BOOK_ID: &str = "book_id";
const COL_ANNOTATION_TYPE: &str = "annotation_type";
const COL_COLOR_HEX: &str = "color_hex";
const COL_QUOTE: &str = "quote";
const COL_NOTE: &str = "note";
const COL_ANCHOR_PAYLOAD: &str = "anchor_payload_json";
const COL_VERSION: &str = "version";
const COL_CREATED_AT: &str = "created_at";
const COL_UPDATED_AT: &str = "updated_at";
const COL_DEVICE_ID: &str = "device_id";
const COL_IS_DELETED: &str = "is_deleted";
const COL_DELETED_AT: &str = "deleted_at";

// SQL query templates (with placeholders)
const SQL_INSERT_ANNOTATION: &str = r#"
    INSERT INTO annotations (
        id, book_id, annotation_type, color_hex, quote, note,
        anchor_payload_json, version, created_at, updated_at,
        device_id, is_deleted, deleted_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
"#;

const SQL_INSERT_CHANGE_RECORD: &str = r#"
    INSERT INTO change_records (
        id, entity_type, entity_id, version, device_id, operation, payload_json, occurred_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
"#;

const SQL_SELECT_ALL_ANNOTATIONS: &str = r#"
    SELECT id, book_id, annotation_type, color_hex, quote, note,
           anchor_payload_json, version, created_at, updated_at,
           device_id, is_deleted, deleted_at
    FROM annotations
    WHERE is_deleted = 0
    ORDER BY created_at ASC
"#;

const SQL_SELECT_BY_BOOK: &str = r#"
    SELECT id, book_id, annotation_type, color_hex, quote, note,
           anchor_payload_json, version, created_at, updated_at,
           device_id, is_deleted, deleted_at
    FROM annotations
    WHERE book_id = ?1 AND is_deleted = 0
    ORDER BY created_at ASC
"#;

const SQL_SOFT_DELETE_ANNOTATION: &str = r#"
    UPDATE annotations
    SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now'), version = version + 1
    WHERE id = ?1
"#;

const SQL_UPDATE_NOTE: &str = r#"
    UPDATE annotations
    SET note = ?1, updated_at = datetime('now'), version = version + 1
    WHERE id = ?2
"#;

// Entity and operation strings
const ENTITY_TYPE_ANNOTATION: &str = "annotation";
const OPERATION_CREATE: &str = "create";

// Fallback values for parsing errors
pub const FALLBACK_ANNOTATION_TYPE: AnnotationType = AnnotationType::Highlight;
pub const FALLBACK_VERSION: u64 = 1;

// ============================================================================
// AnnotationRepository
// ============================================================================

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
                SQL_INSERT_ANNOTATION,
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

            // Log change record for local‑first sync
            let payload = serde_json::json!({
                "book_id": annotation.book_id.to_string(),
                "type": type_str,
                "quote": annotation.quote,
            })
            .to_string();

            let _ = conn.execute(
                SQL_INSERT_CHANGE_RECORD,
                params![
                    format!("cr_{}", uuid::Uuid::now_v7().simple()),
                    ENTITY_TYPE_ANNOTATION,
                    annotation.id.to_string(),
                    annotation.sync.version.0 as i64,
                    annotation.sync.device_id.to_string(),
                    OPERATION_CREATE,
                    payload,
                ],
            );

            Ok(())
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Annotation>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(SQL_SELECT_ALL_ANNOTATIONS)?;
            let rows = stmt.query_map([], Self::map_row_to_annotation)?;
            let mut annotations = Vec::new();
            for r in rows {
                annotations.push(r?);
            }
            Ok(annotations)
        })
    }

    pub fn list_by_book(&self, book_id: &BookId) -> StorageResult<Vec<Annotation>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(SQL_SELECT_BY_BOOK)?;
            let rows = stmt.query_map(params![book_id.to_string()], Self::map_row_to_annotation)?;
            let mut annotations = Vec::new();
            for r in rows {
                annotations.push(r?);
            }
            Ok(annotations)
        })
    }

    pub fn delete(&self, id: &AnnotationId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(SQL_SOFT_DELETE_ANNOTATION, params![id.to_string()])?;
            Ok(())
        })
    }

    pub fn update_note(&self, id: &AnnotationId, note: Option<&str>) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(SQL_UPDATE_NOTE, params![note, id.to_string()])?;
            Ok(())
        })
    }

    // ------------------------------------------------------------------------
    // Helper: Row to Annotation mapping
    // ------------------------------------------------------------------------

    fn map_row_to_annotation(row: &rusqlite::Row) -> rusqlite::Result<Annotation> {
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

        // Parse IDs; fall back to defaults on error (should not happen in production)
        let ann_id = id_str.parse::<AnnotationId>().unwrap_or_default();
        let b_id = book_id_str.parse::<BookId>().unwrap_or_default();
        let device_id = device_id_str.parse::<DeviceId>().unwrap_or_default();

        let annotation_type = match type_str.as_str() {
            "underline" => AnnotationType::Underline,
            "note" => AnnotationType::Note,
            "bookmark" => AnnotationType::Bookmark,
            _ => FALLBACK_ANNOTATION_TYPE,
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
    }
}