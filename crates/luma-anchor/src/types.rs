use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextQuoteAnchor {
    /// Exact quote text from original document selection
    pub exact: String,
    /// Preceding text context (typically 30-100 characters)
    pub prefix: Option<String>,
    /// Following text context (typically 30-100 characters)
    pub suffix: Option<String>,
    /// Normalized representation of the exact quote
    pub normalized_exact: String,
}

impl TextQuoteAnchor {
    pub fn new(exact: impl Into<String>, prefix: Option<String>, suffix: Option<String>) -> Self {
        let exact_str = exact.into();
        let normalized = crate::normalize::normalize_text(&exact_str);
        Self {
            exact: exact_str,
            prefix: prefix.map(|p| crate::normalize::normalize_text(&p)),
            suffix: suffix.map(|s| crate::normalize::normalize_text(&s)),
            normalized_exact: normalized,
        }
    }
}

/// EPUB Canonical Fragment Identifier
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EpubCfiLocator {
    pub cfi: String,
    pub spine_index: usize,
}

/// PDF Bounding box coordinates normalized (0.0 to 1.0)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PdfRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// PDF Page Geometry Locator
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PdfLocator {
    pub page_number: u32,
    pub rects: Vec<PdfRect>,
}

/// Format specific locator payload
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "format", content = "data", rename_all = "lowercase")]
pub enum FormatLocator {
    Epub(EpubCfiLocator),
    Pdf(PdfLocator),
    GenericTextOffset { start_char: usize, end_char: usize },
}

/// Composite multi-signal anchor bundle
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompositeAnchor {
    /// Primary format-specific locator (CFI or PDF page/rects)
    pub format_locator: Option<FormatLocator>,
    /// Text quote anchor with context prefix/suffix
    pub quote_anchor: TextQuoteAnchor,
    /// SHA-256 hash of the chapter or page text when the anchor was created
    pub chapter_content_hash: Option<String>,
    /// Document identifier or checksum
    pub document_checksum: Option<String>,
}

/// Candidate match found during anchor resolution
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MatchCandidate {
    pub start_char: usize,
    pub end_char: usize,
    pub matched_text: String,
    /// Confidence score between 0.0 and 1.0
    pub confidence_score: f32,
    /// Match signals breakdown
    pub exact_text_matched: bool,
    pub prefix_matched: bool,
    pub suffix_matched: bool,
    pub fuzzy_similarity: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", content = "data", rename_all = "lowercase")]
pub enum ResolutionResult {
    /// Anchor was resolved with high confidence (> 0.85)
    HighConfidence(MatchCandidate),
    /// Multiple competing locations detected with similar scores; requires user or conservative handling
    Ambiguous {
        candidates: Vec<MatchCandidate>,
        highest_score: f32,
    },
    /// Anchor could not be found with sufficient confidence
    Failed {
        best_candidate: Option<MatchCandidate>,
        reason: String,
    },
}
