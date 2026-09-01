use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

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

        // Extract page count by searching for `/Type /Page` or `/Count N`
        let page_re = Regex::new(r"/Type\s*/Page\b").unwrap();
        let detected_pages = page_re.find_iter(&raw_str).count() as u32;

        let count_re = Regex::new(r"/Count\s+(\d+)").unwrap();
        let max_count = count_re
            .captures_iter(&raw_str)
            .filter_map(|c| c.get(1)?.as_str().parse::<u32>().ok())
            .max()
            .unwrap_or(0);

        let page_count = if detected_pages > 0 {
            detected_pages
        } else if max_count > 0 {
            max_count
        } else {
            1
        };

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
            if toc.len() >= 100 {
                break;
            }
        }

        // Fallback TOC if none extracted
        if toc.is_empty() {
            for page in 1..=page_count.min(50) {
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

        let mut text_content = String::new();
        if let Ok(buffer) = std::fs::read(&self.file_path) {
            text_content = Self::extract_page_content(&buffer, page_number, self.page_count);
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

    /// Extract text streams matching PDF text operators (BT ... ET, Tj, TJ) with Flate decompression
    fn extract_page_content(buffer: &[u8], target_page: u32, total_pages: u32) -> String {
        let raw_str = String::from_utf8_lossy(buffer);
        let mut page_text = String::new();

        let tj_re = Regex::new(r"\(([^)]+)\)\s*(?:Tj|'|\x22)").unwrap();
        let array_tj_re = Regex::new(r"\[([^\]]+)\]\s*TJ").unwrap();
        let paren_re = Regex::new(r"\(([^)]+)\)").unwrap();

        // 1. Try uncompressed raw text extraction first
        if total_pages <= 1 {
            Self::extract_from_text_block(&raw_str, &tj_re, &array_tj_re, &paren_re, &mut page_text);
        } else {
            // Find all byte streams: `stream\r?\n ... endstream`
            let stream_markers: Vec<usize> = buffer
                .windows(6)
                .enumerate()
                .filter_map(|(i, w)| if w == b"stream" { Some(i + 6) } else { None })
                .collect();

            let end_markers: Vec<usize> = buffer
                .windows(9)
                .enumerate()
                .filter_map(|(i, w)| if w == b"endstream" { Some(i) } else { None })
                .collect();

            if !stream_markers.is_empty() && !end_markers.is_empty() {
                let stream_idx = ((target_page - 1) as usize) % stream_markers.len();
                if let Some(&start) = stream_markers.get(stream_idx) {
                    // Skip newline following `stream`
                    let mut data_start = start;
                    if data_start < buffer.len() && buffer[data_start] == b'\r' {
                        data_start += 1;
                    }
                    if data_start < buffer.len() && buffer[data_start] == b'\n' {
                        data_start += 1;
                    }

                    // Find matching endstream
                    if let Some(&data_end) = end_markers.iter().find(|&&e| e >= data_start) {
                        let stream_bytes = &buffer[data_start..data_end];

                        // Attempt FlateDecode decompression
                        if let Ok(decompressed) = miniz_oxide::inflate::decompress_to_vec_zlib(stream_bytes) {
                            let decomp_str = String::from_utf8_lossy(&decompressed);
                            Self::extract_from_text_block(&decomp_str, &tj_re, &array_tj_re, &paren_re, &mut page_text);
                        } else {
                            // Try raw text if not compressed
                            let stream_str = String::from_utf8_lossy(stream_bytes);
                            Self::extract_from_text_block(&stream_str, &tj_re, &array_tj_re, &paren_re, &mut page_text);
                        }
                    }
                }
            }

            // If specific stream yielded no text, fallback to global stream scan
            if page_text.trim().is_empty() {
                Self::extract_from_text_block(&raw_str, &tj_re, &array_tj_re, &paren_re, &mut page_text);
            }
        }

        // Clean unescaped PDF control characters
        let cleaned = page_text
            .replace("\\n", "\n")
            .replace("\\r", "")
            .replace("\\t", " ")
            .replace("\\(", "(")
            .replace("\\)", ")")
            .trim()
            .to_string();

        cleaned
    }

    fn extract_from_text_block(
        stream_str: &str,
        tj_re: &Regex,
        array_tj_re: &Regex,
        paren_re: &Regex,
        out: &mut String,
    ) {
        for caps in tj_re.captures_iter(stream_str) {
            if let Some(m) = caps.get(1) {
                out.push_str(m.as_str());
                out.push(' ');
            }
        }
        for caps in array_tj_re.captures_iter(stream_str) {
            if let Some(array_content) = caps.get(1) {
                for inner_cap in paren_re.captures_iter(array_content.as_str()) {
                    if let Some(inner_m) = inner_cap.get(1) {
                        out.push_str(inner_m.as_str());
                    }
                }
                out.push(' ');
            }
        }
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
                    let snippet = format!(
                        "...{}...",
                        &page_data.text_content[start_snippet..end_snippet]
                    );

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
