use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ids::{BookId, CoverImageId, FileId, ImportJobId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DuplicateMatchLevel {
    ExactDuplicate,
    LikelyDuplicate,
    PossibleDuplicate,
    Unrelated,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DuplicateAssessment {
    pub level: DuplicateMatchLevel,
    pub existing_book_id: Option<BookId>,
    pub existing_file_id: Option<FileId>,
    pub confidence_score: f32,
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportSource {
    UserImport,
    DragAndDrop,
    DirectoryScan,
    Reconcile,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportJobStatus {
    Queued,
    Processing,
    Completed,
    PartialSuccess,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportJobItem {
    pub source_path: String,
    pub original_filename: String,
    pub status: String,
    pub book_id: Option<BookId>,
    pub file_id: Option<FileId>,
    pub duplicate_level: Option<DuplicateMatchLevel>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportJob {
    pub id: ImportJobId,
    pub total_files: u32,
    pub completed_count: u32,
    pub failed_count: u32,
    pub skipped_count: u32,
    pub status: ImportJobStatus,
    pub items: Vec<ImportJobItem>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

impl ImportJob {
    pub fn new(total_files: u32) -> Self {
        Self {
            id: ImportJobId::new(),
            total_files,
            completed_count: 0,
            failed_count: 0,
            skipped_count: 0,
            status: ImportJobStatus::Processing,
            items: Vec::new(),
            started_at: Utc::now(),
            ended_at: None,
        }
    }

    pub fn mark_completed(&mut self) {
        self.ended_at = Some(Utc::now());
        self.status = if self.failed_count == 0 {
            ImportJobStatus::Completed
        } else if self.completed_count > 0 {
            ImportJobStatus::PartialSuccess
        } else {
            ImportJobStatus::Failed
        };
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoverImage {
    pub id: CoverImageId,
    pub book_id: Option<BookId>,
    pub file_size_bytes: u64,
    pub sha256_hash: String,
    pub mime_type: String,
    pub relative_path: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub created_at: DateTime<Utc>,
}

impl CoverImage {
    pub fn new(
        book_id: Option<BookId>,
        file_size_bytes: u64,
        sha256_hash: impl Into<String>,
        mime_type: impl Into<String>,
        relative_path: impl Into<String>,
    ) -> Self {
        Self {
            id: CoverImageId::new(),
            book_id,
            file_size_bytes,
            sha256_hash: sha256_hash.into(),
            mime_type: mime_type.into(),
            relative_path: relative_path.into(),
            width: None,
            height: None,
            created_at: Utc::now(),
        }
    }
}
