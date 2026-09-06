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
pub mod html_doc;
pub mod markdown_doc;
pub mod pdf_doc;
pub mod session;
pub mod text_doc;

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
pub use html_doc::HtmlDocument;
pub use markdown_doc::MarkdownDocument;
pub use pdf_doc::{PdfDocument, PdfPageData};
pub use session::DocumentSession;
pub use text_doc::TextDocument;

/// Polymorphic container for reflowable document engines.
pub enum ReflowableDocument {
    Epub(EpubDocument),
    Text(TextDocument),
    Markdown(MarkdownDocument),
    Html(HtmlDocument),
}

impl ReflowableDocument {
    pub fn spine_count(&self) -> usize {
        match self {
            Self::Epub(d) => d.spine_count(),
            Self::Text(d) => d.spine_count(),
            Self::Markdown(d) => d.spine_count(),
            Self::Html(d) => d.spine_count(),
        }
    }

    pub fn toc(&self) -> &[TocItem] {
        match self {
            Self::Epub(d) => d.toc(),
            Self::Text(d) => d.toc(),
            Self::Markdown(d) => d.toc(),
            Self::Html(d) => d.toc(),
        }
    }

    pub fn get_chapter(&self, spine_index: usize) -> Result<ChapterContent> {
        match self {
            Self::Epub(d) => d.get_chapter(spine_index),
            Self::Text(d) => d.get_chapter(spine_index),
            Self::Markdown(d) => d.get_chapter(spine_index),
            Self::Html(d) => d.get_chapter(spine_index),
        }
    }

    pub fn search(&self, query: &str) -> Result<Vec<DocumentSearchMatch>> {
        match self {
            Self::Epub(d) => d.search(query),
            Self::Text(d) => d.search(query),
            Self::Markdown(d) => d.search(query),
            Self::Html(d) => d.search(query),
        }
    }

    pub fn title(&self) -> Option<&str> {
        match self {
            Self::Epub(d) => d.toc().first().map(|t| t.title.as_str()),
            Self::Text(d) => Some(d.title()),
            Self::Markdown(d) => Some(d.title()),
            Self::Html(d) => Some(d.title()),
        }
    }
}

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
    pub use super::epub_doc::SpineItem;
    pub use super::session::DocumentSession;
    pub use super::{
        ChapterContent, CoverStore, DocumentEngine, DocumentMetadata, DocumentSearchMatch,
        EpubDocument, FormatCapabilities, FormatDetector, PdfDocument, PdfPageData, TocItem,
    };
}
