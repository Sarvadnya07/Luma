use quick_xml::events::Event;
use quick_xml::Reader;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_core::models::canonical::{
    DocumentPosition, DocumentRange, DocumentStructure, NodeKind, ResourceDescriptor, StructureNode,
};
use luma_security::sanitize_untrusted_html;

use crate::encoding::{decode_text_bytes, decode_xml_and_html_entities, is_binary_resource};
use crate::TocItem;

// ============================================================================
// Constants – paths, element names, attributes, and error messages
// ============================================================================

/// Path to the EPUB container XML file.
const CONTAINER_PATH: &str = "META-INF/container.xml";
const ROOTFILE_ELEM: &str = "rootfile";
const FULL_PATH_ATTR: &str = "full-path";

/// OPF element names and attributes.
const OPF_ITEM_ELEM: &str = "item";
const OPF_SPINE_ELEM: &str = "spine";
const OPF_ITEMREF_ELEM: &str = "itemref";
const OPF_ID_ATTR: &str = "id";
const OPF_HREF_ATTR: &str = "href";
const OPF_MEDIA_TYPE_ATTR: &str = "media-type";
const OPF_PROPERTIES_ATTR: &str = "properties";
const OPF_TOC_ATTR: &str = "toc";
const OPF_IDREF_ATTR: &str = "idref";
const OPF_LINEAR_ATTR: &str = "linear";

/// Media types.
const NCX_MEDIA_TYPE: &str = "application/x-dtbncx+xml";
const PROPERTY_NAV: &str = "nav";

/// Default HTML header regex for title extraction.
const HEADER_REGEX: &str = r"(?i)<(h1|h2|title)[^>]*>([^<]+)</(h1|h2|title)>";
const TAG_REGEX: &str = r"<[^>]+>";

/// Maximum search results per chapter.
const MAX_SEARCH_RESULTS: usize = 100;

const ERR_CONTAINER_MISSING: &str = "META-INF/container.xml missing";
const ERR_NO_ROOTFILE: &str = "No rootfile in container.xml";

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpineItem {
    pub id: String,
    pub href: String,
    pub media_type: String,
    pub linear: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChapterContent {
    pub spine_index: usize,
    pub id: String,
    pub title: String,
    pub href: String,
    pub html_content: String,
    pub text_content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentSearchMatch {
    pub spine_index: usize,
    pub chapter_title: String,
    pub locator: String,
    pub snippet: String,
    pub match_char_offset: usize,
}

// ============================================================================
// EpubDocument
// ============================================================================

pub struct EpubDocument {
    file_path: PathBuf,
    #[allow(dead_code)]
    opf_path: String,
    opf_dir: PathBuf,
    #[allow(dead_code)]
    manifest: HashMap<String, (String, String)>, // id -> (href, media-type)
    spine: Vec<SpineItem>,
    toc: Vec<TocItem>,
    chapter_cache: std::sync::RwLock<HashMap<usize, ChapterContent>>,
}

impl EpubDocument {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let p = path.as_ref().to_path_buf();
        let file = File::open(&p)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open EPUB: {e}")))?;

        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            LumaError::CorruptedDocument(format!("Invalid EPUB zip container: {e}"))
        })?;

        // 1. Find rootfile from container.xml
        let opf_path = Self::find_opf_path(&mut archive)?;
        let opf_dir = Path::new(&opf_path)
            .parent()
            .unwrap_or(Path::new(""))
            .to_path_buf();

        // 2. Read and parse OPF package
        let mut opf_entry = archive
            .by_name(&opf_path)
            .map_err(|e| LumaError::CorruptedDocument(format!("OPF missing: {e}")))?;
        let mut opf_bytes = Vec::new();
        opf_entry
            .read_to_end(&mut opf_bytes)
            .map_err(|e| LumaError::CorruptedDocument(format!("Corrupted zip entry: {e}")))?;
        drop(opf_entry);

        let opf_xml = decode_text_bytes(&opf_bytes);
        let (manifest, spine, nav_href, ncx_href) = Self::parse_opf_manifest_and_spine(&opf_xml)?;

        // 3. Parse TOC from Navigation Document (EPUB 3) or NCX (EPUB 2)
        let toc = Self::parse_toc(
            &mut archive,
            &opf_dir,
            nav_href.as_deref(),
            ncx_href.as_deref(),
            &spine,
        );

        Ok(Self {
            file_path: p,
            opf_path,
            opf_dir,
            manifest,
            spine,
            toc,
            chapter_cache: std::sync::RwLock::new(HashMap::new()),
        })
    }

    pub fn spine_count(&self) -> usize {
        self.spine.len()
    }

    pub fn toc(&self) -> &[TocItem] {
        &self.toc
    }

    pub fn spine_items(&self) -> &[SpineItem] {
        &self.spine
    }

    pub fn get_chapter(&self, spine_index: usize) -> Result<ChapterContent> {
        if spine_index >= self.spine.len() {
            return Err(LumaError::DocumentError(format!(
                "Spine index {spine_index} out of bounds (total {})",
                self.spine.len()
            )));
        }

        // Fast path: check in-memory chapter cache
        if let Ok(cache) = self.chapter_cache.read() {
            if let Some(cached) = cache.get(&spine_index) {
                return Ok(cached.clone());
            }
        }

        let item = &self.spine[spine_index];

        // Guard against binary resources accidentally placed in spine
        if is_binary_resource(&item.media_type, &item.href) {
            return Err(LumaError::DocumentError(format!(
                "Spine item {} is a binary resource ({}) and cannot be rendered as chapter text",
                item.href, item.media_type
            )));
        }

        let file = File::open(&self.file_path)
            .map_err(|e| LumaError::DocumentError(format!("Failed to reopen EPUB file: {e}")))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| LumaError::CorruptedDocument(e.to_string()))?;

        let chapter_path = if self.opf_dir.as_os_str().is_empty() {
            item.href.replace('\\', "/")
        } else {
            self.opf_dir
                .join(&item.href)
                .to_string_lossy()
                .replace('\\', "/")
        };

        let mut entry = if archive.by_name(&chapter_path).is_ok() {
            archive.by_name(&chapter_path).unwrap()
        } else {
            archive.by_name(&item.href).map_err(|e| {
                LumaError::DocumentError(format!("Chapter file {chapter_path} not found: {e}"))
            })?
        };

        let mut chapter_bytes = Vec::new();
        entry.read_to_end(&mut chapter_bytes).map_err(|e| {
            LumaError::DocumentError(format!("Failed to read chapter {}: {e}", item.href))
        })?;

        let raw_html = decode_text_bytes(&chapter_bytes);
        let sanitized_html = sanitize_untrusted_html(&raw_html);
        let text_content = Self::extract_plain_text(&sanitized_html);
        let title = Self::extract_chapter_title(&sanitized_html)
            .unwrap_or_else(|| format!("Chapter {}", spine_index + 1));

        let content = ChapterContent {
            spine_index,
            id: item.id.clone(),
            title,
            href: item.href.clone(),
            html_content: sanitized_html,
            text_content,
        };

        // Cache parsed chapter in memory
        if let Ok(mut cache) = self.chapter_cache.write() {
            cache.insert(spine_index, content.clone());
        }

        Ok(content)
    }

    pub fn search(&self, query: &str) -> Result<Vec<DocumentSearchMatch>> {
        let clean_q = query.trim().to_lowercase();
        if clean_q.is_empty() {
            return Ok(Vec::new());
        }

        let mut matches = Vec::new();

        for (idx, _) in self.spine.iter().enumerate() {
            if let Ok(chapter) = self.get_chapter(idx) {
                let text_lower = chapter.text_content.to_lowercase();
                let mut start_search = 0;

                while let Some(found_idx) = text_lower[start_search..].find(&clean_q) {
                    let absolute_char_idx = start_search + found_idx;
                    let snippet_start = absolute_char_idx.saturating_sub(40);
                    let snippet_end =
                        (absolute_char_idx + clean_q.len() + 40).min(chapter.text_content.len());
                    let safe_start = chapter.text_content.floor_char_boundary(snippet_start);
                    let safe_end = chapter.text_content.ceil_char_boundary(snippet_end);
                    let snippet = chapter.text_content[safe_start..safe_end]
                        .replace('\n', " ")
                        .trim()
                        .to_string();

                    let locator =
                        format!("epubcfi(/6/{}!/4/{}:0)", (idx + 1) * 2, absolute_char_idx);

                    matches.push(DocumentSearchMatch {
                        spine_index: idx,
                        chapter_title: chapter.title.clone(),
                        locator,
                        snippet: format!("...{}...", snippet),
                        match_char_offset: absolute_char_idx,
                    });

                    start_search = absolute_char_idx + clean_q.len();
                    if matches.len() >= MAX_SEARCH_RESULTS {
                        break;
                    }
                }
            }
        }

        Ok(matches)
    }

    /// Build canonical structured outline for the EPUB document.
    pub fn structure(&self) -> Result<DocumentStructure> {
        static BLOCK_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"(?is)<(h[1-6]|p)[^>]*>(.*?)</([a-zA-Z0-9]+)>").expect("Valid regex")
        });
        static TAG_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(TAG_REGEX).expect("Valid regex"));

        let mut section_nodes = Vec::with_capacity(self.spine.len());

        for (spine_idx, item) in self.spine.iter().enumerate() {
            let chapter = self.get_chapter(spine_idx)?;
            let mut chapter_nodes = Vec::new();
            let mut current_offset = 0;

            for cap in BLOCK_RE.captures_iter(&chapter.html_content) {
                let tag = cap
                    .get(1)
                    .map(|m| m.as_str().to_lowercase())
                    .unwrap_or_default();
                let close_tag = cap
                    .get(3)
                    .map(|m| m.as_str().to_lowercase())
                    .unwrap_or_default();
                if tag != close_tag {
                    continue;
                }
                let inner = cap.get(2).map(|m| m.as_str()).unwrap_or_default();
                let stripped = TAG_RE.replace_all(inner, " ");
                let clean_text = decode_xml_and_html_entities(&stripped)
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");

                if clean_text.is_empty() {
                    continue;
                }

                let char_len = clean_text.chars().count();
                if tag.starts_with('h') {
                    let level = tag
                        .as_bytes()
                        .get(1)
                        .map(|b| b.saturating_sub(b'0'))
                        .unwrap_or(1);
                    let id = format!("h-{}-{}", spine_idx, chapter_nodes.len());
                    let start_pos = DocumentPosition::new(spine_idx, current_offset)
                        .with_node(&id)
                        .with_locator(&item.href);
                    let end_pos = DocumentPosition::new(spine_idx, current_offset + char_len)
                        .with_node(&id)
                        .with_locator(&item.href);
                    chapter_nodes.push(
                        StructureNode::new(&id, NodeKind::Heading { level })
                            .with_text(&clean_text)
                            .with_range(DocumentRange::new(start_pos, end_pos)),
                    );
                } else {
                    let id = format!("p-{}-{}", spine_idx, chapter_nodes.len());
                    let start_pos = DocumentPosition::new(spine_idx, current_offset)
                        .with_node(&id)
                        .with_locator(&item.href);
                    let end_pos = DocumentPosition::new(spine_idx, current_offset + char_len)
                        .with_node(&id)
                        .with_locator(&item.href);
                    chapter_nodes.push(
                        StructureNode::new(
                            &id,
                            NodeKind::Paragraph {
                                index: chapter_nodes.len(),
                            },
                        )
                        .with_text(&clean_text)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                    );
                }
                current_offset += char_len + 1;
            }

            if chapter_nodes.is_empty() {
                let id = format!("p-{}-0", spine_idx);
                let p_node = StructureNode::new(&id, NodeKind::Paragraph { index: 0 })
                    .with_text(&chapter.text_content)
                    .with_range(DocumentRange::new(
                        DocumentPosition::new(spine_idx, 0),
                        DocumentPosition::new(spine_idx, chapter.text_content.chars().count()),
                    ));
                chapter_nodes.push(p_node);
            }

            let sec_id = format!("section-{}", spine_idx);
            let sec_node = StructureNode::new(
                &sec_id,
                NodeKind::Section {
                    index: spine_idx,
                    title: Some(chapter.title.clone()),
                },
            )
            .with_text(chapter.title)
            .with_children(chapter_nodes);

            section_nodes.push(sec_node);
        }

        let root_title = self
            .file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "EPUB Document".to_string());

        let root_node = StructureNode::new("doc-root", NodeKind::Document)
            .with_text(root_title)
            .with_children(section_nodes);

        Ok(DocumentStructure::new(root_node))
    }

    /// Retrieve the text of a specific paragraph within a chapter.
    pub fn get_paragraph(&self, spine_index: usize, paragraph_index: usize) -> Result<String> {
        let chapter = self.get_chapter(spine_index)?;
        static P_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"(?is)<p[^>]*>(.*?)</p>").expect("Valid regex")
        });
        static TAG_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(TAG_REGEX).expect("Valid regex"));

        for (current_idx, cap) in P_RE.captures_iter(&chapter.html_content).enumerate() {
            if current_idx == paragraph_index {
                let inner = cap.get(1).map(|m| m.as_str()).unwrap_or_default();
                let stripped = TAG_RE.replace_all(inner, " ");
                let clean = decode_xml_and_html_entities(&stripped)
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
                return Ok(clean);
            }
        }

        Err(LumaError::NotFound {
            entity_type: "Paragraph".to_string(),
            id: format!("spine:{spine_index}:p:{paragraph_index}"),
        })
    }

    /// Retrieve plaintext for a contiguous document range.
    pub fn get_range_text(&self, range: &DocumentRange) -> Result<String> {
        let chapter = self.get_chapter(range.start.section_index)?;
        let chars: Vec<char> = chapter.text_content.chars().collect();
        let start = range.start.char_offset.min(chars.len());
        let end = range.end.char_offset.min(chars.len());
        if start <= end {
            Ok(chars[start..end].iter().collect())
        } else {
            Ok(String::new())
        }
    }

    /// Collect all declared resources from manifest.
    pub fn get_resources(&self) -> Vec<ResourceDescriptor> {
        self.manifest
            .iter()
            .map(|(id, (href, media_type))| ResourceDescriptor {
                id: id.clone(),
                href: href.clone(),
                media_type: media_type.clone(),
                byte_size: None,
                dimensions: None,
            })
            .collect()
    }

    /// Read raw bytes of an embedded resource by href.
    pub fn read_resource(&self, href: &str) -> Result<Vec<u8>> {
        let file = File::open(&self.file_path)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open epub: {}", e)))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            LumaError::CorruptedDocument(format!("Failed to open zip archive: {}", e))
        })?;

        let res_path = if self.opf_dir.as_os_str().is_empty() {
            href.to_string()
        } else {
            self.opf_dir.join(href).to_string_lossy().replace('\\', "/")
        };

        let has_res = archive.by_name(&res_path).is_ok();
        let mut entry = if has_res {
            archive
                .by_name(&res_path)
                .map_err(|_| LumaError::NotFound {
                    entity_type: "Resource".to_string(),
                    id: href.to_string(),
                })?
        } else {
            archive.by_name(href).map_err(|_| LumaError::NotFound {
                entity_type: "Resource".to_string(),
                id: href.to_string(),
            })?
        };

        let mut data = Vec::new();
        entry.read_to_end(&mut data).map_err(|e| {
            LumaError::DocumentError(format!("Failed to read resource {}: {}", href, e))
        })?;
        Ok(data)
    }

    // ------------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------------

    fn find_opf_path(archive: &mut zip::ZipArchive<File>) -> Result<String> {
        let mut container_entry = archive
            .by_name(CONTAINER_PATH)
            .map_err(|_| LumaError::CorruptedDocument(ERR_CONTAINER_MISSING.into()))?;

        let mut container_bytes = Vec::new();
        container_entry
            .read_to_end(&mut container_bytes)
            .map_err(|e| LumaError::CorruptedDocument(format!("Corrupted zip entry: {e}")))?;

        let container_xml = decode_text_bytes(&container_bytes);
        let mut reader = Reader::from_str(&container_xml);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                    if e.name().as_ref() == ROOTFILE_ELEM.as_bytes() {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == FULL_PATH_ATTR.as_bytes() {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    return Ok(val.to_string());
                                }
                            }
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(LumaError::CorruptedDocument(format!(
                        "XML error in container.xml: {e}"
                    )));
                }
                _ => {}
            }
            buf.clear();
        }

        Err(LumaError::CorruptedDocument(ERR_NO_ROOTFILE.into()))
    }

    #[allow(clippy::type_complexity)]
    fn parse_opf_manifest_and_spine(
        opf_xml: &str,
    ) -> Result<(
        HashMap<String, (String, String)>,
        Vec<SpineItem>,
        Option<String>,
        Option<String>,
    )> {
        let mut manifest = HashMap::new();
        let mut spine = Vec::new();
        let mut nav_href = None;
        let mut ncx_href = None;
        let mut ncx_id = None;

        let mut reader = Reader::from_str(opf_xml);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                    let local_name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();

                    if local_name == OPF_ITEM_ELEM {
                        let mut item_id = String::new();
                        let mut item_href = String::new();
                        let mut media_type = String::new();
                        let mut properties = String::new();

                        for attr in e.attributes().flatten() {
                            let k = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let v = String::from_utf8_lossy(&attr.value).to_string();
                            match k.as_str() {
                                OPF_ID_ATTR => item_id = v,
                                OPF_HREF_ATTR => item_href = v,
                                OPF_MEDIA_TYPE_ATTR => media_type = v,
                                OPF_PROPERTIES_ATTR => properties = v,
                                _ => {}
                            }
                        }

                        if !item_id.is_empty() && !item_href.is_empty() {
                            if properties.contains(PROPERTY_NAV) {
                                nav_href = Some(item_href.clone());
                            }
                            if media_type == NCX_MEDIA_TYPE {
                                ncx_href = Some(item_href.clone());
                            }
                            manifest.insert(item_id, (item_href, media_type));
                        }
                    } else if local_name == OPF_SPINE_ELEM {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == OPF_TOC_ATTR.as_bytes() {
                                ncx_id = Some(String::from_utf8_lossy(&attr.value).to_string());
                            }
                        }
                    } else if local_name == OPF_ITEMREF_ELEM {
                        let mut idref = String::new();
                        let mut linear = true;

                        for attr in e.attributes().flatten() {
                            let k = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let v = String::from_utf8_lossy(&attr.value).to_string();
                            if k == OPF_IDREF_ATTR {
                                idref = v;
                            } else if k == OPF_LINEAR_ATTR && v == "no" {
                                linear = false;
                            }
                        }

                        if let Some((href, mtype)) = manifest.get(&idref) {
                            spine.push(SpineItem {
                                id: idref,
                                href: href.clone(),
                                media_type: mtype.clone(),
                                linear,
                            });
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(LumaError::CorruptedDocument(format!(
                        "XML error in OPF: {e}"
                    )));
                }
                _ => {}
            }
            buf.clear();
        }

        if ncx_href.is_none() {
            if let Some(ref nid) = ncx_id {
                if let Some((href, _)) = manifest.get(nid) {
                    ncx_href = Some(href.clone());
                }
            }
        }

        Ok((manifest, spine, nav_href, ncx_href))
    }

    fn parse_toc(
        archive: &mut zip::ZipArchive<File>,
        opf_dir: &Path,
        nav_href: Option<&str>,
        ncx_href: Option<&str>,
        spine: &[SpineItem],
    ) -> Vec<TocItem> {
        // 1. Try EPUB 3 Navigation Document (nav.xhtml)
        if let Some(href) = nav_href {
            let full_nav_path = if opf_dir.as_os_str().is_empty() {
                href.to_string()
            } else {
                opf_dir.join(href).to_string_lossy().replace('\\', "/")
            };

            let entry_res = if archive.by_name(&full_nav_path).is_ok() {
                archive.by_name(&full_nav_path).ok()
            } else {
                archive.by_name(href).ok()
            };

            if let Some(mut entry) = entry_res {
                let mut nav_bytes = Vec::new();
                if entry.read_to_end(&mut nav_bytes).is_ok() {
                    let nav_html = decode_text_bytes(&nav_bytes);
                    let items = Self::parse_nav_doc_toc(&nav_html);
                    if !items.is_empty() {
                        return items;
                    }
                }
            }
        }

        // 2. Try EPUB 2 NCX Document (toc.ncx)
        if let Some(href) = ncx_href {
            let full_ncx_path = if opf_dir.as_os_str().is_empty() {
                href.to_string()
            } else {
                opf_dir.join(href).to_string_lossy().replace('\\', "/")
            };

            let entry_res = if archive.by_name(&full_ncx_path).is_ok() {
                archive.by_name(&full_ncx_path).ok()
            } else {
                archive.by_name(href).ok()
            };

            if let Some(mut entry) = entry_res {
                let mut ncx_bytes = Vec::new();
                if entry.read_to_end(&mut ncx_bytes).is_ok() {
                    let ncx_xml = decode_text_bytes(&ncx_bytes);
                    let items = Self::parse_ncx_toc(&ncx_xml);
                    if !items.is_empty() {
                        return items;
                    }
                }
            }
        }

        // 3. Fallback: Generate TOC directly from spine items
        spine
            .iter()
            .enumerate()
            .map(|(i, item)| {
                let clean_name = Path::new(&item.href)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Chapter")
                    .replace(['_', '-'], " ");
                TocItem {
                    title: format!("Chapter {}: {}", i + 1, clean_name),
                    locator: format!("epubcfi(/6/{}!/4/1:0)", (i + 1) * 2),
                    play_order: Some((i + 1) as u32),
                    children: Vec::new(),
                }
            })
            .collect()
    }

    fn parse_nav_doc_toc(nav_html: &str) -> Vec<TocItem> {
        let mut items = Vec::new();
        let mut reader = Reader::from_str(nav_html);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();
        let mut current_href = String::new();
        let mut current_title_parts: Vec<String> = Vec::new();
        let mut inside_a = false;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    if e.local_name().as_ref() == b"a" {
                        inside_a = true;
                        current_title_parts.clear();
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"href" {
                                current_href = String::from_utf8_lossy(&attr.value).to_string();
                            }
                        }
                    }
                }
                Ok(Event::Text(e)) if inside_a => {
                    let text = String::from_utf8_lossy(e.as_ref()).to_string();
                    let decoded = decode_xml_and_html_entities(&text);
                    if !decoded.trim().is_empty() {
                        current_title_parts.push(decoded.trim().to_string());
                    }
                }
                Ok(Event::End(e)) if e.local_name().as_ref() == b"a" => {
                    inside_a = false;
                    let full_title = current_title_parts.join(" ");
                    let clean_title = decode_xml_and_html_entities(&full_title);
                    let sanitized = sanitize_untrusted_html(&clean_title);
                    if !current_href.is_empty() && !sanitized.trim().is_empty() {
                        let play_order = (items.len() + 1) as u32;
                        items.push(TocItem {
                            title: sanitized.trim().to_string(),
                            locator: current_href.clone(),
                            play_order: Some(play_order),
                            children: Vec::new(),
                        });
                    }
                    current_href.clear();
                    current_title_parts.clear();
                }
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }

        items
    }

    fn parse_ncx_toc(ncx_xml: &str) -> Vec<TocItem> {
        let mut items = Vec::new();
        let mut reader = Reader::from_str(ncx_xml);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();
        let mut current_title = String::new();
        let mut current_src = String::new();
        let mut in_text = false;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) if e.local_name().as_ref() == b"text" => {
                    in_text = true;
                }
                Ok(Event::Empty(e)) if e.local_name().as_ref() == b"content" => {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"src" {
                            current_src = String::from_utf8_lossy(&attr.value).to_string();
                        }
                    }
                }
                Ok(Event::Text(e)) if in_text => {
                    let raw_text = String::from_utf8_lossy(e.as_ref()).to_string();
                    current_title = decode_xml_and_html_entities(&raw_text).trim().to_string();
                    in_text = false;
                }
                Ok(Event::End(e))
                    if e.local_name().as_ref() == b"navPoint" && !current_title.is_empty() =>
                {
                    let play_order = (items.len() + 1) as u32;
                    let sanitized = sanitize_untrusted_html(&current_title);
                    items.push(TocItem {
                        title: sanitized.trim().to_string(),
                        locator: current_src.clone(),
                        play_order: Some(play_order),
                        children: Vec::new(),
                    });
                    current_title.clear();
                    current_src.clear();
                }
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }

        items
    }

    fn extract_chapter_title(html: &str) -> Option<String> {
        static HEADER_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(HEADER_REGEX).expect("Valid regex"));
        let caps = HEADER_RE.captures(html)?;
        caps.get(2).map(|m| {
            let decoded = decode_xml_and_html_entities(m.as_str().trim());
            sanitize_untrusted_html(&decoded)
        })
    }

    fn extract_plain_text(html: &str) -> String {
        static TAG_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(TAG_REGEX).expect("Valid regex"));
        let stripped = TAG_RE.replace_all(html, " ");
        let decoded = decode_xml_and_html_entities(&stripped);
        decoded.split_whitespace().collect::<Vec<_>>().join(" ")
    }
}
