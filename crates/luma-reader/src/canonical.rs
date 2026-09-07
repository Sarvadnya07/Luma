use std::path::Path;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;
use luma_core::models::canonical::{
    CanonicalDocumentMetadata, CanonicalSearchMatch, CitationContext, DocumentCapabilities,
    DocumentFamily, DocumentPosition, DocumentRange, DocumentStructure, ResourceDescriptor,
    StructureNode,
};

use crate::cbz_doc::CbzDocument;
use crate::epub_doc::EpubDocument;
use crate::html_doc::HtmlDocument;
use crate::markdown_doc::MarkdownDocument;
use crate::pdf_doc::PdfDocument;
use crate::text_doc::TextDocument;

/// Unified, format-neutral representation of any document supported by Luma.
#[allow(clippy::large_enum_variant)]
pub enum CanonicalDocument {
    Epub(EpubDocument),
    Pdf(PdfDocument),
    Cbz(CbzDocument),
    Text(TextDocument),
    Markdown(MarkdownDocument),
    Html(HtmlDocument),
}

impl CanonicalDocument {
    /// Open a document file with its known format.
    pub fn open<P: AsRef<Path>>(path: P, format: DocumentFormat) -> Result<Self> {
        let p = path.as_ref();
        match format {
            DocumentFormat::Epub => EpubDocument::open(p).map(Self::Epub),
            DocumentFormat::Pdf => PdfDocument::open(p).map(Self::Pdf),
            DocumentFormat::Cbz | DocumentFormat::Cbr => CbzDocument::open(p).map(Self::Cbz),
            DocumentFormat::Txt => TextDocument::open(p).map(Self::Text),
            DocumentFormat::Md => MarkdownDocument::open(p).map(Self::Markdown),
            DocumentFormat::Html => HtmlDocument::open(p).map(Self::Html),
        }
    }

    /// Return the format of the document.
    pub fn format(&self) -> DocumentFormat {
        match self {
            Self::Epub(_) => DocumentFormat::Epub,
            Self::Pdf(_) => DocumentFormat::Pdf,
            Self::Cbz(_) => DocumentFormat::Cbz,
            Self::Text(_) => DocumentFormat::Txt,
            Self::Markdown(_) => DocumentFormat::Md,
            Self::Html(_) => DocumentFormat::Html,
        }
    }

    /// Return the architectural family of the document.
    pub fn family(&self) -> DocumentFamily {
        match self {
            Self::Epub(_) | Self::Text(_) | Self::Markdown(_) | Self::Html(_) => {
                DocumentFamily::Reflowable
            }
            Self::Pdf(_) => DocumentFamily::FixedLayout,
            Self::Cbz(_) => DocumentFamily::ImageSequence,
        }
    }

    /// Return the declared operations supported by this document.
    pub fn capabilities(&self) -> DocumentCapabilities {
        DocumentCapabilities::for_family(self.family())
    }

    /// Return the document title if available.
    pub fn title(&self) -> &str {
        match self {
            Self::Epub(d) => d
                .toc()
                .first()
                .map(|t| t.title.as_str())
                .unwrap_or("Untitled EPUB"),
            Self::Pdf(_) => "PDF Document",
            Self::Cbz(d) => d.title(),
            Self::Text(d) => d.title(),
            Self::Markdown(d) => d.title(),
            Self::Html(d) => d.title(),
        }
    }

    /// Extract the hierarchical structure outline of the document.
    pub fn structure(&self) -> Result<DocumentStructure> {
        match self {
            Self::Epub(d) => d.structure(),
            Self::Pdf(d) => d.structure(),
            Self::Cbz(d) => Ok(d.structure().clone()),
            Self::Text(d) => Ok(d.structure().clone()),
            Self::Markdown(d) => Ok(d.structure().clone()),
            Self::Html(d) => Ok(d.structure().clone()),
        }
    }

    /// Retrieve the text of a specific paragraph within a section or page.
    pub fn get_paragraph(&self, section_or_page: usize, paragraph_index: usize) -> Result<String> {
        match self {
            Self::Epub(d) => d.get_paragraph(section_or_page, paragraph_index),
            Self::Pdf(d) => d.get_paragraph((section_or_page + 1) as u32, paragraph_index),
            Self::Cbz(_) => Err(LumaError::UnsupportedFormat(
                "ImageSequence format does not support paragraph text extraction".into(),
            )),
            Self::Text(d) => d
                .get_paragraph(paragraph_index)
                .map(|s| s.to_string())
                .ok_or_else(|| LumaError::NotFound {
                    entity_type: "Paragraph".to_string(),
                    id: paragraph_index.to_string(),
                }),
            Self::Markdown(d) => d
                .get_paragraph(paragraph_index)
                .map(|s| s.to_string())
                .ok_or_else(|| LumaError::NotFound {
                    entity_type: "Paragraph".to_string(),
                    id: paragraph_index.to_string(),
                }),
            Self::Html(d) => d
                .get_paragraph(paragraph_index)
                .map(|s| s.to_string())
                .ok_or_else(|| LumaError::NotFound {
                    entity_type: "Paragraph".to_string(),
                    id: paragraph_index.to_string(),
                }),
        }
    }

    /// Retrieve all semantic headings in the document.
    pub fn get_headings(&self) -> Result<Vec<StructureNode>> {
        let structure = self.structure()?;
        Ok(structure.get_headings())
    }

    /// Retrieve all embedded resource descriptors (images, fonts, stylesheets).
    pub fn get_resources(&self) -> Vec<ResourceDescriptor> {
        match self {
            Self::Epub(d) => d.get_resources(),
            Self::Cbz(d) => d.resources(),
            _ => Vec::new(),
        }
    }

    /// Read raw byte payload of an embedded resource by ID or href.
    pub fn read_resource(&self, href_or_id: &str) -> Result<(Vec<u8>, String)> {
        match self {
            Self::Epub(d) => {
                let data = d.read_resource(href_or_id)?;
                let mime = if href_or_id.ends_with(".png") {
                    "image/png"
                } else if href_or_id.ends_with(".jpg") || href_or_id.ends_with(".jpeg") {
                    "image/jpeg"
                } else if href_or_id.ends_with(".webp") {
                    "image/webp"
                } else if href_or_id.ends_with(".svg") {
                    "image/svg+xml"
                } else if href_or_id.ends_with(".css") {
                    "text/css"
                } else {
                    "application/octet-stream"
                };
                Ok((data, mime.to_string()))
            }
            Self::Cbz(d) => {
                if let Ok(idx) = href_or_id.parse::<usize>() {
                    d.get_page_image(idx)
                } else if let Some(pos) = d.pages().iter().position(|p| p.filename == href_or_id) {
                    d.get_page_image(pos)
                } else {
                    Err(LumaError::NotFound {
                        entity_type: "Resource".to_string(),
                        id: href_or_id.to_string(),
                    })
                }
            }
            _ => Err(LumaError::NotFound {
                entity_type: "Resource".to_string(),
                id: href_or_id.to_string(),
            }),
        }
    }

    /// Retrieve the exact source text spanning a contiguous document range.
    pub fn get_range_text(&self, range: &DocumentRange) -> Result<String> {
        match self {
            Self::Epub(d) => d.get_range_text(range),
            Self::Pdf(d) => d.get_range_text(range),
            Self::Text(d) => d.get_range_text(range),
            Self::Markdown(d) => d.get_range_text(range),
            Self::Html(d) => d.get_range_text(range),
            Self::Cbz(_) => Err(LumaError::UnsupportedFormat(
                "ImageSequence format does not support text range extraction".into(),
            )),
        }
    }

    /// Execute a search query directly against the canonical model.
    pub fn search_canonical(&self, query: &str) -> Result<Vec<CanonicalSearchMatch>> {
        let clean_q = query.trim();
        if clean_q.is_empty() {
            return Ok(Vec::new());
        }

        let raw_matches = match self {
            Self::Epub(d) => d.search(clean_q)?,
            Self::Pdf(d) => d.search(clean_q)?,
            Self::Text(d) => d.search(clean_q)?,
            Self::Markdown(d) => d.search(clean_q)?,
            Self::Html(d) => d.search(clean_q)?,
            Self::Cbz(_) => Vec::new(),
        };

        let canonical_matches = raw_matches
            .into_iter()
            .map(|m| {
                let start_pos = DocumentPosition::new(m.spine_index, m.match_char_offset)
                    .with_locator(&m.locator);
                let end_pos = DocumentPosition::new(
                    m.spine_index,
                    m.match_char_offset + clean_q.chars().count(),
                )
                .with_locator(&m.locator);

                CanonicalSearchMatch {
                    range: DocumentRange::new(start_pos, end_pos).with_snippet(&m.snippet),
                    section_index: m.spine_index,
                    section_title: m.chapter_title,
                    snippet: m.snippet,
                    match_char_offset: m.match_char_offset,
                    confidence_score: 1.0,
                }
            })
            .collect();

        Ok(canonical_matches)
    }

    /// Generate a structured citation context for a given document range.
    pub fn get_citation_context(
        &self,
        range: &DocumentRange,
        metadata: Option<&CanonicalDocumentMetadata>,
    ) -> Result<CitationContext> {
        let quote = self.get_range_text(range)?;
        let doc_title = metadata
            .map(|m| m.title.clone())
            .unwrap_or_else(|| self.title().to_string());
        let authors = metadata.map(|m| m.authors.clone()).unwrap_or_default();
        let publisher = metadata.and_then(|m| m.publisher.clone());
        let publication_date = metadata.and_then(|m| m.publication_date.clone());

        let section_title = match self {
            Self::Epub(d) => d
                .get_chapter(range.start.section_index)
                .ok()
                .map(|c| c.title),
            Self::Pdf(_) => range
                .start
                .page_number
                .map(|p| format!("Page {p}"))
                .or_else(|| Some(format!("Page {}", range.start.section_index + 1))),
            Self::Text(d) => Some(d.title().to_string()),
            Self::Markdown(d) => Some(d.title().to_string()),
            Self::Html(d) => Some(d.title().to_string()),
            Self::Cbz(d) => Some(d.title().to_string()),
        };

        let page_number = range.start.page_number;
        let locator = range.start.locator.clone().unwrap_or_else(|| {
            format!(
                "section:{},offset:{}",
                range.start.section_index, range.start.char_offset
            )
        });

        // Format scholarly citation string
        let authors_str = if authors.is_empty() {
            "Unknown Author".to_string()
        } else {
            authors.join(", ")
        };

        let date_str = publication_date.as_deref().unwrap_or("n.d.");

        let loc_str = if let Some(pg) = page_number {
            format!("p. {pg}")
        } else if let Some(ref sec) = section_title {
            format!("\"{}\"", sec)
        } else {
            locator.clone()
        };

        let formatted_citation =
            format!("{authors_str} ({date_str}). {doc_title}, {loc_str}. \"{quote}\"");

        Ok(CitationContext {
            document_title: doc_title,
            authors,
            publisher,
            publication_date,
            section_title,
            page_number,
            locator,
            quote,
            formatted_citation,
        })
    }
}
