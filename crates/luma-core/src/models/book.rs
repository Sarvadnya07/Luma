use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::error::LumaError;
use crate::ids::{AuthorId, BookId, CoverImageId, DeviceId, FileId, SeriesId};
use crate::version::SyncMetadata;

// ============================================================================
// Constants – centralised strings
// ============================================================================

// DocumentFormat string representations
pub const FORMAT_EPUB: &str = "epub";
pub const FORMAT_PDF: &str = "pdf";
pub const FORMAT_CBZ: &str = "cbz";
pub const FORMAT_CBR: &str = "cbr";
pub const FORMAT_TXT: &str = "txt";
pub const FORMAT_MD: &str = "md";
pub const FORMAT_HTML: &str = "html";

// Alternative aliases
pub const FORMAT_MARKDOWN: &str = "markdown";
pub const FORMAT_HTM: &str = "htm";
pub const FORMAT_XHTML: &str = "xhtml";



// ReadingStatus string representations
pub const STATUS_UNREAD: &str = "unread";
pub const STATUS_READING: &str = "reading";
pub const STATUS_COMPLETED: &str = "completed";
pub const STATUS_ARCHIVED: &str = "archived";

// LibraryState string representations
pub const STATE_ACTIVE: &str = "active";
pub const STATE_ARCHIVED: &str = "archived";
pub const STATE_TRASHED: &str = "trashed";

// FileAvailability string representations
pub const AVAIL_AVAILABLE: &str = "available";
pub const AVAIL_MISSING: &str = "missing";
pub const AVAIL_CHANGED: &str = "changed";
pub const AVAIL_INVALID: &str = "invalid";

// ============================================================================
// DocumentFormat
// ============================================================================

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
        let s = match self {
            DocumentFormat::Epub => FORMAT_EPUB,
            DocumentFormat::Pdf => FORMAT_PDF,
            DocumentFormat::Cbz => FORMAT_CBZ,
            DocumentFormat::Cbr => FORMAT_CBR,
            DocumentFormat::Txt => FORMAT_TXT,
            DocumentFormat::Md => FORMAT_MD,
            DocumentFormat::Html => FORMAT_HTML,
        };
        write!(f, "{}", s)
    }
}

impl FromStr for DocumentFormat {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            FORMAT_EPUB => Ok(DocumentFormat::Epub),
            FORMAT_PDF => Ok(DocumentFormat::Pdf),
            FORMAT_CBZ => Ok(DocumentFormat::Cbz),
            FORMAT_CBR => Ok(DocumentFormat::Cbr),
            FORMAT_TXT => Ok(DocumentFormat::Txt),
            FORMAT_MD | FORMAT_MARKDOWN => Ok(DocumentFormat::Md),
            FORMAT_HTML | FORMAT_HTM | FORMAT_XHTML => Ok(DocumentFormat::Html),
            other => Err(LumaError::UnsupportedFormat(format!(
                "Unsupported format: {}",
                other
            ))),
        }
    }
}

// ============================================================================
// ReadingStatus
// ============================================================================

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
        let s = match self {
            ReadingStatus::Unread => STATUS_UNREAD,
            ReadingStatus::Reading => STATUS_READING,
            ReadingStatus::Completed => STATUS_COMPLETED,
            ReadingStatus::Archived => STATUS_ARCHIVED,
        };
        write!(f, "{}", s)
    }
}

impl FromStr for ReadingStatus {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            STATUS_UNREAD => Ok(ReadingStatus::Unread),
            STATUS_READING => Ok(ReadingStatus::Reading),
            STATUS_COMPLETED => Ok(ReadingStatus::Completed),
            STATUS_ARCHIVED => Ok(ReadingStatus::Archived),
            other => Err(LumaError::ValidationError(format!(
                "Invalid reading status: {}",
                other
            ))),
        }
    }
}

// ============================================================================
// LibraryState
// ============================================================================

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
        let s = match self {
            LibraryState::Active => STATE_ACTIVE,
            LibraryState::Archived => STATE_ARCHIVED,
            LibraryState::Trashed => STATE_TRASHED,
        };
        write!(f, "{}", s)
    }
}

impl FromStr for LibraryState {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            STATE_ACTIVE => Ok(LibraryState::Active),
            STATE_ARCHIVED => Ok(LibraryState::Archived),
            STATE_TRASHED => Ok(LibraryState::Trashed),
            other => Err(LumaError::ValidationError(format!(
                "Invalid library state: {}",
                other
            ))),
        }
    }
}

// ============================================================================
// FileAvailability
// ============================================================================

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
        let s = match self {
            FileAvailability::Available => AVAIL_AVAILABLE,
            FileAvailability::Missing => AVAIL_MISSING,
            FileAvailability::Changed => AVAIL_CHANGED,
            FileAvailability::Invalid => AVAIL_INVALID,
        };
        write!(f, "{}", s)
    }
}

impl FromStr for FileAvailability {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            AVAIL_AVAILABLE => Ok(FileAvailability::Available),
            AVAIL_MISSING => Ok(FileAvailability::Missing),
            AVAIL_CHANGED => Ok(FileAvailability::Changed),
            AVAIL_INVALID => Ok(FileAvailability::Invalid),
            other => Err(LumaError::ValidationError(format!(
                "Invalid file availability: {}",
                other
            ))),
        }
    }
}


// ============================================================================
// BookFile
// ============================================================================

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

// ============================================================================
// Book
// ============================================================================

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