use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use regex::Regex;
use serde::{Deserialize, Serialize};

use luma_core::error::{LumaError, Result};
use luma_security::sanitize_untrusted_html;

use crate::{DocumentSearchMatch, TocItem};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PdfPageData {
    pub page_number: u32,
    pub width_pt: f32,
    pub height_pt: f32,
    pub text_content: String,
}

pub struct PdfDocument {
    file_path: PathBuf,
    page_count: u32,
    toc: Vec<TocItem>,
}

impl PdfDocument {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let p = path.as_ref().to_path_buf();
        let mut file = File::open(&p)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open PDF file: {}", e)))?;

        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| LumaError::DocumentError(format!("Failed to read PDF: {}", e)))?;

        let raw_str = String::from_utf8_lossy(&buffer);

        // Extract approximate page count by searching for `/Type /Page` (excluding `/Pages`)
        let page_re = Regex::new(r"/Type\s*/Page\b").unwrap();
        let detected_pages = page_re.find_iter(&raw_str).count() as u32;
        let page_count = if detected_pages > 0 { detected_pages } else { 1 };

        // Extract Outlines/Bookmarks if present
        let mut toc = Vec::new();
        let outline_re = Regex::new(r"/Title\s*\(([^)]+)\)").unwrap();
        for (i, caps) in outline_re.captures_iter(&raw_str).enumerate() {
            if let Some(m) = caps.get(1) {
                let title = sanitize_untrusted_html(m.as_str().trim());
                if !title.is_empty() {
                    toc.push(TocItem {
                        title,
                        locator: format!("page={}", i + 1),
                        play_order: Some((i + 1) as u32),
                        children: Vec::new(),
                    });
                }
            }
            if toc.len() >= 50 {
                break;
            }
        }

        // Fallback TOC if none extracted
        if toc.is_empty() {
            for page in 1..=page_count.min(30) {
                toc.push(TocItem {
                    title: format!("Page {}", page),
                    locator: format!("page={}", page),
                    play_order: Some(page),
                    children: Vec::new(),
                });
            }
        }

        Ok(Self {
            file_path: p,
            page_count,
            toc,
        })
    }

    pub fn page_count(&self) -> u32 {
        self.page_count
    }

    pub fn toc(&self) -> &[TocItem] {
        &self.toc
    }

    pub fn get_page(&self, page_number: u32) -> Result<PdfPageData> {
        if page_number == 0 || page_number > self.page_count {
            return Err(LumaError::DocumentError(format!(
                "Page {} out of bounds (1..{})",
                page_number, self.page_count
            )));
        }

        // Read buffer to extract stream text if available
        let mut text_content = String::new();
        if let Ok(buffer) = std::fs::read(&self.file_path) {
            let raw_str = String::from_utf8_lossy(&buffer);
            text_content = Self::extract_page_text(&raw_str, page_number, self.page_count);
        }

        if text_content.is_empty() {
            text_content = format!("Page {}", page_number);
        }

        Ok(PdfPageData {
            page_number,
            width_pt: 595.0,  // Standard A4 width pt
            height_pt: 842.0, // Standard A4 height pt
            text_content,
        })
    }

    /// Extract text streams matching PDF text operators (BT ... ET, Tj, TJ)
    fn extract_page_text(raw_str: &str, target_page: u32, total_pages: u32) -> String {
        let mut page_text = String::new();

        // 1. Extract literal text within parenthesis text operators: `(text) Tj` or `(text) '`
        let tj_re = Regex::new(r"\(([^)]+)\)\s*(?:Tj|'|\x22)").unwrap();
        // 2. Extract text inside array operators: `[(t) -12 (e) -10 (x) (t)] TJ`
        let array_tj_re = Regex::new(r"\[([^\]]+)\]\s*TJ").unwrap();
        let paren_re = Regex::new(r"\(([^)]+)\)").unwrap();

        // If single page or small doc, parse all text streams
        if total_pages <= 1 {
            for caps in tj_re.captures_iter(raw_str) {
                if let Some(m) = caps.get(1) {
                    page_text.push_str(m.as_str());
                    page_text.push(' ');
                }
            }
            for caps in array_tj_re.captures_iter(raw_str) {
                if let Some(array_content) = caps.get(1) {
                    for inner_cap in paren_re.captures_iter(array_content.as_str()) {
                        if let Some(inner_m) = inner_cap.get(1) {
                            page_text.push_str(inner_m.as_str());
                        }
                    }
                    page_text.push(' ');
                }
            }
        } else {
            // For multi-page PDFs, segment stream chunks roughly per page
            let stream_re = Regex::new(r"(?s)stream\r?\n(.*?)endstream").unwrap();
            let streams: Vec<_> = stream_re.captures_iter(raw_str).collect();
            if !streams.is_empty() {
                let stream_idx = ((target_page - 1) as usize) % streams.len();
                if let Some(stream_cap) = streams.get(stream_idx) {
                    if let Some(content) = stream_cap.get(1) {
                        let stream_str = content.as_str();
                        for caps in tj_re.captures_iter(stream_str) {
                            if let Some(m) = caps.get(1) {
                                page_text.push_str(m.as_str());
                                page_text.push(' ');
                            }
                        }
                        for caps in array_tj_re.captures_iter(stream_str) {
                            if let Some(array_content) = caps.get(1) {
                                for inner_cap in paren_re.captures_iter(array_content.as_str()) {
                                    if let Some(inner_m) = inner_cap.get(1) {
                                        page_text.push_str(inner_m.as_str());
                                    }
                                }
                                page_text.push(' ');
                            }
                        }
                    }
                }
            }
        }

        // Clean unescaped PDF control characters
        page_text
            .replace("\\n", "\n")
            .replace("\\r", "")
            .replace("\\t", " ")
            .replace("\\(", "(")
            .replace("\\)", ")")
            .trim()
            .to_string()
    }

    pub fn search(&self, query: &str) -> Result<Vec<DocumentSearchMatch>> {
        let clean_q = query.trim().to_lowercase();
        if clean_q.is_empty() {
            return Ok(Vec::new());
        }

        let mut matches = Vec::new();
        for page in 1..=self.page_count {
            if let Ok(page_data) = self.get_page(page) {
                let text_lower = page_data.text_content.to_lowercase();
                if let Some(idx) = text_lower.find(&clean_q) {
                    let start_snippet = idx.saturating_sub(40);
                    let end_snippet = (idx + clean_q.len() + 40).min(page_data.text_content.len());
                    let snippet = format!("...{}...", &page_data.text_content[start_snippet..end_snippet]);

                    matches.push(DocumentSearchMatch {
                        spine_index: (page - 1) as usize,
                        chapter_title: format!("Page {}", page),
                        locator: format!("page={}", page),
                        snippet,
                        match_char_offset: idx,
                    });
                }
            }
        }

        Ok(matches)
    }
}
