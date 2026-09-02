use chrono::{DateTime, Utc};
use luma_core::ids::{BookId, FileId};
use luma_core::models::book::DocumentFormat;
use serde::{Deserialize, Serialize};

// ============================================================================
// Constants – default locators and error messages
// ============================================================================

/// Default locator for an EPUB document (first chapter, first paragraph).
pub const DEFAULT_EPUB_LOCATOR: &str = "epubcfi(/6/2[chapter-1]!/4/1:0)";

/// Default locator for a PDF document (first page).
pub const DEFAULT_PDF_LOCATOR: &str = "page=1";

/// Default locator for other document formats (generic offset).
pub const DEFAULT_GENERIC_LOCATOR: &str = "offset=0";

/// Default page number for a new session.
pub const DEFAULT_PAGE_NUMBER: u32 = 1;

/// Default progress percentage.
pub const DEFAULT_PROGRESS_PERCENTAGE: f32 = 0.0;

/// Validation message for progress percentage.
pub const PROGRESS_CLAMP_MSG: &str = "Progress percentage clamped to 0.0..1.0";

// ============================================================================
// Configuration
// ============================================================================

/// Configuration for creating a new document session.
#[derive(Debug, Clone)]
pub struct DocumentSessionConfig {
    /// Custom default locator for each format.
    pub default_locators: std::collections::HashMap<DocumentFormat, String>,
    /// Default page number if not provided.
    pub default_page_number: u32,
    /// Default progress percentage.
    pub default_progress_percentage: f32,
}

impl Default for DocumentSessionConfig {
    fn default() -> Self {
        let mut locators = std::collections::HashMap::new();
        locators.insert(DocumentFormat::Epub, DEFAULT_EPUB_LOCATOR.to_string());
        locators.insert(DocumentFormat::Pdf, DEFAULT_PDF_LOCATOR.to_string());
        locators.insert(DocumentFormat::Cbz, DEFAULT_GENERIC_LOCATOR.to_string());
        locators.insert(DocumentFormat::Cbr, DEFAULT_GENERIC_LOCATOR.to_string());
        locators.insert(DocumentFormat::Txt, DEFAULT_GENERIC_LOCATOR.to_string());
        locators.insert(DocumentFormat::Md, DEFAULT_GENERIC_LOCATOR.to_string());
        locators.insert(DocumentFormat::Html, DEFAULT_GENERIC_LOCATOR.to_string());

        Self {
            default_locators: locators,
            default_page_number: DEFAULT_PAGE_NUMBER,
            default_progress_percentage: DEFAULT_PROGRESS_PERCENTAGE,
        }
    }
}

impl DocumentSessionConfig {
    /// Returns the default locator for the given format.
    pub fn default_locator(&self, format: DocumentFormat) -> &str {
        self.default_locators
            .get(&format)
            .map(String::as_str)
            .unwrap_or(DEFAULT_GENERIC_LOCATOR)
    }
}

// ============================================================================
// DocumentSession
// ============================================================================

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
    /// Creates a new document session using the default configuration.
    pub fn new(
        book_id: BookId,
        file_id: FileId,
        format: DocumentFormat,
        initial_locator: Option<String>,
        total_pages_or_spines: Option<u32>,
    ) -> Self {
        let config = DocumentSessionConfig::default();
        Self::with_config(book_id, file_id, format, initial_locator, total_pages_or_spines, &config)
    }

    /// Creates a new document session with a custom configuration.
    pub fn with_config(
        book_id: BookId,
        file_id: FileId,
        format: DocumentFormat,
        initial_locator: Option<String>,
        total_pages_or_spines: Option<u32>,
        config: &DocumentSessionConfig,
    ) -> Self {
        let now = Utc::now();
        let locator = initial_locator
            .unwrap_or_else(|| config.default_locator(format).to_string());

        Self {
            book_id,
            file_id,
            format,
            current_locator: locator,
            current_chapter_title: None,
            current_page_number: Some(config.default_page_number),
            total_pages_or_spines,
            progress_percentage: config.default_progress_percentage,
            opened_at: now,
            last_interaction_at: now,
        }
    }

    /// Updates the session progress with a new locator and percentage.
    /// The percentage is clamped to the valid range [0.0, 1.0].
    pub fn update_progress(&mut self, locator: impl Into<String>, percentage: f32) {
        self.current_locator = locator.into();
        self.progress_percentage = percentage.clamp(0.0, 1.0);
        self.last_interaction_at = Utc::now();
    }

    // ------------------------------------------------------------------------
    // Fluent setters (for building or updating)
    // ------------------------------------------------------------------------

    pub fn with_chapter_title(mut self, title: impl Into<String>) -> Self {
        self.current_chapter_title = Some(title.into());
        self
    }

    pub fn with_page_number(mut self, page: u32) -> Self {
        self.current_page_number = Some(page);
        self
    }

    pub fn with_total_pages(mut self, total: u32) -> Self {
        self.total_pages_or_spines = Some(total);
        self
    }

    pub fn with_progress(mut self, percentage: f32) -> Self {
        self.progress_percentage = percentage.clamp(0.0, 1.0);
        self
    }
}

// ============================================================================
// Builder
// ============================================================================

#[derive(Debug, Clone, Default)]
pub struct DocumentSessionBuilder {
    book_id: Option<BookId>,
    file_id: Option<FileId>,
    format: Option<DocumentFormat>,
    initial_locator: Option<String>,
    total_pages_or_spines: Option<u32>,
    current_chapter_title: Option<String>,
    current_page_number: Option<u32>,
    progress_percentage: Option<f32>,
    config: Option<DocumentSessionConfig>,
}

impl DocumentSessionBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn book_id(mut self, book_id: BookId) -> Self {
        self.book_id = Some(book_id);
        self
    }

    pub fn file_id(mut self, file_id: FileId) -> Self {
        self.file_id = Some(file_id);
        self
    }

    pub fn format(mut self, format: DocumentFormat) -> Self {
        self.format = Some(format);
        self
    }

    pub fn initial_locator(mut self, locator: impl Into<String>) -> Self {
        self.initial_locator = Some(locator.into());
        self
    }

    pub fn total_pages(mut self, total: u32) -> Self {
        self.total_pages_or_spines = Some(total);
        self
    }

    pub fn chapter_title(mut self, title: impl Into<String>) -> Self {
        self.current_chapter_title = Some(title.into());
        self
    }

    pub fn page_number(mut self, page: u32) -> Self {
        self.current_page_number = Some(page);
        self
    }

    pub fn progress(mut self, percentage: f32) -> Self {
        self.progress_percentage = Some(percentage.clamp(0.0, 1.0));
        self
    }

    pub fn config(mut self, config: DocumentSessionConfig) -> Self {
        self.config = Some(config);
        self
    }

    pub fn build(self) -> Result<DocumentSession, String> {
        let book_id = self.book_id.ok_or_else(|| "book_id is required".to_string())?;
        let file_id = self.file_id.ok_or_else(|| "file_id is required".to_string())?;
        let format = self.format.ok_or_else(|| "format is required".to_string())?;

        let config = self.config.unwrap_or_default();
        let now = Utc::now();
        let locator = self.initial_locator
            .unwrap_or_else(|| config.default_locator(format).to_string());

        let mut session = DocumentSession {
            book_id,
            file_id,
            format,
            current_locator: locator,
            current_chapter_title: self.current_chapter_title,
            current_page_number: self.current_page_number.or(Some(config.default_page_number)),
            total_pages_or_spines: self.total_pages_or_spines,
            progress_percentage: self.progress_percentage.unwrap_or(config.default_progress_percentage),
            opened_at: now,
            last_interaction_at: now,
        };

        session.progress_percentage = session.progress_percentage.clamp(0.0, 1.0);
        Ok(session)
    }
}