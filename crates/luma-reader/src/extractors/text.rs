use std::fs::File;
use std::io::Read;
use std::path::Path;
use regex::Regex;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;
use luma_security::sanitize_untrusted_html;

use crate::DocumentMetadata;

pub struct TextExtractor;

impl TextExtractor {
    pub fn extract<P: AsRef<Path>>(path: P, format: DocumentFormat) -> Result<DocumentMetadata> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open text file: {}", e)))?;

        let mut head = vec![0u8; 16 * 1024];
        let bytes_read = file.read(&mut head).unwrap_or(0);
        let content_str = String::from_utf8_lossy(&head[..bytes_read]);

        let fallback_title = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Document")
            .replace(['_', '-'], " ");

        let mut title = None;
        let mut authors = Vec::new();
        let mut description = None;

        if format == DocumentFormat::Html {
            // Check <title>...</title>
            if let Some(caps) = Regex::new(r"(?i)<title[^>]*>([^<]+)</title>").ok().and_then(|r| r.captures(&content_str)) {
                if let Some(m) = caps.get(1) {
                    title = Some(m.as_str().trim().to_string());
                }
            }
        } else if format == DocumentFormat::Md {
            // Check YAML Frontmatter
            if content_str.starts_with("---") {
                if let Some(end_idx) = content_str[3..].find("---") {
                    let frontmatter = &content_str[3..3 + end_idx];
                    for line in frontmatter.lines() {
                        let trimmed = line.trim();
                        if let Some(stripped) = trimmed.strip_prefix("title:") {
                            title = Some(stripped.trim().trim_matches('"').trim_matches('\'').to_string());
                        } else if let Some(stripped) = trimmed.strip_prefix("author:") {
                            authors.push(stripped.trim().trim_matches('"').trim_matches('\'').to_string());
                        } else if let Some(stripped) = trimmed.strip_prefix("description:") {
                            description = Some(stripped.trim().trim_matches('"').trim_matches('\'').to_string());
                        }
                    }
                }
            }

            // If no title from frontmatter, check first markdown header `# ...`
            if title.is_none() {
                for line in content_str.lines() {
                    let trimmed = line.trim();
                    if let Some(h1) = trimmed.strip_prefix("# ") {
                        title = Some(h1.trim().to_string());
                        break;
                    }
                }
            }
        }

        let resolved_title = title.unwrap_or(fallback_title);

        Ok(DocumentMetadata {
            title: sanitize_untrusted_html(&resolved_title),
            authors,
            language: None,
            publisher: None,
            description,
            isbn: None,
            format,
            total_pages_or_spines: None,
        })
    }
}
