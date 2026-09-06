use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;
use luma_core::models::canonical::{
    CanonicalDocumentMetadata, DocumentCapabilities, DocumentFamily, DocumentPosition,
    DocumentRange, DocumentStructure, NodeKind, ResourceDescriptor, StructureNode,
};
use luma_security::sanitize_untrusted_html;

/// Page entry for an image sequence in a comic/manga archive.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CbzPageInfo {
    pub page_index: usize,
    pub filename: String,
    pub mime_type: String,
    pub byte_size: u64,
}

/// Document engine for Comic/Manga archives (.cbz).
pub struct CbzDocument {
    file_path: PathBuf,
    title: String,
    pages: Vec<CbzPageInfo>,
    metadata: CanonicalDocumentMetadata,
    structure: DocumentStructure,
}

impl CbzDocument {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let p = path.as_ref().to_path_buf();
        let file = File::open(&p)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open CBZ archive: {e}")))?;

        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| LumaError::CorruptedDocument(format!("Invalid CBZ zip archive: {e}")))?;

        let fallback_title = p
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Comic")
            .replace(['_', '-'], " ");

        let mut title = fallback_title;
        let mut authors = Vec::new();
        let mut series = None;
        let mut series_index = None;
        let mut description = None;

        // Parse ComicInfo.xml if present
        if let Ok(mut comic_info) = archive.by_name("ComicInfo.xml") {
            let mut xml = String::new();
            if comic_info.read_to_string(&mut xml).is_ok() {
                if let Some(t) = Self::extract_xml_tag(&xml, "Title") {
                    title = sanitize_untrusted_html(&t);
                }
                if let Some(s) = Self::extract_xml_tag(&xml, "Series") {
                    series = Some(sanitize_untrusted_html(&s));
                }
                if let Some(num) = Self::extract_xml_tag(&xml, "Number") {
                    series_index = num.parse::<f32>().ok();
                }
                if let Some(writer) = Self::extract_xml_tag(&xml, "Writer") {
                    authors.push(sanitize_untrusted_html(&writer));
                }
                if let Some(summary) = Self::extract_xml_tag(&xml, "Summary") {
                    description = Some(sanitize_untrusted_html(&summary));
                }
            }
        }

        // Collect all image entries in archive
        let mut raw_images = Vec::new();
        for i in 0..archive.len() {
            if let Ok(entry) = archive.by_index(i) {
                let name = entry.name().to_string();
                let lower = name.to_lowercase();
                if lower.ends_with(".jpg")
                    || lower.ends_with(".jpeg")
                    || lower.ends_with(".png")
                    || lower.ends_with(".webp")
                    || lower.ends_with(".gif")
                    || lower.ends_with(".avif")
                {
                    raw_images.push((name, entry.size()));
                }
            }
        }

        // Natural sort order so page 2 comes before page 10
        raw_images.sort_by(|a, b| natural_cmp(&a.0, &b.0));

        let mut pages = Vec::with_capacity(raw_images.len());
        let mut structure_nodes = Vec::with_capacity(raw_images.len());

        for (idx, (name, size)) in raw_images.iter().enumerate() {
            let lower = name.to_lowercase();
            let mime = if lower.ends_with(".png") {
                "image/png"
            } else if lower.ends_with(".webp") {
                "image/webp"
            } else if lower.ends_with(".gif") {
                "image/gif"
            } else if lower.ends_with(".avif") {
                "image/avif"
            } else {
                "image/jpeg"
            };

            let page_info = CbzPageInfo {
                page_index: idx,
                filename: name.clone(),
                mime_type: mime.to_string(),
                byte_size: *size,
            };
            pages.push(page_info);

            let node_id = format!("page-{}", idx + 1);
            let mut page_pos = DocumentPosition::new(0, 0);
            page_pos.page_number = Some((idx + 1) as u32);
            page_pos.locator = Some(format!("page={}", idx + 1));

            let page_node = StructureNode::new(
                &node_id,
                NodeKind::Image {
                    resource_id: name.clone(),
                    alt: Some(format!("Page {}", idx + 1)),
                    dimensions: None,
                },
            )
            .with_range(DocumentRange::new(page_pos.clone(), page_pos));

            structure_nodes.push(page_node);
        }

        let root_node = StructureNode::new("root", NodeKind::Document)
            .with_text(title.clone())
            .with_children(structure_nodes);

        let structure = DocumentStructure::new(root_node);

        let metadata = CanonicalDocumentMetadata {
            title: title.clone(),
            subtitle: None,
            authors,
            contributors: Vec::new(),
            language: None,
            publisher: None,
            publication_date: None,
            identifier: None,
            isbn: None,
            series,
            series_index,
            tags: Vec::new(),
            description,
            format: DocumentFormat::Cbz,
            mime_type: "application/vnd.comicbook+zip".to_string(),
            encoding: "binary".to_string(),
            source_fingerprint: String::new(),
            total_pages_or_spines: Some(pages.len() as u32),
        };

        Ok(Self {
            file_path: p,
            title,
            pages,
            metadata,
            structure,
        })
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn page_count(&self) -> usize {
        self.pages.len()
    }

    pub fn pages(&self) -> &[CbzPageInfo] {
        &self.pages
    }

    pub fn metadata(&self) -> &CanonicalDocumentMetadata {
        &self.metadata
    }

    pub fn capabilities(&self) -> DocumentCapabilities {
        DocumentCapabilities::for_family(DocumentFamily::ImageSequence)
    }

    pub fn structure(&self) -> &DocumentStructure {
        &self.structure
    }

    /// Extract raw image bytes for a specific page index.
    pub fn get_page_image(&self, page_index: usize) -> Result<(Vec<u8>, String)> {
        let page_info = self.pages.get(page_index).ok_or_else(|| {
            LumaError::NotFound {
                entity_type: "CbzPage".to_string(),
                id: page_index.to_string(),
            }
        })?;

        let file = File::open(&self.file_path)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open CBZ archive: {e}")))?;

        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| LumaError::CorruptedDocument(format!("Invalid CBZ zip archive: {e}")))?;

        let mut entry = archive
            .by_name(&page_info.filename)
            .map_err(|e| LumaError::DocumentError(format!("Page image not found: {e}")))?;

        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|e| LumaError::DocumentError(format!("Failed to read page image: {e}")))?;

        Ok((bytes, page_info.mime_type.clone()))
    }

    /// List all image resources available in this comic.
    pub fn resources(&self) -> Vec<ResourceDescriptor> {
        self.pages
            .iter()
            .map(|p| ResourceDescriptor {
                id: p.filename.clone(),
                href: p.filename.clone(),
                media_type: p.mime_type.clone(),
                byte_size: Some(p.byte_size),
                dimensions: None,
            })
            .collect()
    }

    fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
        let open = format!("<{tag}>");
        let close = format!("</{tag}>");
        let start = xml.find(&open)? + open.len();
        let end = xml[start..].find(&close)?;
        Some(xml[start..start + end].trim().to_string())
    }
}

fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let mut a_chars = a.chars().peekable();
    let mut b_chars = b.chars().peekable();

    while let (Some(&ca), Some(&cb)) = (a_chars.peek(), b_chars.peek()) {
        if ca.is_ascii_digit() && cb.is_ascii_digit() {
            let mut num_a: u64 = 0;
            while let Some(&d) = a_chars.peek() {
                if let Some(digit) = d.to_digit(10) {
                    num_a = num_a.saturating_mul(10).saturating_add(digit as u64);
                    a_chars.next();
                } else {
                    break;
                }
            }
            let mut num_b: u64 = 0;
            while let Some(&d) = b_chars.peek() {
                if let Some(digit) = d.to_digit(10) {
                    num_b = num_b.saturating_mul(10).saturating_add(digit as u64);
                    b_chars.next();
                } else {
                    break;
                }
            }
            match num_a.cmp(&num_b) {
                std::cmp::Ordering::Equal => continue,
                other => return other,
            }
        } else {
            match ca.to_ascii_lowercase().cmp(&cb.to_ascii_lowercase()) {
                std::cmp::Ordering::Equal => {
                    a_chars.next();
                    b_chars.next();
                }
                other => return other,
            }
        }
    }
    a.len().cmp(&b.len())
}

