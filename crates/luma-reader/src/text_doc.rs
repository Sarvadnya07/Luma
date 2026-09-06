use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use crate::encoding::decode_text_bytes;
use crate::epub_doc::{ChapterContent, DocumentSearchMatch};
use crate::TocItem;

/// Document engine for standalone plaintext files (.txt).
pub struct TextDocument {
    file_path: PathBuf,
    title: String,
    raw_text: String,
    html_content: String,
    toc: Vec<TocItem>,
}

impl TextDocument {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open text file: {}", e)))?;

        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|e| LumaError::DocumentError(format!("Failed to read text file: {}", e)))?;

        let raw_text = decode_text_bytes(&bytes);

        let fallback_title = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Text Document")
            .replace(['_', '-'], " ");

        // Extract title from first non-empty line if short, otherwise fallback to filename
        let first_line = raw_text
            .lines()
            .map(|l| l.trim())
            .find(|l| !l.is_empty());

        let title = match first_line {
            Some(l) if l.len() <= 80 => l.to_string(),
            _ => fallback_title,
        };

        // Render paragraphs into safe HTML
        let mut html = String::with_capacity(raw_text.len() + 2048);
        html.push_str("<div class=\"reader-text-container font-serif text-lg leading-relaxed text-[#1C1917] dark:text-[#F5F1EA] max-w-2xl mx-auto px-6 py-12 space-y-4\">\n");

        let paragraphs: Vec<&str> = raw_text
            .split("\n\n")
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .collect();

        if paragraphs.is_empty() {
            html.push_str("<p class=\"reader-paragraph\" id=\"p0\"></p>\n");
        } else {
            for (idx, p) in paragraphs.iter().enumerate() {
                html.push_str(&format!("<p class=\"reader-paragraph\" id=\"p{}\">", idx));
                // Escape HTML characters
                for ch in p.chars() {
                    match ch {
                        '&' => html.push_str("&amp;"),
                        '<' => html.push_str("&lt;"),
                        '>' => html.push_str("&gt;"),
                        '"' => html.push_str("&quot;"),
                        '\'' => html.push_str("&#39;"),
                        '\n' => html.push_str("<br />\n"),
                        _ => html.push(ch),
                    }
                }
                html.push_str("</p>\n");
            }
        }
        html.push_str("</div>\n");

        let toc = vec![TocItem {
            title: title.clone(),
            locator: "p0".to_string(),
            play_order: Some(1),
            children: Vec::new(),
        }];

        Ok(Self {
            file_path: path_ref.to_path_buf(),
            title,
            raw_text,
            html_content: html,
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
            id: "text_doc".to_string(),
            title: self.title.clone(),
            href: self
                .file_path
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "text.txt".to_string()),
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

            // Avoid splitting UTF-8 code points
            let safe_start = self.raw_text.floor_char_boundary(snippet_start);
            let safe_end = self.raw_text.ceil_char_boundary(snippet_end);

            let snippet = format!("...{}...", &self.raw_text[safe_start..safe_end]);

            matches.push(DocumentSearchMatch {
                spine_index: 0,
                chapter_title: self.title.clone(),
                locator: format!("text:offset={}", actual_pos),
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
