use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use quick_xml::events::Event;
use quick_xml::Reader;
use regex::Regex;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;
use luma_security::sanitize_untrusted_html;

use crate::DocumentMetadata;

#[derive(Debug, Clone, Default)]
pub struct ExtractedCover {
    pub mime_type: String,
    pub data: Vec<u8>,
    pub filename: String,
}

#[derive(Debug, Clone, Default)]
pub struct EpubPackageData {
    pub metadata: DocumentMetadata,
    pub cover: Option<ExtractedCover>,
    pub series: Option<String>,
    pub series_index: Option<f32>,
    pub subjects: Vec<String>,
}

pub struct EpubExtractor;

impl EpubExtractor {
    pub fn extract<P: AsRef<Path>>(path: P) -> Result<EpubPackageData> {
        let file = File::open(path.as_ref())
            .map_err(|e| LumaError::DocumentError(format!("Failed to open EPUB: {}", e)))?;

        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| LumaError::CorruptedDocument(format!("Invalid EPUB zip archive: {}", e)))?;

        // 1. Locate rootfile from META-INF/container.xml
        let opf_path = Self::find_opf_path(&mut archive)?;
        let opf_dir = Path::new(&opf_path).parent().unwrap_or(Path::new("")).to_path_buf();

        // 2. Read OPF content
        let mut opf_entry = archive
            .by_name(&opf_path)
            .map_err(|e| LumaError::CorruptedDocument(format!("OPF file not found in EPUB: {}", e)))?;

        let mut opf_xml = String::new();
        opf_entry
            .read_to_string(&mut opf_xml)
            .map_err(|e| LumaError::CorruptedDocument(format!("Failed to read OPF xml: {}", e)))?;
        drop(opf_entry);

        // 3. Parse OPF XML
        let (metadata, cover_id_or_href, series, series_index, subjects) = Self::parse_opf(&opf_xml)?;

        // 4. Extract Cover image if referenced
        let mut cover = None;
        if let Some(cover_ref) = cover_id_or_href {
            cover = Self::extract_cover_image(&mut archive, &opf_xml, &opf_dir, &cover_ref);
        }

        Ok(EpubPackageData {
            metadata,
            cover,
            series,
            series_index,
            subjects,
        })
    }

    fn find_opf_path(archive: &mut zip::ZipArchive<File>) -> Result<String> {
        let mut container_entry = archive
            .by_name("META-INF/container.xml")
            .map_err(|_| LumaError::CorruptedDocument("META-INF/container.xml missing in EPUB".into()))?;

        let mut container_xml = String::new();
        container_entry
            .read_to_string(&mut container_xml)
            .map_err(|e| LumaError::CorruptedDocument(format!("Failed to read container.xml: {}", e)))?;

        let mut reader = Reader::from_str(&container_xml);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                    if e.name().as_ref() == b"rootfile" {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"full-path" {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    return Ok(val.to_string());
                                }
                            }
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(LumaError::CorruptedDocument(format!("Error in container.xml: {}", e))),
                _ => {}
            }
            buf.clear();
        }

        Err(LumaError::CorruptedDocument("No rootfile full-path found in container.xml".into()))
    }

    fn parse_opf(
        opf_xml: &str,
    ) -> Result<(DocumentMetadata, Option<String>, Option<String>, Option<f32>, Vec<String>)> {
        let mut title = String::new();
        let mut authors = Vec::new();
        let mut language = None;
        let mut publisher = None;
        let mut description = None;
        let mut isbn = None;
        let mut cover_id_or_href = None;
        let mut series = None;
        let mut series_index = None;
        let mut subjects = Vec::new();

        let mut reader = Reader::from_str(opf_xml);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();
        let mut current_tag = String::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    let local_name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                    current_tag = local_name.clone();

                    // Check EPUB 3 cover image property
                    if local_name == "item" {
                        let mut item_id = String::new();
                        let mut item_href = String::new();
                        let mut is_cover = false;

                        for attr in e.attributes().flatten() {
                            let k = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let v = String::from_utf8_lossy(&attr.value).to_string();
                            if k == "id" {
                                item_id = v;
                            } else if k == "href" {
                                item_href = v;
                            } else if k == "properties" && v.contains("cover-image") {
                                is_cover = true;
                            }
                        }

                        if is_cover && !item_href.is_empty() {
                            cover_id_or_href = Some(item_href);
                        }
                    }
                }
                Ok(Event::Empty(e)) => {
                    let local_name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();

                    // Check EPUB 2 Calibre and EPUB 3 meta tags
                    if local_name == "meta" {
                        let mut name = String::new();
                        let mut content = String::new();
                        let mut property = String::new();

                        for attr in e.attributes().flatten() {
                            let k = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let v = String::from_utf8_lossy(&attr.value).to_string();
                            if k == "name" {
                                name = v;
                            } else if k == "content" {
                                content = v;
                            } else if k == "property" {
                                property = v;
                            }
                        }

                        if name == "cover" && !content.is_empty() && cover_id_or_href.is_none() {
                            cover_id_or_href = Some(content);
                        } else if name == "calibre:series" && !content.is_empty() {
                            series = Some(content);
                        } else if name == "calibre:series_index" && !content.is_empty() {
                            series_index = content.parse::<f32>().ok();
                        } else if property == "belongs-to-collection" && !content.is_empty() {
                            series = Some(content);
                        } else if property == "group-position" && !content.is_empty() {
                            series_index = content.parse::<f32>().ok();
                        }
                    }
                }
                Ok(Event::Text(e)) => {
                    let text = e.unescape().unwrap_or_default().trim().to_string();
                    if !text.is_empty() {
                        match current_tag.as_str() {
                            "title" if title.is_empty() => {
                                title = sanitize_untrusted_html(&text);
                            }
                            "creator" => {
                                let author_name = sanitize_untrusted_html(&text);
                                if !authors.contains(&author_name) {
                                    authors.push(author_name);
                                }
                            }
                            "language" if language.is_none() => {
                                language = Some(text);
                            }
                            "publisher" if publisher.is_none() => {
                                publisher = Some(sanitize_untrusted_html(&text));
                            }
                            "description" if description.is_none() => {
                                description = Some(sanitize_untrusted_html(&text));
                            }
                            "identifier" => {
                                if isbn.is_none() && (text.to_lowercase().contains("isbn") || text.chars().filter(|c| c.is_ascii_digit()).count() >= 10) {
                                    isbn = Some(text);
                                }
                            }
                            "subject" => {
                                let clean = sanitize_untrusted_html(&text);
                                if !subjects.contains(&clean) {
                                    subjects.push(clean);
                                }
                            }
                            _ => {}
                        }
                    }
                }
                Ok(Event::End(_)) => {
                    current_tag.clear();
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(LumaError::CorruptedDocument(format!("XML parse error in OPF: {}", e))),
                _ => {}
            }
            buf.clear();
        }

        if title.is_empty() {
            title = "Untitled Publication".to_string();
        }

        Ok((
            DocumentMetadata {
                title,
                authors,
                language,
                publisher,
                description,
                isbn,
                format: DocumentFormat::Epub,
                total_pages_or_spines: None,
            },
            cover_id_or_href,
            series,
            series_index,
            subjects,
        ))
    }

    fn extract_cover_image(
        archive: &mut zip::ZipArchive<File>,
        opf_xml: &str,
        opf_dir: &Path,
        cover_ref: &str,
    ) -> Option<ExtractedCover> {
        // If cover_ref is an item ID, find corresponding href in manifest
        let mut target_href = cover_ref.to_string();
        let item_regex = Regex::new(&format!(r#"<item[^>]*id=["']{}["'][^>]*href=["']([^"']+)["']"#, regex::escape(cover_ref))).ok()?;

        if let Some(caps) = item_regex.captures(opf_xml) {
            if let Some(href_match) = caps.get(1) {
                target_href = href_match.as_str().to_string();
            }
        }

        // URL decode href (e.g. spaces %20)
        let decoded_href = target_href.replace("%20", " ");
        let full_path = if opf_dir.as_os_str().is_empty() {
            decoded_href.clone()
        } else {
            opf_dir.join(&decoded_href).to_slash_lossy()
        };

        // Try opening directly or with normalized path
        let mut file_entry = archive.by_name(&full_path).or_else(|_| archive.by_name(&decoded_href)).ok()?;

        let mut data = Vec::new();
        file_entry.read_to_end(&mut data).ok()?;

        let mime_type = if full_path.ends_with(".png") {
            "image/png".to_string()
        } else if full_path.ends_with(".webp") {
            "image/webp".to_string()
        } else {
            "image/jpeg".to_string()
        };

        let filename = Path::new(&full_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("cover.jpg")
            .to_string();

        Some(ExtractedCover {
            mime_type,
            data,
            filename,
        })
    }
}

trait PathExt {
    fn to_slash_lossy(&self) -> String;
}

impl PathExt for PathBuf {
    fn to_slash_lossy(&self) -> String {
        self.to_string_lossy().replace('\\', "/")
    }
}
