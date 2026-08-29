use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::Path;

use luma_core::error::Result;
use luma_core::models::book::DocumentFormat;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TocItem {
    pub title: String,
    pub locator: String,
    pub play_order: Option<u32>,
    pub children: Vec<TocItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
        }
    }
}

/// Abstract contract for reading engines
#[async_trait]
pub trait DocumentEngine: Send + Sync {
    /// Inspect and extract metadata from document file
    async fn parse_metadata(&self, file_path: &Path) -> Result<DocumentMetadata>;

    /// Extract hierarchical Table of Contents
    async fn extract_toc(&self, file_path: &Path) -> Result<Vec<TocItem>>;

    /// Extract raw text from a given locator/spine/page for search or anchoring
    async fn extract_text(&self, file_path: &Path, locator: &str) -> Result<String>;

    /// Return format capabilities
    fn capabilities(&self) -> FormatCapabilities;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_capabilities() {
        let epub_caps = FormatCapabilities::for_format(DocumentFormat::Epub);
        assert!(epub_caps.supports_reflow);
        assert!(epub_caps.supports_cfi);
        assert!(!epub_caps.supports_page_coordinates);

        let pdf_caps = FormatCapabilities::for_format(DocumentFormat::Pdf);
        assert!(!pdf_caps.supports_reflow);
        assert!(pdf_caps.supports_page_coordinates);
    }
}
