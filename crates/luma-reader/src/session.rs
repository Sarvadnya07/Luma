use chrono::{DateTime, Utc};
use luma_core::ids::{BookId, FileId};
use luma_core::models::book::DocumentFormat;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentSession {
    pub book_id: BookId,
    pub file_id: FileId,
    pub format: DocumentFormat,
    pub current_locator: String,
    pub current_chapter_title: Option<String>,
    pub current_page_number: Option<u32>,
    pub total_pages_or_spines: Option<u32>,
    pub progress_percentage: f32,
    pub opened_at: DateTime<Utc>,
    pub last_interaction_at: DateTime<Utc>,
}

impl DocumentSession {
    pub fn new(
        book_id: BookId,
        file_id: FileId,
        format: DocumentFormat,
        initial_locator: Option<String>,
        total_pages_or_spines: Option<u32>,
    ) -> Self {
        let now = Utc::now();
        Self {
            book_id,
            file_id,
            format,
            current_locator: initial_locator.unwrap_or_else(|| match format {
                DocumentFormat::Epub => "epubcfi(/6/2[chapter-1]!/4/1:0)".to_string(),
                DocumentFormat::Pdf => "page=1".to_string(),
                _ => "offset=0".to_string(),
            }),
            current_chapter_title: None,
            current_page_number: Some(1),
            total_pages_or_spines,
            progress_percentage: 0.0,
            opened_at: now,
            last_interaction_at: now,
        }
    }

    pub fn update_progress(&mut self, locator: impl Into<String>, percentage: f32) {
        self.current_locator = locator.into();
        self.progress_percentage = percentage.clamp(0.0, 1.0);
        self.last_interaction_at = Utc::now();
    }
}
