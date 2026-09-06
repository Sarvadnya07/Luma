use serde::{Deserialize, Serialize};

use crate::ids::{BookId, FileId};
use crate::models::book::DocumentFormat;

// ============================================================================
// Document Family
// ============================================================================

/// The fundamental layout and presentation family of a document format.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentFamily {
    /// Text reflows dynamically to fit viewport (EPUB, TXT, Markdown, HTML).
    Reflowable,
    /// Fixed page dimensions and absolute coordinate typography (PDF).
    FixedLayout,
    /// Sequential visual page frames without structured typography (CBZ, CBR).
    ImageSequence,
}

impl DocumentFamily {
    pub fn for_format(format: DocumentFormat) -> Self {
        match format {
            DocumentFormat::Epub
            | DocumentFormat::Txt
            | DocumentFormat::Md
            | DocumentFormat::Html => Self::Reflowable,
            DocumentFormat::Pdf => Self::FixedLayout,
            DocumentFormat::Cbz | DocumentFormat::Cbr => Self::ImageSequence,
        }
    }
}

// ============================================================================
// Document Identity
// ============================================================================

/// Stable cryptographic and path identity of an imported source document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentIdentity {
    pub id: BookId,
    pub file_id: Option<FileId>,
    pub source_path: String,
    pub format: DocumentFormat,
    pub family: DocumentFamily,
    pub mime_type: String,
    pub source_fingerprint: String,
    pub byte_size: u64,
}

// ============================================================================
// Canonical Document Metadata
// ============================================================================

/// Exhaustive structured metadata extracted from the source document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct CanonicalDocumentMetadata {
    pub title: String,
    pub subtitle: Option<String>,
    pub authors: Vec<String>,
    pub contributors: Vec<String>,
    pub language: Option<String>,
    pub publisher: Option<String>,
    pub publication_date: Option<String>,
    pub identifier: Option<String>,
    pub isbn: Option<String>,
    pub series: Option<String>,
    pub series_index: Option<f32>,
    pub tags: Vec<String>,
    pub description: Option<String>,
    pub format: DocumentFormat,
    pub mime_type: String,
    pub encoding: String,
    pub source_fingerprint: String,
    pub total_pages_or_spines: Option<u32>,
}

// ============================================================================
// Document Capabilities
// ============================================================================

/// Declared operations supported by the document's canonical model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentCapabilities {
    pub searchable: bool,
    pub selectable: bool,
    pub annotatable: bool,
    pub reflowable: bool,
    pub fixed_layout: bool,
    pub image_sequence: bool,
    pub extractable_text: bool,
    pub has_geometry: bool,
    pub has_resources: bool,
    pub has_toc: bool,
}

impl DocumentCapabilities {
    pub fn for_family(family: DocumentFamily) -> Self {
        match family {
            DocumentFamily::Reflowable => Self {
                searchable: true,
                selectable: true,
                annotatable: true,
                reflowable: true,
                fixed_layout: false,
                image_sequence: false,
                extractable_text: true,
                has_geometry: false,
                has_resources: true,
                has_toc: true,
            },
            DocumentFamily::FixedLayout => Self {
                searchable: true,
                selectable: true,
                annotatable: true,
                reflowable: false,
                fixed_layout: true,
                image_sequence: false,
                extractable_text: true,
                has_geometry: true,
                has_resources: true,
                has_toc: true,
            },
            DocumentFamily::ImageSequence => Self {
                searchable: false,
                selectable: false,
                annotatable: true,
                reflowable: false,
                fixed_layout: true,
                image_sequence: true,
                extractable_text: false,
                has_geometry: true,
                has_resources: true,
                has_toc: false,
            },
        }
    }
}

// ============================================================================
// Geometry & Positions
// ============================================================================

/// Normalized or point-based rectangular bounding box for fixed-layout pages.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl BoundingBox {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }
}

/// Format-neutral position identifying a single location in a document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentPosition {
    /// Spine or section index (0-indexed).
    pub section_index: usize,
    /// Identifier of the structured semantic node (if available).
    pub node_id: Option<String>,
    /// UTF-8 Unicode character offset within section or node.
    pub char_offset: usize,
    /// Absolute page number if applicable (1-indexed for PDF/Comics).
    pub page_number: Option<u32>,
    /// Bounding box geometry if applicable (e.g. PDF text span or image region).
    pub geometry: Option<BoundingBox>,
    /// Format-specific native locator string (e.g. EPUB CFI, XPath, or offset).
    pub locator: Option<String>,
}

impl DocumentPosition {
    pub fn new(section_index: usize, char_offset: usize) -> Self {
        Self {
            section_index,
            node_id: None,
            char_offset,
            page_number: None,
            geometry: None,
            locator: None,
        }
    }

    pub fn with_node(mut self, node_id: impl Into<String>) -> Self {
        self.node_id = Some(node_id.into());
        self
    }

    pub fn with_page(mut self, page: u32) -> Self {
        self.page_number = Some(page);
        self
    }

    pub fn with_geometry(mut self, bbox: BoundingBox) -> Self {
        self.geometry = Some(bbox);
        self
    }

    pub fn with_locator(mut self, loc: impl Into<String>) -> Self {
        self.locator = Some(loc.into());
        self
    }
}

/// Format-neutral contiguous range across a document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentRange {
    pub start: DocumentPosition,
    pub end: DocumentPosition,
    /// Plaintext slice spanning this range.
    pub text_snippet: Option<String>,
}

impl DocumentRange {
    pub fn new(start: DocumentPosition, end: DocumentPosition) -> Self {
        Self {
            start,
            end,
            text_snippet: None,
        }
    }

    pub fn with_snippet(mut self, text: impl Into<String>) -> Self {
        self.text_snippet = Some(text.into());
        self
    }
}

// ============================================================================
// Semantic Document Structure
// ============================================================================

/// Semantic role of a node within the document hierarchy.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum NodeKind {
    Document,
    Section {
        index: usize,
        title: Option<String>,
    },
    Heading {
        level: u8,
    },
    Paragraph {
        index: usize,
    },
    List {
        ordered: bool,
    },
    ListItem,
    Blockquote,
    Table,
    TableRow,
    TableCell,
    CodeBlock {
        language: Option<String>,
    },
    Image {
        resource_id: String,
        alt: Option<String>,
        dimensions: Option<(u32, u32)>,
    },
    Footnote {
        id: String,
    },
    Link {
        href: String,
    },
    PageBreak {
        page_number: u32,
    },
}

/// A node within the canonical document tree.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StructureNode {
    pub id: String,
    pub kind: NodeKind,
    pub text: Option<String>,
    pub children: Vec<StructureNode>,
    pub range: Option<DocumentRange>,
}

impl StructureNode {
    pub fn new(id: impl Into<String>, kind: NodeKind) -> Self {
        Self {
            id: id.into(),
            kind,
            text: None,
            children: Vec::new(),
            range: None,
        }
    }

    pub fn with_text(mut self, text: impl Into<String>) -> Self {
        self.text = Some(text.into());
        self
    }

    pub fn with_children(mut self, children: Vec<StructureNode>) -> Self {
        self.children = children;
        self
    }

    pub fn with_range(mut self, range: DocumentRange) -> Self {
        self.range = Some(range);
        self
    }

    /// Recursively find all headings in this subtree.
    pub fn collect_headings(&self) -> Vec<StructureNode> {
        let mut headings = Vec::new();
        if matches!(self.kind, NodeKind::Heading { .. }) {
            headings.push(self.clone());
        }
        for child in &self.children {
            headings.extend(child.collect_headings());
        }
        headings
    }

    /// Recursively find all images in this subtree.
    pub fn collect_images(&self) -> Vec<StructureNode> {
        let mut images = Vec::new();
        if matches!(self.kind, NodeKind::Image { .. }) {
            images.push(self.clone());
        }
        for child in &self.children {
            images.extend(child.collect_images());
        }
        images
    }

    /// Find node by its unique ID.
    pub fn find_node(&self, target_id: &str) -> Option<&StructureNode> {
        if self.id == target_id {
            return Some(self);
        }
        for child in &self.children {
            if let Some(found) = child.find_node(target_id) {
                return Some(found);
            }
        }
        None
    }
}

/// The complete structured outline and semantic hierarchy of a document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentStructure {
    pub root: StructureNode,
    pub total_sections: usize,
    pub total_paragraphs: usize,
    pub total_words: usize,
}

impl DocumentStructure {
    pub fn new(root: StructureNode) -> Self {
        let mut total_sections = 0;
        let mut total_paragraphs = 0;
        let mut total_words = 0;

        fn count_stats(
            node: &StructureNode,
            sections: &mut usize,
            paras: &mut usize,
            words: &mut usize,
        ) {
            match node.kind {
                NodeKind::Section { .. } => *sections += 1,
                NodeKind::Paragraph { .. } => *paras += 1,
                _ => {}
            }
            if let Some(ref txt) = node.text {
                *words += txt.split_whitespace().count();
            }
            for child in &node.children {
                count_stats(child, sections, paras, words);
            }
        }

        count_stats(
            &root,
            &mut total_sections,
            &mut total_paragraphs,
            &mut total_words,
        );

        Self {
            root,
            total_sections,
            total_paragraphs,
            total_words,
        }
    }

    pub fn get_headings(&self) -> Vec<StructureNode> {
        self.root.collect_headings()
    }

    pub fn get_images(&self) -> Vec<StructureNode> {
        self.root.collect_images()
    }

    pub fn find_node(&self, id: &str) -> Option<&StructureNode> {
        self.root.find_node(id)
    }
}

// ============================================================================
// Resources
// ============================================================================

/// Metadata descriptor for an embedded resource (image, font, stylesheet, audio).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceDescriptor {
    pub id: String,
    pub href: String,
    pub media_type: String,
    pub byte_size: Option<u64>,
    pub dimensions: Option<(u32, u32)>,
}

// ============================================================================
// Citations & Search
// ============================================================================

/// Structured context for scholarly and research citations generated from source.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CitationContext {
    pub document_title: String,
    pub authors: Vec<String>,
    pub publisher: Option<String>,
    pub publication_date: Option<String>,
    pub section_title: Option<String>,
    pub page_number: Option<u32>,
    pub locator: String,
    pub quote: String,
    pub formatted_citation: String,
}

/// Search match returned from queries directly against the canonical model.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanonicalSearchMatch {
    pub range: DocumentRange,
    pub section_index: usize,
    pub section_title: String,
    pub snippet: String,
    pub match_char_offset: usize,
    pub confidence_score: f32,
}
