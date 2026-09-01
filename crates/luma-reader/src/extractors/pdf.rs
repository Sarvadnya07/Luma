use regex::Regex;
use std::fs::File;
use std::io::Read;
use std::path::Path;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;
use luma_security::sanitize_untrusted_html;

use crate::pdf_doc::PdfDocument;
use crate::DocumentMetadata;

pub struct PdfExtractor;

impl PdfExtractor {
    pub fn extract<P: AsRef<Path>>(path: P) -> Result<DocumentMetadata> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open PDF: {}", e)))?;

        // Read first 64KB and last 32KB where Info dict and XMP metadata typically live
        let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
        let mut buffer = Vec::new();

        if file_len < 100_000 {
            file.read_to_end(&mut buffer)
                .map_err(|e| LumaError::DocumentError(e.to_string()))?;
        } else {
            let mut head = vec![0u8; 64 * 1024];
            let read_bytes = file.read(&mut head).unwrap_or(0);
            buffer.extend_from_slice(&head[..read_bytes]);
        }

        let raw_text = String::from_utf8_lossy(&buffer);

        let mut title = Self::extract_field(&raw_text, r"/Title\s*(\([^)]+\)|<[0-9A-Fa-f]+>)");
        let author = Self::extract_field(&raw_text, r"/Author\s*(\([^)]+\)|<[0-9A-Fa-f]+>)");
        let subject = Self::extract_field(&raw_text, r"/Subject\s*(\([^)]+\)|<[0-9A-Fa-f]+>)");

        if title.is_none() {
            // Fallback: Check XMP `<dc:title>`
            if let Some(caps) = Regex::new(r"<dc:title>[^<]*<rdf:li[^>]*>([^<]+)</rdf:li>")
                .ok()
                .and_then(|r| r.captures(&raw_text))
            {
                if let Some(m) = caps.get(1) {
                    let clean = m.as_str().trim();
                    if !clean.is_empty() && PdfDocument::is_valid_printable_text(clean) {
                        title = Some(clean.to_string());
                    }
                }
            }
        }

        let fallback_title = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled PDF Document")
            .replace(['_', '-'], " ");

        let resolved_title = title.unwrap_or(fallback_title);
        let authors = if let Some(a) = author {
            vec![sanitize_untrusted_html(&a)]
        } else {
            Vec::new()
        };

        Ok(DocumentMetadata {
            title: sanitize_untrusted_html(&resolved_title),
            authors,
            language: None,
            publisher: None,
            description: subject.map(|s| sanitize_untrusted_html(&s)),
            isbn: None,
            format: DocumentFormat::Pdf,
            total_pages_or_spines: None,
        })
    }

    fn extract_field(text: &str, pattern: &str) -> Option<String> {
        let re = Regex::new(pattern).ok()?;
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
