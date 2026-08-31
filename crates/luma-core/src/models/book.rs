use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::error::LumaError;
use crate::ids::{AuthorId, BookId, CoverImageId, DeviceId, FileId, SeriesId};
use crate::version::SyncMetadata;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DocumentFormat {
    #[default]
    Epub,
    Pdf,
    Cbz,
    Cbr,
    Txt,
    Md,
    Html,
}

impl fmt::Display for DocumentFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DocumentFormat::Epub => write!(f, "epub"),
            DocumentFormat::Pdf => write!(f, "pdf"),
            DocumentFormat::Cbz => write!(f, "cbz"),
            DocumentFormat::Cbr => write!(f, "cbr"),
            DocumentFormat::Txt => write!(f, "txt"),
            DocumentFormat::Md => write!(f, "md"),
            DocumentFormat::Html => write!(f, "html"),
        }
    }
}

impl FromStr for DocumentFormat {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            "epub" => Ok(DocumentFormat::Epub),
            "pdf" => Ok(DocumentFormat::Pdf),
            "cbz" => Ok(DocumentFormat::Cbz),
            "cbr" => Ok(DocumentFormat::Cbr),
            "txt" => Ok(DocumentFormat::Txt),
            "md" | "markdown" => Ok(DocumentFormat::Md),
            "html" | "htm" | "xhtml" => Ok(DocumentFormat::Html),
            other => Err(LumaError::UnsupportedFormat(other.to_string())),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ReadingStatus {
    #[default]
    Unread,
    Reading,
    Completed,
    Archived,
}

impl fmt::Display for ReadingStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ReadingStatus::Unread => write!(f, "unread"),
            ReadingStatus::Reading => write!(f, "reading"),
            ReadingStatus::Completed => write!(f, "completed"),
            ReadingStatus::Archived => write!(f, "archived"),
        }
    }
}

impl FromStr for ReadingStatus {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            "unread" => Ok(ReadingStatus::Unread),
            "reading" => Ok(ReadingStatus::Reading),
            "completed" => Ok(ReadingStatus::Completed),
            "archived" => Ok(ReadingStatus::Archived),
            other => Err(LumaError::ValidationError(format!("Invalid reading status: {}", other))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LibraryState {
    #[default]
    Active,
    Archived,
    Trashed,
}

impl fmt::Display for LibraryState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LibraryState::Active => write!(f, "active"),
            LibraryState::Archived => write!(f, "archived"),
            LibraryState::Trashed => write!(f, "trashed"),
        }
    }
}

impl FromStr for LibraryState {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            "active" => Ok(LibraryState::Active),
            "archived" => Ok(LibraryState::Archived),
            "trashed" => Ok(LibraryState::Trashed),
            other => Err(LumaError::ValidationError(format!("Invalid library state: {}", other))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum FileAvailability {
    #[default]
    Available,
    Missing,
    Changed,
    Invalid,
}

impl fmt::Display for FileAvailability {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FileAvailability::Available => write!(f, "available"),
            FileAvailability::Missing => write!(f, "missing"),
            FileAvailability::Changed => write!(f, "changed"),
            FileAvailability::Invalid => write!(f, "invalid"),
        }
    }
}

impl FromStr for FileAvailability {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            "available" => Ok(FileAvailability::Available),
            "missing" => Ok(FileAvailability::Missing),
            "changed" => Ok(FileAvailability::Changed),
            "invalid" => Ok(FileAvailability::Invalid),
            other => Err(LumaError::ValidationError(format!("Invalid file availability: {}", other))),
        }
    }
}

/// Physical representation of a document on disk
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BookFile {
    pub id: FileId,
    pub book_id: BookId,
    pub original_filename: String,
    pub relative_path: String,
    pub canonical_path: Option<String>,
    pub format: DocumentFormat,
    pub mime_type: Option<String>,
    pub file_size_bytes: u64,
    pub sha256_hash: String,
    pub imported_at: DateTime<Utc>,
    pub modified_at: Option<DateTime<Utc>>,
    pub availability: FileAvailability,
}

impl BookFile {
    pub fn new(
        book_id: BookId,
        original_filename: impl Into<String>,
        relative_path: impl Into<String>,
        format: DocumentFormat,
        file_size_bytes: u64,
        sha256_hash: impl Into<String>,
    ) -> Self {
        Self {
            id: FileId::new(),
            book_id,
            original_filename: original_filename.into(),
            relative_path: relative_path.into(),
            canonical_path: None,
            format,
            mime_type: None,
            file_size_bytes,
            sha256_hash: sha256_hash.into(),
            imported_at: Utc::now(),
            modified_at: None,
            availability: FileAvailability::Available,
        }
    }
}

/// Logical publication representation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Book {
    pub id: BookId,
    pub title: String,
    pub subtitle: Option<String>,
    pub author_ids: Vec<AuthorId>,
    pub series_id: Option<SeriesId>,
    pub series_index: Option<f32>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub published_date: Option<String>,
    pub language: Option<String>,
    pub isbn: Option<String>,
    pub cover_image_id: Option<CoverImageId>,
    pub cover_image_path: Option<String>,
    pub primary_file_id: Option<FileId>,
    pub reading_status: ReadingStatus,
    pub library_state: LibraryState,
    pub trashed_at: Option<DateTime<Utc>>,
    pub sync: SyncMetadata,
}

impl Book {
    pub fn new(title: impl Into<String>, device_id: DeviceId) -> Self {
        Self {
            id: BookId::new(),
            title: title.into(),
            subtitle: None,
            author_ids: Vec::new(),
            series_id: None,
            series_index: None,
            description: None,
            publisher: None,
            published_date: None,
            language: None,
            isbn: None,
            cover_image_id: None,
            cover_image_path: None,
            primary_file_id: None,
            reading_status: ReadingStatus::Unread,
            library_state: LibraryState::Active,
            trashed_at: None,
            sync: SyncMetadata::new(device_id),
        }
    }
}
