use regex::Regex;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_security::sanitize_untrusted_html;
use crate::encoding::decode_text_bytes;
use crate::epub_doc::{ChapterContent, DocumentSearchMatch};
use crate::TocItem;

/// Document engine for standalone HTML documents (.html, .htm).
pub struct HtmlDocument {
    file_path: PathBuf,
    title: String,
    raw_text: String,
    html_content: String,
    toc: Vec<TocItem>,
}

impl HtmlDocument {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open HTML file: {}", e)))?;

        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|e| LumaError::DocumentError(format!("Failed to read HTML file: {}", e)))?;

        let raw_html = decode_text_bytes(&bytes);

        // Sanitize untrusted HTML strictly to strip scripts, iframes, and javascript: protocols
        let sanitized = sanitize_untrusted_html(&raw_html);

        let fallback_title = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("HTML Document")
            .replace(['_', '-'], " ");

        // Extract title from <title> or <h1>
        static TITLE_REGEX: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"(?i)<title[^>]*>([^<]+)</title>").expect("Valid regex")
        });
        static H1_REGEX: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"(?i)<h1[^>]*>([^<]+)</h1>").expect("Valid regex")
        });

        let title = TITLE_REGEX
            .captures(&sanitized)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string())
            .or_else(|| {
                H1_REGEX
                    .captures(&sanitized)
                    .and_then(|c| c.get(1))
                    .map(|m| m.as_str().trim().to_string())
            })
            .unwrap_or(fallback_title);

        // Extract TOC items from <h1> and <h2>
        static HEADING_REGEX: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"(?i)<(h1|h2)[^>]*>([^<]+)</(?:h1|h2)>").expect("Valid regex")
        });

        let mut toc = Vec::new();
        let mut order = 1;
        for cap in HEADING_REGEX.captures_iter(&sanitized) {
            if let Some(text_match) = cap.get(2) {
                let heading_text = text_match.as_str().trim();
                if !heading_text.is_empty() {
                    toc.push(TocItem {
                        title: heading_text.to_string(),
                        locator: format!("html:heading-{}", order),
                        play_order: Some(order),
                        children: Vec::new(),
                    });
                    order += 1;
                }
            }
        }

        if toc.is_empty() {
            toc.push(TocItem {
                title: title.clone(),
                locator: "html:body".to_string(),
                play_order: Some(1),
                children: Vec::new(),
            });
        }

        // Extract raw text for searching by stripping HTML tags
        static TAG_STRIPPER: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"<[^>]+>").expect("Valid regex")
        });
        let raw_text = TAG_STRIPPER.replace_all(&sanitized, " ").to_string();

        // Wrap inside reader container
        let wrapped_html = format!(
            "<div class=\"reader-html-container font-serif text-lg leading-relaxed text-[#1C1917] dark:text-[#F5F1EA] max-w-2xl mx-auto px-6 py-12 space-y-4\">\n{}\n</div>",
            sanitized
        );

        Ok(Self {
            file_path: path_ref.to_path_buf(),
            title,
            raw_text,
            html_content: wrapped_html,
            toc,
        })
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn spine_count(&self) -> usize {
        1
    }

    pub fn toc(&self) -> &[TocItem] {
        &self.toc
    }

    pub fn get_chapter(&self, spine_index: usize) -> Result<ChapterContent> {
        if spine_index != 0 {
            return Err(LumaError::NotFound {
                entity_type: "Chapter".to_string(),
                id: spine_index.to_string(),
            });
        }

        Ok(ChapterContent {
            spine_index: 0,
            id: "html_doc".to_string(),
            title: self.title.clone(),
            href: self
                .file_path
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "document.html".to_string()),
            html_content: self.html_content.clone(),
            text_content: self.raw_text.clone(),
        })
    }

    pub fn search(&self, query: &str) -> Result<Vec<DocumentSearchMatch>> {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return Ok(Vec::new());
        }

        let lower_text = self.raw_text.to_lowercase();
        let mut matches = Vec::new();
        let mut start_idx = 0;

        while let Some(pos) = lower_text[start_idx..].find(&q) {
            let actual_pos = start_idx + pos;
            let snippet_start = actual_pos.saturating_sub(40);
            let snippet_end = (actual_pos + q.len() + 40).min(self.raw_text.len());

            let safe_start = self.raw_text.floor_char_boundary(snippet_start);
            let safe_end = self.raw_text.ceil_char_boundary(snippet_end);

            let snippet = format!("...{}...", &self.raw_text[safe_start..safe_end]);

            matches.push(DocumentSearchMatch {
                spine_index: 0,
                chapter_title: self.title.clone(),
                locator: format!("html:offset={}", actual_pos),
                snippet,
                match_char_offset: actual_pos,
            });

            if matches.len() >= 50 {
                break;
            }

            start_idx = actual_pos + q.len();
            if start_idx >= lower_text.len() {
                break;
            }
        }

        Ok(matches)
    }
}
