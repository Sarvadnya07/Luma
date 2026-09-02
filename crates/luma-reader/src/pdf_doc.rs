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
    pub has_text_layer: bool,
}

pub struct PdfDocument {
    file_path: PathBuf,
    page_count: u32,
    toc: Vec<TocItem>,
    raw_bytes: std::sync::Arc<Vec<u8>>,
    page_cache: std::sync::RwLock<std::collections::HashMap<u32, PdfPageData>>,
}

impl PdfDocument {
    pub const MAX_CACHED_PAGES: usize = 50;

    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let p = path.as_ref().to_path_buf();
        let mut file = File::open(&p)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open PDF file: {}", e)))?;

        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| LumaError::DocumentError(format!("Failed to read PDF: {}", e)))?;

        let raw_str = String::from_utf8_lossy(&buffer);

        // 1. Detect actual page count from page tree objects or /Count
        static PAGE_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(r"/Type\s*/Page\b").expect("Valid regex"));
        let detected_pages = PAGE_RE.find_iter(&raw_str).count() as u32;

        static COUNT_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(r"/Count\s+(\d+)").expect("Valid regex"));
        let max_count = COUNT_RE
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

        // 2. Extract Outlines / TOC if present in PDF
        let mut toc = Vec::new();
        static OUTLINE_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"/Title\s*(\([^)]+\)|<[0-9A-Fa-f]+>)").expect("Valid regex")
        });
        for (i, caps) in OUTLINE_RE.captures_iter(&raw_str).enumerate() {
            if let Some(m) = caps.get(1) {
                let raw_title = Self::decode_pdf_string_literal(m.as_str());
                let title = sanitize_untrusted_html(raw_title.trim());
                if !title.is_empty() && Self::is_valid_printable_text(&title) {
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

        // Fallback TOC if no outline was present
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
            raw_bytes: std::sync::Arc::new(buffer),
            page_cache: std::sync::RwLock::new(std::collections::HashMap::new()),
        })
    }

    pub fn page_count(&self) -> u32 {
        self.page_count
    }

    pub fn file_path(&self) -> &Path {
        &self.file_path
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

        // Fast path: Check in-memory page cache
        if let Ok(guard) = self.page_cache.read() {
            if let Some(cached) = guard.get(&page_number) {
                return Ok(cached.clone());
            }
        }

        let mut text_content = String::new();
        let mut has_text_layer = false;

        let extracted =
            Self::extract_page_content_stream(&self.raw_bytes, page_number, self.page_count);
        if Self::is_valid_printable_text(&extracted) && !extracted.trim().is_empty() {
            text_content = extracted;
            has_text_layer = true;
        }

        let page_data = PdfPageData {
            page_number,
            width_pt: 595.0,  // Standard A4 width pt
            height_pt: 842.0, // Standard A4 height pt
            text_content,
            has_text_layer,
        };

        // Cache page data with bounded size
        if let Ok(mut guard) = self.page_cache.write() {
            if guard.len() >= Self::MAX_CACHED_PAGES {
                guard.clear();
            }
            guard.insert(page_number, page_data.clone());
        }

        Ok(page_data)
    }


    /// Safely isolates content streams for the page and extracts text strictly from BT ... ET operators
    fn extract_page_content_stream(buffer: &[u8], target_page: u32, total_pages: u32) -> String {
        let mut page_text = String::new();

        // 1. Locate all streams in the file
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

        if stream_markers.is_empty() || end_markers.is_empty() {
            return String::new();
        }

        // Determine candidate streams for target page
        let candidate_indices: Vec<usize> = if total_pages <= 1 {
            (0..stream_markers.len()).collect()
        } else {
            // Map page number to stream chunks
            let streams_per_page = (stream_markers.len() as f32 / total_pages as f32).max(1.0);
            let start_idx = ((target_page - 1) as f32 * streams_per_page) as usize;
            let end_idx = (start_idx + streams_per_page.ceil() as usize).min(stream_markers.len());
            (start_idx..end_idx).collect()
        };

        for &idx in &candidate_indices {
            if let Some(&start) = stream_markers.get(idx) {
                let mut data_start = start;
                if data_start < buffer.len() && buffer[data_start] == b'\r' {
                    data_start += 1;
                }
                if data_start < buffer.len() && buffer[data_start] == b'\n' {
                    data_start += 1;
                }

                if let Some(&data_end) = end_markers.iter().find(|&&e| e >= data_start) {
                    // Check header before stream for image or font descriptors (to avoid processing binary assets)
                    let header_start = data_start.saturating_sub(256);
                    let header_str = String::from_utf8_lossy(&buffer[header_start..data_start]);
                    if header_str.contains("/Subtype /Image")
                        || header_str.contains("/Subtype/Image")
                        || header_str.contains("/Type /Font")
                        || header_str.contains("/Type/Font")
                        || header_str.contains("/FontDescriptor")
                    {
                        continue;
                    }

                    let stream_bytes = &buffer[data_start..data_end];

                    // Decompress FlateDecode if compressed
                    let decompressed_opt =
                        miniz_oxide::inflate::decompress_to_vec_zlib(stream_bytes).ok();
                    let stream_str = if let Some(ref decomp) = decompressed_opt {
                        String::from_utf8_lossy(decomp)
                    } else {
                        String::from_utf8_lossy(stream_bytes)
                    };

                    Self::parse_bt_et_text_operators(&stream_str, &mut page_text);
                }
            }
        }

        // Format clean paragraph structure
        let cleaned = page_text
            .replace("\\n", "\n")
            .replace("\\r", "")
            .replace("\\t", " ")
            .trim()
            .to_string();

        cleaned
    }

    /// Extract text specifically bounded by BT (Begin Text) and ET (End Text) operators
    fn parse_bt_et_text_operators(stream_str: &str, out: &mut String) {
        static BT_ET_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(r"(?s)\bBT\b(.*?)\bET\b").expect("Valid regex"));
        static TJ_STR_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"\(([^)]*)\)\s*(?:Tj|'|\x22)").expect("Valid regex")
        });
        static TJ_HEX_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
            Regex::new(r"<([0-9A-Fa-f]+)>\s*(?:Tj|'|\x22)").expect("Valid regex")
        });
        static ARRAY_TJ_RE: std::sync::LazyLock<Regex> =
            std::sync::LazyLock::new(|| Regex::new(r"\[([^\]]+)\]\s*TJ").expect("Valid regex"));

        for bt_match in BT_ET_RE.captures_iter(stream_str) {
            if let Some(block) = bt_match.get(1) {
                let block_str = block.as_str();

                // 1. Literal strings `(...) Tj`
                for caps in TJ_STR_RE.captures_iter(block_str) {
                    if let Some(m) = caps.get(1) {
                        let decoded = Self::decode_pdf_literal_escapes(m.as_str());
                        if Self::is_valid_printable_text(&decoded) {
                            out.push_str(&decoded);
                            out.push(' ');
                        }
                    }
                }

                // 2. Hex strings `<48656c6c6f> Tj`
                for caps in TJ_HEX_RE.captures_iter(block_str) {
                    if let Some(m) = caps.get(1) {
                        let decoded = Self::decode_pdf_hex_string(m.as_str());
                        if Self::is_valid_printable_text(&decoded) {
                            out.push_str(&decoded);
                            out.push(' ');
                        }
                    }
                }

                // 3. Array text operators `[(t) -12 (e) -10 (x) (t)] TJ`
                for caps in ARRAY_TJ_RE.captures_iter(block_str) {
                    if let Some(array_content) = caps.get(1) {
                        let array_str = array_content.as_str();

                        for inner_caps in TJ_STR_RE.captures_iter(array_str) {
                            if let Some(m) = inner_caps.get(1) {
                                let decoded = Self::decode_pdf_literal_escapes(m.as_str());
                                if Self::is_valid_printable_text(&decoded) {
                                    out.push_str(&decoded);
                                }
                            }
                        }

                        for inner_hex in TJ_HEX_RE.captures_iter(array_str) {
                            if let Some(m) = inner_hex.get(1) {
                                let decoded = Self::decode_pdf_hex_string(m.as_str());
                                if Self::is_valid_printable_text(&decoded) {
                                    out.push_str(&decoded);
                                }
                            }
                        }

                        out.push(' ');
                    }
                }
            }
        }
    }

    /// Decode PDF string literals in parenthesized or hex format
    pub fn decode_pdf_string_literal(raw: &str) -> String {
        let trimmed = raw.trim();
        if trimmed.starts_with('(') && trimmed.ends_with(')') {
            let inner = &trimmed[1..trimmed.len() - 1];
            Self::decode_pdf_literal_escapes(inner)
        } else if trimmed.starts_with('<') && trimmed.ends_with('>') {
            let inner = &trimmed[1..trimmed.len() - 1];
            Self::decode_pdf_hex_string(inner)
        } else {
            raw.to_string()
        }
    }

    /// Decode PDF escape sequences: \ddd octal, \n, \r, \t, \b, \f, \(, \), \\
    fn decode_pdf_literal_escapes(input: &str) -> String {
        let mut result = String::with_capacity(input.len());
        let mut chars = input.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '\\' {
                match chars.peek() {
                    Some('n') => {
                        chars.next();
                        result.push('\n');
                    }
                    Some('r') => {
                        chars.next();
                        result.push('\r');
                    }
                    Some('t') => {
                        chars.next();
                        result.push('\t');
                    }
                    Some('b') => {
                        chars.next();
                    }
                    Some('f') => {
                        chars.next();
                    }
                    Some('(') => {
                        chars.next();
                        result.push('(');
                    }
                    Some(')') => {
                        chars.next();
                        result.push(')');
                    }
                    Some('\\') => {
                        chars.next();
                        result.push('\\');
                    }
                    Some(&c) if c.is_digit(8) => {
                        // Octal code \ddd
                        let mut octal = String::new();
                        for _ in 0..3 {
                            if let Some(&digit) = chars.peek() {
                                if digit.is_digit(8) {
                                    octal.push(chars.next().unwrap());
                                } else {
                                    break;
                                }
                            }
                        }
                        if let Ok(code) = u8::from_str_radix(&octal, 8) {
                            result.push(code as char);
                        }
                    }
                    _ => {
                        if let Some(next_ch) = chars.next() {
                            result.push(next_ch);
                        }
                    }
                }
            } else {
                result.push(ch);
            }
        }

        result
    }

    /// Decode PDF hexadecimal string `<48656c6c6f>`
    fn decode_pdf_hex_string(hex_str: &str) -> String {
        let clean_hex: String = hex_str.chars().filter(|c| c.is_ascii_hexdigit()).collect();
        let mut bytes = Vec::new();
        let mut chars = clean_hex.chars();

        while let Some(c1) = chars.next() {
            let c2 = chars.next().unwrap_or('0');
            let byte_str = format!("{}{}", c1, c2);
            if let Ok(b) = u8::from_str_radix(&byte_str, 16) {
                bytes.push(b);
            }
        }

        // Check if UTF-16 BE BOM (\xFE\xFF)
        if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
            let u16_slice: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
                .collect();
            return String::from_utf16_lossy(&u16_slice);
        }

        String::from_utf8_lossy(&bytes).to_string()
    }

    /// Validates character entropy and unprintable ratios to protect against raw CID/binary glyph leakage
    pub fn is_valid_printable_text(text: &str) -> bool {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return false;
        }

        let mut printable_count = 0;
        let mut unprintable_count = 0;

        for ch in trimmed.chars() {
            if (ch.is_control() || (ch as u32) < 0x20 || ch == '\u{FFFD}')
                && ch != '\n'
                && ch != '\r'
                && ch != '\t'
            {
                unprintable_count += 1;
            } else {
                printable_count += 1;
            }
        }

        if printable_count == 0 {
            return false;
        }

        let total = printable_count + unprintable_count;
        let unprintable_ratio = unprintable_count as f32 / total as f32;

        // Strict rejection of binary garbage: if unprintable characters exceed 10%, reject text layer
        unprintable_ratio <= 0.10
    }

    pub fn search(&self, query: &str) -> Result<Vec<DocumentSearchMatch>> {
        let clean_q = query.trim().to_lowercase();
        if clean_q.is_empty() {
            return Ok(Vec::new());
        }

        let mut matches = Vec::new();
        for page in 1..=self.page_count {
            if let Ok(page_data) = self.get_page(page) {
                if !page_data.has_text_layer {
                    continue;
                }
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
