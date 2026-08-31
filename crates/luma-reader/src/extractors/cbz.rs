use std::fs::File;
use std::io::Read;
use std::path::Path;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;
use luma_security::sanitize_untrusted_html;

use crate::extractors::epub::ExtractedCover;
use crate::DocumentMetadata;

#[derive(Debug, Clone, Default)]
pub struct CbzPackageData {
    pub metadata: DocumentMetadata,
    pub cover: Option<ExtractedCover>,
    pub series: Option<String>,
    pub series_index: Option<f32>,
}

pub struct CbzExtractor;

impl CbzExtractor {
    pub fn extract<P: AsRef<Path>>(path: P) -> Result<CbzPackageData> {
        let path_ref = path.as_ref();
        let file = File::open(path_ref)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open CBZ archive: {}", e)))?;

        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| LumaError::CorruptedDocument(format!("Invalid CBZ zip archive: {}", e)))?;

        let fallback_title = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Comic")
            .replace(['_', '-'], " ");

        let mut title = fallback_title;
        let mut authors = Vec::new();
        let mut series = None;
        let mut series_index = None;
        let mut description = None;

        // Check if ComicInfo.xml exists
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

        // Extract first image file as cover
        let mut cover = None;
        let mut image_names = Vec::new();
        for i in 0..archive.len() {
            if let Ok(entry) = archive.by_index(i) {
                let name = entry.name().to_string();
                let lower = name.to_lowercase();
                if lower.ends_with(".jpg")
                    || lower.ends_with(".jpeg")
                    || lower.ends_with(".png")
                    || lower.ends_with(".webp")
                {
                    image_names.push(name);
                }
            }
        }
        image_names.sort();

        if let Some(first_img) = image_names.first() {
            if let Ok(mut entry) = archive.by_name(first_img) {
                let mut data = Vec::new();
                if entry.read_to_end(&mut data).is_ok() {
                    let mime_type = if first_img.ends_with(".png") {
                        "image/png"
                    } else if first_img.ends_with(".webp") {
                        "image/webp"
                    } else {
                        "image/jpeg"
                    };
                    cover = Some(ExtractedCover {
                        mime_type: mime_type.to_string(),
                        data,
                        filename: "cover.jpg".to_string(),
                    });
                }
            }
        }

        Ok(CbzPackageData {
            metadata: DocumentMetadata {
                title,
                authors,
                language: None,
                publisher: None,
                description,
                isbn: None,
                format: DocumentFormat::Cbz,
                total_pages_or_spines: Some(image_names.len() as u32),
            },
            cover,
            series,
            series_index,
        })
    }

    fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
        let pattern = format!(r"<{}>([^<]+)</{}>", tag, tag);
        let re = regex::Regex::new(&pattern).ok()?;
        let caps = re.captures(xml)?;
        caps.get(1).map(|m| m.as_str().trim().to_string())
    }
}
