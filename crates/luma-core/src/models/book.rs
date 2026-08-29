use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::error::LumaError;
use crate::ids::{AuthorId, BookId, FileId, SeriesId};
use crate::version::SyncMetadata;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentFormat {
    Epub,
    Pdf,
}

impl fmt::Display for DocumentFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DocumentFormat::Epub => write!(f, "epub"),
            DocumentFormat::Pdf => write!(f, "pdf"),
        }
    }
}

impl FromStr for DocumentFormat {
    type Err = LumaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "epub" => Ok(DocumentFormat::Epub),
            "pdf" => Ok(DocumentFormat::Pdf),
            other => Err(LumaError::UnsupportedFormat(other.to_string())),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BookFile {
    pub id: FileId,
    pub book_id: BookId,
    pub format: DocumentFormat,
    pub relative_path: String,
    pub file_size_bytes: u64,
    pub sha256_hash: String,
    pub created_at: DateTime<Utc>,
}

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
    pub cover_image_path: Option<String>,
    pub primary_file_id: Option<FileId>,
    pub sync: SyncMetadata,
}

impl Book {
    pub fn new(title: impl Into<String>, device_id: crate::ids::DeviceId) -> Self {
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
            cover_image_path: None,
            primary_file_id: None,
            sync: SyncMetadata::new(device_id),
        }
    }
}
