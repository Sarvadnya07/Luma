//! # Luma Reader
//!
//! Core document parsing and reading engine for the Luma application.
//! This crate provides:
//!
//! - EPUB and PDF document parsing (`EpubDocument`, `PdfDocument`)
//! - Text extraction, search, and anchor resolution
//! - Table of Contents (TOC) extraction
//! - Format detection and metadata extraction
//! - Cover image management (`CoverStore`)
//! - Session management (`DocumentSession`)
//!
//! ## Modules
//!
//! - `cover` – Cover image storage and retrieval.
//! - `detector` – File format detection.
//! - `encoding` – Text decoding and entity handling.
//! - `epub_doc` – EPUB document parsing and navigation.
//! - `extractors` – Format‑specific extractors (EPUB, PDF, etc.).
//! - `pdf_doc` – PDF document parsing and rendering.
//! - `session` – Document session caching and state.
//!
//! ## Prelude
//!
//! For convenience, you can import the most common types via the prelude:
//!
//! ```
//! use luma_reader::prelude::*;
//! ```

pub mod cover;
pub mod detector;
pub mod encoding;
pub mod epub_doc;
pub mod extractors;
pub mod pdf_doc;
pub mod session;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::Path;

use luma_core::error::Result;
use luma_core::models::book::DocumentFormat;

// Re‑export core types for easy access.
pub use cover::CoverStore;
pub use detector::FormatDetector;
pub use epub_doc::{ChapterContent, DocumentSearchMatch, EpubDocument, SpineItem};
pub use extractors::*;
pub use pdf_doc::{PdfDocument, PdfPageData};
pub use session::DocumentSession;

// ============================================================================
// Shared Types
// ============================================================================

/// Table of Contents item.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TocItem {
    pub title: String,
    pub locator: String,
    pub play_order: Option<u32>,
    pub children: Vec<TocItem>,
}

/// Metadata extracted from a document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct DocumentMetadata {
    pub title: String,
    pub authors: Vec<String>,
    pub language: Option<String>,
    pub publisher: Option<String>,
    pub description: Option<String>,
    pub isbn: Option<String>,
    pub format: DocumentFormat,
    pub total_pages_or_spines: Option<u32>,
}

/// Capabilities of a document format.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FormatCapabilities {
    pub supports_reflow: bool,
    pub supports_fixed_layout: bool,
    pub supports_cfi: bool,
    pub supports_page_coordinates: bool,
    pub supports_embedded_fonts: bool,
    pub supports_text_extraction: bool,
}

impl FormatCapabilities {
    /// Returns the capabilities for a given document format.
    pub fn for_format(format: DocumentFormat) -> Self {
        match format {
            DocumentFormat::Epub => Self {
                supports_reflow: true,
                supports_fixed_layout: true,
                supports_cfi: true,
                supports_page_coordinates: false,
                supports_embedded_fonts: true,
                supports_text_extraction: true,
            },
            DocumentFormat::Pdf => Self {
                supports_reflow: false,
                supports_fixed_layout: true,
                supports_cfi: false,
                supports_page_coordinates: true,
                supports_embedded_fonts: true,
                supports_text_extraction: true,
            },
            DocumentFormat::Cbz | DocumentFormat::Cbr => Self {
                supports_reflow: false,
                supports_fixed_layout: true,
                supports_cfi: false,
                supports_page_coordinates: true,
                supports_embedded_fonts: false,
                supports_text_extraction: false,
            },
            DocumentFormat::Txt | DocumentFormat::Md | DocumentFormat::Html => Self {
                supports_reflow: true,
                supports_fixed_layout: false,
                supports_cfi: false,
                supports_page_coordinates: false,
                supports_embedded_fonts: false,
                supports_text_extraction: true,
            },
        }
    }
}

// ============================================================================
// Document Engine Trait
// ============================================================================

/// Abstract contract for reading engines.
#[async_trait]
pub trait DocumentEngine: Send + Sync {
    /// Inspect and extract metadata from document file.
    async fn parse_metadata(&self, file_path: &Path) -> Result<DocumentMetadata>;

    /// Extract hierarchical Table of Contents.
    async fn extract_toc(&self, file_path: &Path) -> Result<Vec<TocItem>>;

    /// Extract raw text from a given locator/spine/page for search or anchoring.
    async fn extract_text(&self, file_path: &Path, locator: &str) -> Result<String>;

    /// Return format capabilities.
    fn capabilities(&self) -> FormatCapabilities;
}

// ============================================================================
// Prelude
// ============================================================================

/// Convenience prelude module: imports the most frequently used types.
pub mod prelude {
    pub use super::{
        ChapterContent, CoverStore, DocumentEngine, DocumentMetadata, DocumentSearchMatch,
        EpubDocument, FormatCapabilities, FormatDetector, PdfDocument, PdfPageData,
        TocItem,
    };
    pub use super::epub_doc::SpineItem;
    pub use super::session::DocumentSession;
}