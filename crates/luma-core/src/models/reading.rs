use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ids::{BookId, BookmarkId, DeviceId, SessionId};
use crate::version::SyncMetadata;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReadingProgress {
    pub book_id: BookId,
    pub progress_percentage: f32,
    pub current_locator: String,
    pub current_chapter_title: Option<String>,
    pub current_page_number: Option<u32>,
    pub total_pages: Option<u32>,
    pub last_read_at: DateTime<Utc>,
    pub sync: SyncMetadata,
}

impl ReadingProgress {
    pub fn new(book_id: BookId, locator: impl Into<String>, device_id: DeviceId) -> Self {
        let now = Utc::now();
        Self {
            book_id,
            progress_percentage: 0.0,
            current_locator: locator.into(),
            current_chapter_title: None,
            current_page_number: None,
            total_pages: None,
            last_read_at: now,
            sync: SyncMetadata::new(device_id),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: BookmarkId,
    pub book_id: BookId,
    pub locator: String,
    pub title: Option<String>,
    pub chapter_title: Option<String>,
    pub page_number: Option<u32>,
    pub sync: SyncMetadata,
}

impl Bookmark {
    pub fn new(book_id: BookId, locator: impl Into<String>, device_id: DeviceId) -> Self {
        Self {
            id: BookmarkId::new(),
            book_id,
            locator: locator.into(),
            title: None,
            chapter_title: None,
            page_number: None,
            sync: SyncMetadata::new(device_id),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReadingSession {
    pub id: SessionId,
    pub book_id: BookId,
    pub device_id: DeviceId,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: u32,
    pub start_progress_pct: f32,
    pub end_progress_pct: f32,
}

impl ReadingSession {
    pub fn start(book_id: BookId, device_id: DeviceId, start_progress_pct: f32) -> Self {
        Self {
            id: SessionId::new(),
            book_id,
            device_id,
            started_at: Utc::now(),
            ended_at: None,
            duration_seconds: 0,
            start_progress_pct,
            end_progress_pct: start_progress_pct,
        }
    }

    pub fn complete(&mut self, end_progress_pct: f32) {
        let now = Utc::now();
        self.ended_at = Some(now);
        let duration = (now - self.started_at).num_seconds();
        self.duration_seconds = if duration > 0 { duration as u32 } else { 0 };
        self.end_progress_pct = end_progress_pct;
    }
}
