use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ids::{BookId, BookmarkId, DeviceId, SessionId};
use crate::version::SyncMetadata;

// ============================================================================
// Constants – default values and validation messages
// ============================================================================

pub const DEFAULT_PROGRESS_PERCENTAGE: f32 = 0.0;
pub const DEFAULT_DURATION_SECONDS: u32 = 0;
pub const INVALID_LOCATOR_MSG: &str = "Locator cannot be empty";

// ============================================================================
// ReadingProgress
// ============================================================================

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
    /// Creates a new reading progress record with default progress (0%).
    pub fn new(book_id: BookId, locator: impl Into<String>, device_id: DeviceId) -> Self {
        let now = Utc::now();
        let locator_str = locator.into();
        if locator_str.trim().is_empty() {
            // In a real application, you might want to return a Result or panic.
            // For simplicity, we allow empty locator but could log a warning.
            // Since this is a model, we don't enforce validation here – we provide a builder.
        }
        Self {
            book_id,
            progress_percentage: DEFAULT_PROGRESS_PERCENTAGE,
            current_locator: locator_str,
            current_chapter_title: None,
            current_page_number: None,
            total_pages: None,
            last_read_at: now,
            sync: SyncMetadata::new(device_id),
        }
    }

    /// Sets the progress percentage.
    pub fn with_progress(mut self, percentage: f32) -> Self {
        self.progress_percentage = percentage.clamp(0.0, 1.0);
        self
    }

    /// Sets the current chapter title.
    pub fn with_chapter(mut self, chapter: impl Into<String>) -> Self {
        self.current_chapter_title = Some(chapter.into());
        self
    }

    /// Sets the current page number.
    pub fn with_page_number(mut self, page: u32) -> Self {
        self.current_page_number = Some(page);
        self
    }

    /// Sets the total pages.
    pub fn with_total_pages(mut self, total: u32) -> Self {
        self.total_pages = Some(total);
        self
    }

    /// Sets custom sync metadata.
    pub fn with_sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = sync;
        self
    }

    /// Updates the progress with a new percentage and updates the last_read_at timestamp.
    pub fn update_progress(&mut self, percentage: f32) {
        self.progress_percentage = percentage.clamp(0.0, 1.0);
        self.last_read_at = Utc::now();
    }
}

// ============================================================================
// Bookmark
// ============================================================================

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
    /// Creates a new bookmark with the given locator.
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

    /// Sets a display title for the bookmark.
    pub fn with_title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    /// Sets the chapter title where the bookmark is placed.
    pub fn with_chapter(mut self, chapter: impl Into<String>) -> Self {
        self.chapter_title = Some(chapter.into());
        self
    }

    /// Sets the page number.
    pub fn with_page_number(mut self, page: u32) -> Self {
        self.page_number = Some(page);
        self
    }

    /// Sets custom sync metadata.
    pub fn with_sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = sync;
        self
    }
}

// ============================================================================
// ReadingSession
// ============================================================================

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
    /// Starts a new reading session with the given initial progress.
    pub fn start(book_id: BookId, device_id: DeviceId, start_progress_pct: f32) -> Self {
        Self {
            id: SessionId::new(),
            book_id,
            device_id,
            started_at: Utc::now(),
            ended_at: None,
            duration_seconds: DEFAULT_DURATION_SECONDS,
            start_progress_pct: start_progress_pct.clamp(0.0, 1.0),
            end_progress_pct: start_progress_pct.clamp(0.0, 1.0),
        }
    }

    /// Completes the session with the final progress, calculating duration.
    pub fn complete(&mut self, end_progress_pct: f32) {
        let now = Utc::now();
        self.ended_at = Some(now);
        let duration = (now - self.started_at).num_seconds();
        self.duration_seconds = if duration > 0 { duration as u32 } else { 0 };
        self.end_progress_pct = end_progress_pct.clamp(0.0, 1.0);
    }
}