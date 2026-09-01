use regex::Regex;
use std::fs::File;
use std::io::Read;
use std::path::Path;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;
use luma_security::sanitize_untrusted_html;

use crate::extractors::epub::ExtractedCover;
use crate::pdf_doc::PdfDocument;
use crate::DocumentMetadata;

static PDF_TITLE_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"/Title\s*(\([^)]+\)|<[0-9A-Fa-f]+>)").expect("Valid regex")
});
static PDF_AUTHOR_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"/Author\s*(\([^)]+\)|<[0-9A-Fa-f]+>)").expect("Valid regex")
});
static PDF_SUBJECT_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"/Subject\s*(\([^)]+\)|<[0-9A-Fa-f]+>)").expect("Valid regex")
});
static XMP_TITLE_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"<dc:title>[^<]*<rdf:li[^>]*>([^<]+)</rdf:li>").expect("Valid regex")
});
static XMP_CREATOR_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"<dc:creator>[^<]*<rdf:li[^>]*>([^<]+)</rdf:li>").expect("Valid regex")
});
static HEX_HASH_PREFIX_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"^[0-9a-fA-F]{24,64}[\s_-]+").expect("Valid regex")
});
static TAG_ARTIFACTS_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"(?i)\s*(\(\s*(?:pdfdrive|z-lib\.org|oceanofpdf|libgen|retail|original)\s*\)|retailnbsped|nbsped)\s*").expect("Valid regex")
});

#[derive(Debug, Clone, Default)]
pub struct PdfPackageData {
    pub metadata: DocumentMetadata,
    pub cover: Option<ExtractedCover>,
}

pub struct PdfExtractor;

impl PdfExtractor {
    pub fn extract<P: AsRef<Path>>(path: P) -> Result<PdfPackageData> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open PDF: {}", e)))?;

        let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
        let mut buffer = Vec::new();

        if file_len < 2_000_000 {
            file.read_to_end(&mut buffer)
                .map_err(|e| LumaError::DocumentError(e.to_string()))?;
        } else {
            let mut head = vec![0u8; 1_000_000];
            let read_bytes = file.read(&mut head).unwrap_or(0);
            buffer.extend_from_slice(&head[..read_bytes]);
        }

        let raw_text = String::from_utf8_lossy(&buffer);

        let mut title = Self::extract_field(&raw_text, &PDF_TITLE_RE);
        let mut author = Self::extract_field(&raw_text, &PDF_AUTHOR_RE);
        let subject = Self::extract_field(&raw_text, &PDF_SUBJECT_RE);

        if title.is_none() {
            if let Some(caps) = XMP_TITLE_RE.captures(&raw_text) {
                if let Some(m) = caps.get(1) {
                    let clean = m.as_str().trim();
                    if !clean.is_empty() && PdfDocument::is_valid_printable_text(clean) {
                        title = Some(clean.to_string());
                    }
                }
            }
        }

        if author.is_none() {
            if let Some(caps) = XMP_CREATOR_RE.captures(&raw_text) {
                if let Some(m) = caps.get(1) {
                    let clean = m.as_str().trim();
                    if !clean.is_empty() && PdfDocument::is_valid_printable_text(clean) {
                        author = Some(clean.to_string());
                    }
                }
            }
        }

        // Clean filename fallback
        let raw_stem = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Document");

        let cleaned_fallback = Self::clean_title(raw_stem);

        // If title from metadata is empty or contains hash artifact, use cleaned fallback
        let mut resolved_title = match title {
            Some(t) if !t.trim().is_empty() && !HEX_HASH_PREFIX_RE.is_match(&t) => Self::clean_title(&t),
            _ => cleaned_fallback,
        };

        if resolved_title.is_empty() {
            resolved_title = "Untitled Document".to_string();
        }

        let mut authors = if let Some(a) = author {
            let cleaned_author = Self::clean_author(&a);
            if !cleaned_author.is_empty() {
                vec![sanitize_untrusted_html(&cleaned_author)]
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        // If author is still empty, check if title was "Author - Title" format
        if authors.is_empty() && resolved_title.contains(" - ") {
            let parts: Vec<&str> = resolved_title.splitn(2, " - ").collect();
            if parts.len() == 2 && parts[0].len() < 40 {
                authors.push(parts[0].trim().to_string());
                resolved_title = parts[1].trim().to_string();
            }
        }

        // Extract cover image if embedded in PDF
        let cover = Self::extract_cover_image(&buffer);

        Ok(PdfPackageData {
            metadata: DocumentMetadata {
                title: sanitize_untrusted_html(&resolved_title),
                authors,
                language: None,
                publisher: None,
                description: subject.map(|s| sanitize_untrusted_html(&s)),
                isbn: None,
                format: DocumentFormat::Pdf,
                total_pages_or_spines: None,
            },
            cover,
        })
    }

    pub fn clean_title(raw: &str) -> String {
        // Strip 32/64 char hex hashes (e.g. 56159221971f4fcd9a8c3528b4b58c88 )
        let stripped_hash = HEX_HASH_PREFIX_RE.replace(raw.trim(), "");
        // Strip download tags like ( PDFDrive ), retailnbsped
        let stripped_tags = TAG_ARTIFACTS_RE.replace_all(&stripped_hash, " ");
        let normalized = stripped_tags.replace(['_', '-'], " ");

        // Capitalize words cleanly
        normalized
            .split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn clean_author(raw: &str) -> String {
        let trimmed = raw.trim();
        if trimmed.eq_ignore_ascii_case("unknown") || trimmed.eq_ignore_ascii_case("anonymous") {
            return String::new();
        }
        trimmed.replace(['_', '-'], " ")
    }

    /// Extract embedded JPEG cover image from PDF stream objects
    fn extract_cover_image(buffer: &[u8]) -> Option<ExtractedCover> {
        // Look for stream with /Filter /DCTDecode (JPEG image)
        let stream_str = String::from_utf8_lossy(buffer);
        let stream_re = Regex::new(r"(?s)(/Type\s*/XObject|/Subtype\s*/Image|/Filter\s*/DCTDecode)[^>]*>>\s*stream\r?\n").ok()?;

        if let Some(mat) = stream_re.find(&stream_str) {
            let stream_start = mat.end();
            if stream_start < buffer.len() {
                // Find endstream
                if let Some(end_rel) = buffer[stream_start..].windows(9).position(|w| w == b"endstream") {
                    let stream_bytes = &buffer[stream_start..stream_start + end_rel];
                    // Verify JPEG header [0xFF, 0xD8]
                    if stream_bytes.len() >= 2048 && stream_bytes.starts_with(&[0xFF, 0xD8]) {
                        return Some(ExtractedCover {
                            mime_type: "image/jpeg".to_string(),
                            data: stream_bytes.to_vec(),
                            filename: "cover.jpg".to_string(),
                        });
                    }
                }
            }
        }

        // Direct scan for standalone JPEG image header in first 1MB of buffer
        let scan_limit = buffer.len().min(1_000_000);
        for i in 0..scan_limit.saturating_sub(4) {
            if buffer[i] == 0xFF && buffer[i + 1] == 0xD8 && buffer[i + 2] == 0xFF {
                // Find JPEG EOI marker [0xFF, 0xD9]
                if let Some(eoi) = buffer[i + 2..scan_limit].windows(2).position(|w| w == [0xFF, 0xD9]) {
                    let jpeg_bytes = &buffer[i..i + 2 + eoi + 2];
                    if jpeg_bytes.len() >= 4096 && jpeg_bytes.len() <= 5_000_000 {
                        return Some(ExtractedCover {
                            mime_type: "image/jpeg".to_string(),
                            data: jpeg_bytes.to_vec(),
                            filename: "cover.jpg".to_string(),
                        });
                    }
                }
            }
        }

        None
    }

    fn extract_field(text: &str, re: &Regex) -> Option<String> {
        let caps = re.captures(text)?;
        let raw_val = caps.get(1)?.as_str();
        let decoded = PdfDocument::decode_pdf_string_literal(raw_val);
        let trimmed = decoded.trim().to_string();
        if !trimmed.is_empty() && PdfDocument::is_valid_printable_text(&trimmed) {
            Some(trimmed)
        } else {
            None
        }
    }
}
