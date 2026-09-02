use crate::db::Database;
use crate::error::StorageResult;
use rusqlite::params;
use serde::{Deserialize, Serialize};

// ============================================================================
// Constants – SQL templates
// ============================================================================

// SQL query templates (with placeholders)
const SQL_INSERT_BACKUP_RECORD: &str = r#"
    INSERT INTO backup_records (
        id, backup_name, file_path, file_size_bytes, sha256_hash,
        books_count, annotations_count, bookmarks_count, created_at
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
"#;

const SQL_SELECT_ALL_BACKUP_RECORDS: &str = r#"
    SELECT id, backup_name, file_path, file_size_bytes, sha256_hash,
           books_count, annotations_count, bookmarks_count, created_at
    FROM backup_records
    ORDER BY created_at DESC
"#;

const SQL_DELETE_BACKUP_RECORD: &str = "DELETE FROM backup_records WHERE id = ?1";

// ============================================================================
// BackupRecord
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRecord {
    pub id: String,
    pub backup_name: String,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub sha256_hash: String,
    pub books_count: u32,
    pub annotations_count: u32,
    pub bookmarks_count: u32,
    pub created_at: String,
}

// ============================================================================
// BackupRecordRepository
// ============================================================================

#[derive(Clone)]
pub struct BackupRecordRepository {
    db: Database,
}

impl BackupRecordRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, record: &BackupRecord) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                SQL_INSERT_BACKUP_RECORD,
                params![
                    record.id,
                    record.backup_name,
                    record.file_path,
                    record.file_size_bytes as i64,
                    record.sha256_hash,
                    record.books_count as i64,
                    record.annotations_count as i64,
                    record.bookmarks_count as i64,
                    record.created_at,
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<BackupRecord>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(SQL_SELECT_ALL_BACKUP_RECORDS)?;

            let rows = stmt.query_map([], |r| {
                Ok(BackupRecord {
                    id: r.get(0)?,
                    backup_name: r.get(1)?,
                    file_path: r.get(2)?,
                    file_size_bytes: r.get::<_, i64>(3)? as u64,
                    sha256_hash: r.get(4)?,
                    books_count: r.get::<_, i64>(5)? as u32,
                    annotations_count: r.get::<_, i64>(6)? as u32,
                    bookmarks_count: r.get::<_, i64>(7)? as u32,
                    created_at: r.get(8)?,
                })
            })?;

            let mut records = Vec::new();
            for r in rows.flatten() {
                records.push(r);
            }
            Ok(records)
        })
    }

    pub fn delete(&self, id: &str) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(SQL_DELETE_BACKUP_RECORD, [id])?;
            Ok(())
        })
    }
}